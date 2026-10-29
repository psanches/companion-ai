// Enrich the existing authenticated history routes; preserve the original backend.
const HOST='lumi-develop.psanchesnle.workers.dev';
export function archiveTime(chat){
 const timestamp=Number(chat?.timestamp);if(Number.isFinite(timestamp)&&timestamp>0)return timestamp;
 const iso=Date.parse(chat?.createdAt||'');if(Number.isFinite(iso))return iso;
 const id=Number(chat?.id);return Number.isFinite(id)?id:0;
}
export function recentArchives(items){
 const unique=new Map();for(const item of items)if(item&&typeof item.id==='string'&&item.id)unique.set(item.id,item);
 return [...unique.values()].sort((a,b)=>archiveTime(b)-archiveTime(a)).slice(0,5);
}
function metadata(key,value){
 const match=/^archive:user:.+:(\d{13})$/.exec(key);if(!match||typeof value!=='string')return null;
 let history;try{history=JSON.parse(value);}catch{return null;}if(!Array.isArray(history)||!history.length)return null;
 const first=history.find(item=>item?.role==='user'&&typeof item.content==='string');
 return {id:match[1],title:first?.content.slice(0,60)||'Conversa sem título',timestamp:Number(match[1]),createdAt:new Date(Number(match[1])).toISOString(),messageCount:history.length};
}
export function withConversationSidebar(original){
 return {...original,async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api(?=\/)/,'');
  if(url.hostname!==HOST||!['/history/archives','/history/archive','/history/restore'].includes(path))return original.fetch.call(original,request,env,ctx);
  let archived=null,forwardEnv=env;
  if(request.method==='POST'&&['/history/archive','/history/restore'].includes(path)&&env?.Memory){
   // Capture only metadata from a completed write performed by the original,
   // authenticated handler. Bind native KV methods to their original receiver.
   const memory=env.Memory;
   const proxy=new Proxy(memory,{get(target,name){
    if(name==='put')return async(key,value,...rest)=>{const result=await target.put(key,value,...rest);archived=metadata(String(key),value)||archived;return result;};
    const value=Reflect.get(target,name,target);return typeof value==='function'?value.bind(target):value;
   }});
   forwardEnv={...env,Memory:proxy};
  }
  if(path==='/history/archives'&&request.method==='GET'&&typeof env?.Memory?.list==='function'){
   const memory=env.Memory;
   const proxy=new Proxy(memory,{get(target,name){
    if(name==='list')return async(options={})=>{
     if(!/^archive:user:[^:]+:$/.test(options.prefix||''))return target.list(options);
     let cursor,latest=[];const seen=new Set();
     do{
      const result=await target.list({...options,limit:100,...(cursor?{cursor}:{})});
      const keys=(result.keys||[]).filter(item=>item?.name?.startsWith(options.prefix)&&/^\d{13}$/.test(item.name.slice(options.prefix.length)));
      latest=[...new Map([...latest,...keys].map(item=>[item.name,item])).values()].sort((a,b)=>Number(b.name.slice(options.prefix.length))-Number(a.name.slice(options.prefix.length))).slice(0,5);
      if(result.list_complete)break;
      if(!result.cursor||seen.has(result.cursor))throw Error('Invalid archive cursor');
      cursor=result.cursor;seen.add(cursor);
     }while(cursor);
     return {keys:latest,list_complete:true,cursor:''};
    };
    const value=Reflect.get(target,name,target);return typeof value==='function'?value.bind(target):value;
   }});
   forwardEnv={...env,Memory:proxy};
  }
  const response=await original.fetch.call(original,request,forwardEnv,ctx);
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return response;
  const data=await response.json(),headers=new Headers(response.headers);
  for(const name of ['content-length','content-encoding','etag'])headers.delete(name);headers.set('cache-control','no-store');
  const body=path==='/history/archives'&&Array.isArray(data.archives)?{...data,archives:recentArchives(data.archives)}:archived?{...data,archived}:data;
  return new Response(JSON.stringify(body),{status:response.status,headers});
 }};
}
