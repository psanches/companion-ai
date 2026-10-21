import {createCalendarVerifier} from '../lumi-calendar/calendar-auth.mjs';
import {createLumiResearchHandler} from '../lumi-research/handler.mjs';
import {removeUnsolicitedOffers} from './companion-instructions.mjs';
const HOST='lumi-develop.psanchesnle.workers.dev';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export const isWeatherQuestion=text=>/\b(?:clima|weather|forecast)\b|previs[aã]o\s+(?:do\s+)?tempo|(?:como (?:est[aá]|vai estar)|qual[^?]{0,30})\s+o tempo|tempo\s+(?:hoje|amanh[aã]|em|para)\b/i.test(text);
const isResearchFollowup=text=>/^(?:(?:se eu quiser lembrete[^.!?]*[.!?]?|n[aã]o (?:quero|ofereça)[^.!?]*[.!?]?)\s*)?(?:essa|esta|a|isso|foi|voc[eê]|e as?|qual|de|[ée])[^\n]{0,250}(?:informaç|hoje|fonte|atualiz|verific|data|confi[aá]vel|previs[aã]o|alerta)/i.test(text.trim());
function weatherContext(history){
 for(const item of [...history].reverse()){
  if(item?.role!=='user'||typeof item.content!=='string')continue;
  if(isWeatherQuestion(item.content))return item.content;
  if(!isResearchFollowup(item.content))return null;
 }
 return null;
}
async function boundedBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error();let count=0,raw='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>65536){void reader.cancel().catch(()=>{});throw Error();}raw+=decoder.decode(value,{stream:true});}
 const body=JSON.parse(raw+decoder.decode());if(!body||typeof body.message!=='string'||!body.message.trim())throw Error();return body;
}
function cleanedHistory(items){return (Array.isArray(items)?items:[]).filter(x=>['user','assistant'].includes(x?.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,12000)})).slice(-40);}
function sanitizeResponse(data){
 if(typeof data.reply==='string')data.reply=removeUnsolicitedOffers(data.reply);
 if(Array.isArray(data.history)){const last=data.history.at(-1);if(last?.role==='assistant')last.content=removeUnsolicitedOffers(last.content);}
 return data;
}
export function withCompanionChat(original,{verify=createCalendarVerifier(),research=createLumiResearchHandler()}={}){
 return {...original,async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api(?=\/)/,'');
  if(url.hostname!==HOST||path!=='/chat'||request.method!=='POST')return original.fetch.call(original,request,env,ctx);
  let body;try{body=await boundedBody(request.clone());}catch{return json({error:'Confira sua mensagem. O pedido deve ter até 64 KB.'},400);}
  const text=body.message.trim();
  if(isWeatherQuestion(text)||isResearchFollowup(text)){
   if(request.headers.get('origin')!==url.origin)return json({error:'Origem não autorizada.'},403);
   let user;try{const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];user=token&&await verify(token,env);}catch{return json({error:'Não consegui verificar sua sessão agora.'},503);}
   if(!user?.id)return json({error:'Entre na Lumi para continuar.'},401);
   if(!env?.Memory)return json({error:'Histórico temporariamente indisponível.'},503);
   let history;try{history=cleanedHistory(await env.Memory.get('history:user:'+user.id,'json'));}catch{return json({error:'Não consegui recuperar a conversa agora.'},503);}
   const context=isWeatherQuestion(text)?null:weatherContext(history);
   if(isWeatherQuestion(text)||context){
    const question=context?'Pergunta anterior sobre o tempo: '+context+'\nPergunta atual: '+text:text;
    if(question.length>1200)return json({error:'Resuma a pergunta sobre o tempo para até 1.200 caracteres.'},400);
    const upstream=await research(new Request(url.origin+'/research',{method:'POST',headers:{origin:url.origin,authorization:request.headers.get('authorization')||'','content-type':'application/json'},body:JSON.stringify({question})}),env);
    const data=await upstream.json();
    const ok=upstream.ok&&data.status==='complete'&&Array.isArray(data.citations)&&data.citations.length;
    let reply=ok?removeUnsolicitedOffers(data.answer)+'\n\nFontes:\n'+data.citations.map(c=>c.url).join('\n'):(data.answer||data.error||'Não consegui verificar a previsão agora.');
    // A completed request time is distinct from a source publication/update date.
    if(ok&&data.researchedAt)reply+='\nConsulta realizada em '+new Date(data.researchedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',hourCycle:'h23'})+' (Brasília).';
    history.push({role:'user',content:text},{role:'assistant',content:reply});history=cleanedHistory(history);
    try{await env.Memory.put('history:user:'+user.id,JSON.stringify(history));}catch{return json({error:'Não consegui salvar a conversa. Tente novamente.'},503);}
    return json({reply,history,researchStatus:data.status||'failed'});
   }
  }
  // Enforce the same no-offer rule in persisted output and in the response.
  const memory=env?.Memory;
  const proxy=memory&&new Proxy(memory,{get(target,name){
   if(name==='put')return async(key,value,...rest)=>{if(/^history:user:/.test(String(key))&&typeof value==='string'){try{const history=JSON.parse(value);sanitizeResponse({history});value=JSON.stringify(history);}catch{}}return target.put(key,value,...rest);};
   const value=Reflect.get(target,name,target);return typeof value==='function'?value.bind(target):value;
  }});
  const response=await original.fetch.call(original,request,proxy?{...env,Memory:proxy}:env,ctx);
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return response;
  const data=sanitizeResponse(await response.json()),headers=new Headers(response.headers);for(const key of ['etag','content-length','content-encoding'])headers.delete(key);headers.set('cache-control','no-store');return new Response(JSON.stringify(data),{status:response.status,headers});
 }};
}
