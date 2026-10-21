import {createCalendarVerifier} from '../lumi-calendar/calendar-auth.mjs';
import {encrypt,decrypt} from '../lumi-calendar/calendar.mjs';
const HOST='lumi-develop.psanchesnle.workers.dev',ORIGIN='https://'+HOST;
export const FEEDBACK_CODES={CAL:'Agenda e eventos',LOG:'Entrada e acesso',CHA:'Conversa e respostas',VOZ:'Áudio e microfone',MEM:'Memória e histórico',SAU:'Saúde e exercícios',TEL:'Tela e navegação',PES:'Pesquisa e notícias',OUT:'Outro problema'};
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
async function body(request){const reader=request.body?.getReader();if(!reader)throw Error('INPUT');let size=0,text='';const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('INPUT');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}
export function withBetaFeedback(original,{verify=createCalendarVerifier(),now=()=>new Date()}={}){
 return {...original,async fetch(request,env,ctx){
  const url=new URL(request.url);if(url.hostname!==HOST||url.pathname.replace(/^\/api(?=\/)/,'')!=='/beta-feedback')return original.fetch.call(original,request,env,ctx);
  try{
   if(request.headers.get('origin')!==ORIGIN&&!(request.method==='GET'&&request.headers.get('sec-fetch-site')==='same-origin'))return json({error:'Origem não autorizada.'},403);
   const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1],user=token&&await verify(token,env);if(!user?.id)return json({error:'Entre na Lumi para enviar ou consultar relatos.'},401);
   if(!env.Memory)return json({error:'Relatos temporariamente indisponíveis.'},503);
   if(request.method==='GET'){
    const cursor=url.searchParams.get('cursor')||undefined;if(cursor&&cursor.length>2048)return json({error:'Página inválida.'},400);
    const page=await env.Memory.list({prefix:'beta:user:'+user.id+':',limit:50,...(cursor?{cursor}:{})});const reports=[];
    for(const {name} of page.keys){const saved=await env.Memory.get('beta:report:'+name.split(':').at(-1));if(saved){const record=await decrypt(env,saved);if(record.userId===user.id){const {userId,...report}=record;reports.push(report);}}}
    return json({reports:reports.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),codes:FEEDBACK_CODES,cursor:page.list_complete?null:page.cursor});
   }
   if(request.method!=='POST')return json({error:'Método não permitido.'},405);
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},400);
   let data;try{data=await body(request);}catch{return json({error:'Confira os dados. O relato deve ter até 8 KB.'},400);}
   if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['category','description','expected','severity','platform','version','requestId'].includes(k))||!Object.hasOwn(FEEDBACK_CODES,data.category)||!['minor','normal','blocking'].includes(data.severity)||typeof data.description!=='string'||data.description.trim().length<5||data.description.length>2000||typeof data.expected!=='string'||data.expected.length>1000||!['Android','iPhone/iPad','Computador','Outro'].includes(data.platform)||typeof data.version!=='string'||data.version.length>80||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z_[a-f0-9]{32}$/.test(data.requestId||''))return json({error:'Informe a área e descreva o problema (5 a 2.000 caracteres).'},400);
   const date=now(),requested=Date.parse(data.requestId.slice(0,24));if(Math.abs(date.getTime()-requested)>86400000)return json({error:'Este envio expirou. Reabra o formulário.'},400);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.id+':'+data.requestId))),x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
   const id='LUM-'+data.category+'-'+data.requestId.slice(0,10).replaceAll('-','')+'-'+digest.toUpperCase(),key='beta:report:'+id;
   const existing=await env.Memory.get(key);if(existing){const record=await decrypt(env,existing);await env.Memory.put('beta:user:'+user.id+':'+data.requestId.slice(0,10).replaceAll('-','')+':'+id,'1');return json({saved:true,id:record.id,status:record.status,duplicate:true});}
   const recent=await env.Memory.list({prefix:'beta:user:'+user.id+':'+date.toISOString().slice(0,10).replaceAll('-','')+':',limit:21});let today=0;for(const k of recent.keys)if(k.name.includes('-'+date.toISOString().slice(0,10).replaceAll('-','')+'-'))today++;if(today>=20)return json({error:'Você já enviou 20 relatos hoje. Tente novamente amanhã.'},429);
   const record={id,userId:user.id,category:data.category,description:data.description.trim(),expected:data.expected.trim(),severity:data.severity,platform:data.platform,version:data.version,status:'recebido',createdAt:date.toISOString()};
   await env.Memory.put(key,await encrypt(env,record));await env.Memory.put('beta:user:'+user.id+':'+data.requestId.slice(0,10).replaceAll('-','')+':'+id,'1');
   return json({saved:true,id,status:'recebido'},201);
  }catch{return json({error:'Não consegui concluir. Seu texto permanece no formulário; tente novamente.'},503);}
 }};
}
