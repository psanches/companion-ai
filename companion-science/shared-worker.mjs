import {DOCTORAL_RESEARCH} from './doctoral-research.mjs';
import {TOPICS,SOURCES,VERSION,CHECKED,normalize} from './catalog.mjs';
import {createCalendarVerifier} from '../lumi-calendar/calendar-auth.mjs';
const HOST='lumi-develop.psanchesnle.workers.dev';
const response=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export function sharedScienceCatalog(){return {version:VERSION,checked:CHECKED,scope:'public-scientific-knowledge',topics:TOPICS,sources:SOURCES,doctoralResearch:DOCTORAL_RESEARCH};}
export function scienceReply(topic,english=false){
 return (english?'Companion · Science — shared knowledge (content in Portuguese)':'Companion · Ciência — memória geral')+'\n\n'+topic.title+'\n'+topic.evidence+(topic.evidenceDescription?'\n'+topic.evidenceDescription:'')+'\n\n'+topic.text+(topic.terms?.length?'\n\n'+topic.terms.map(t=>t.name+': '+t.meaning).join('\n'):'')+'\n\n'+(english?'In practice: ':'Na prática: ')+topic.practice+'\n\n'+(english?'Limits and precautions: ':'Limites e cuidados: ')+topic.limits+'\n\n'+(english?'Sources:\n':'Fontes:\n')+topic.sources.map(id=>'['+SOURCES[id].name+']('+SOURCES[id].url+')'+(SOURCES[id].about?' — '+SOURCES[id].about:'')).join('\n')+'\n\n'+(english?'Sources consulted: ':'Fontes consultadas: ')+CHECKED+(english?' · Retrieved without an AI call.':' · Consulta sem chamada de IA.');
}
async function bodyWithinLimit(request){
 const reader=request.body?.getReader();if(!reader)return null;const chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){void reader.cancel().catch(()=>{});return null;}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
export function withSharedScience(original,{verify=createCalendarVerifier()}={}){
 return {...original,async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api(?=\/)/,'');
  if(url.hostname!==HOST)return original.fetch.call(original,request,env,ctx);
  if(path==='/companion-science/catalog'){
   if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{allow:'GET, HEAD','cache-control':'no-store'}});
   return new Response(request.method==='HEAD'?null:JSON.stringify(sharedScienceCatalog()),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','etag':'"'+VERSION+'"'}});
  }
  if(path!=='/chat'||request.method!=='POST')return original.fetch.call(original,request,env,ctx);
  const body=await bodyWithinLimit(request.clone()),text=typeof body?.message==='string'?body.message.trim():'';
  // Exact, explicit library lookup only. Personal questions and new research keep Lumi's existing route.
  const match=text.match(/^Companion:\s*([^\n]{1,180})$/iu);
  if(!match)return original.fetch.call(original,request,env,ctx);
  if(request.headers.get('origin')!==url.origin)return response({error:'Origem não autorizada.'},403);
  let user;try{const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];user=token&&await verify(token,env);}catch{return response({error:'Não consegui verificar sua sessão agora.'},503);}
  if(!user?.id)return response({error:'Entre na Lumi para continuar.'},401);
  if(!env?.Memory)return response({error:'Histórico temporariamente indisponível.'},503);
  const topic=TOPICS.find(t=>normalize(t.title)===normalize(match[1])||t.id===match[1]);
  const english=request.headers.get('x-lumi-language')==='en';
  const reply=topic?scienceReply(topic,english):(english?'This topic is not in Companion’s shared knowledge base. No AI call was made.':'Esse assunto não consta na memória geral do Companion. Nenhuma chamada de IA foi feita.');
  let history;
  try{const stored=await env.Memory.get('history:user:'+user.id,'json');history=(Array.isArray(stored)?stored:[]).filter(x=>['user','assistant'].includes(x?.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content}));history.push({role:'user',content:text},{role:'assistant',content:reply});await env.Memory.put('history:user:'+user.id,JSON.stringify(history));}
  catch{return response({error:'Não consegui salvar esta conversa. Tente novamente.'},503);}
  return response({reply,history,knowledgeSource:'shared-science',knowledgeVersion:VERSION,topicId:topic?.id||null,modelCalls:0});
 }};
}
