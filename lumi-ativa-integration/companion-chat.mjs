import {personalMemoryRequest,updatePersonalMemory} from './personal-memory.mjs';
import {createCalendarVerifier} from '../lumi-calendar/calendar-auth.mjs';
import {createLumiResearchHandler} from '../lumi-research/handler.mjs';
import {removeUnsolicitedOffers} from './companion-instructions.mjs';
import {resolveWeatherCity,isBareCityReply,asksWeatherCity,isWeatherQuestion} from '../lumi-research/weather-location.mjs';
export {rememberedCity} from '../lumi-research/weather-location.mjs';
const HOST='lumi-develop.psanchesnle.workers.dev';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export {isWeatherQuestion} from '../lumi-research/weather-location.mjs';
// Scheduling stays with the calendar wrapper; research uses its existing auth,
// per-user limits and verified-source requirements.
export function isResearchQuestion(text){
 const value=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(?:agende|agendar|marque|marcar|lembre|lembrar|crie|criar|adicione|adicionar|schedule|book)\b/.test(value)&&/\b(?:consulta|evento|compromisso|lembrete|agenda|appointment|event|reminder)\b/.test(value))return false;
 return isWeatherQuestion(text)||
  /\b(?:pesquise|pesquisar|busque|buscar|procure|search|look up)\b/.test(value)||
  /\b(?:noticias|news|cotacao|cotacoes|placar|score)\b/.test(value)||
  /(?:quanto foi|resultado|quem (?:ganhou|venceu))[^?]{0,100}\b(?:jogo|partida|roma|napoli|futebol|campeonato)\b/.test(value)||
  /(?:ultimas?|recentes?|novidades|atualizad[oa]s?|atualmente|latest|current)[^?]{0,100}(?:pesquisas?|estudos?|tratamentos?|parkinson|noticias|precos?|resultados?)/.test(value)||
  /(?:pesquisas?|estudos?|tratamentos?|precos?|resultados?)[^?]{0,100}(?:recentes?|atuais|hoje|atualizad[oa]s?)/.test(value)||
  /\b(?:quem e|who is)\b[^?]{0,50}\b(?:presidente|president|ceo|governador|prefeito)\b/.test(value);
}
const isResearchFollowup=text=>/^(?:(?:se eu quiser lembrete[^.!?]*[.!?]?|n[aã]o (?:quero|ofereça)[^.!?]*[.!?]?)\s*)?(?:essa|esta|a|isso|foi|voc[eê]|e as?|qual|de|[ée])[^\n]{0,250}(?:informaç|hoje|fonte|atualiz|verific|data|confi[aá]vel|previs[aã]o|alerta)/i.test(text.trim());
const isWeatherFollowup=text=>/^(?:sim|yes|pode(?: pesquisar| verificar| consultar)?|pode sim|verifique|consulte|aqui|minha (?:cidade|localizaç[aã]o)|(?:voc[eê] )?(?:sabe|tem|lembra)[^\n]{0,60}(?:cidade|localizaç[aã]o)|(?:em|para|in) [\p{L} .'-]{2,60}(?:,?\s*[A-Z]{2})?|[\p{L} .'-]{2,60},\s*[A-Z]{2})[.!?]*$/iu.test(text.trim());
function researchContext(history){
 for(let index=history.length-1;index>=0;index--){
  const item=history[index];
  if(item?.role!=='user'||typeof item.content!=='string')continue;
  if(isResearchQuestion(item.content))return item.content;
  if(!isResearchFollowup(item.content)&&!isWeatherFollowup(item.content)&&!(isBareCityReply(item.content)&&asksWeatherCity(history[index-1]?.content)))return null;
 }
 return null;
}
async function boundedBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error();let count=0,raw='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>65536){void reader.cancel().catch(()=>{});throw Error();}raw+=decoder.decode(value,{stream:true});}
 const body=JSON.parse(raw+decoder.decode());if(!body||typeof body.message!=='string'||!body.message.trim())throw Error();return body;
}
function cleanedHistory(items){return (Array.isArray(items)?items:[]).filter(x=>['user','assistant'].includes(x?.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content}));}
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
  const selected=request.headers.get('x-lumi-language');const language=['en','pt-BR'].includes(selected)?selected:null;const english=language==='en';
  const memoryRequest=personalMemoryRequest(text);
  if(memoryRequest){
   if(request.headers.get('origin')!==url.origin)return json({error:'Origem não autorizada.'},403);
   let user;try{const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];user=token&&await verify(token,env);}catch{return json({error:'Não consegui verificar sua sessão agora.'},503);}
   if(!user?.id)return json({error:'Entre na Lumi para continuar.'},401);
   if(memoryRequest.error)return json({error:memoryRequest.error,reply:memoryRequest.error,memorySaved:false},400);
   if(!env?.Memory)return json({error:'Memória temporariamente indisponível.'},503);
   let history,next;
   try{const current=await env.Memory.get('memory:user:'+user.id);history=cleanedHistory(await env.Memory.get('history:user:'+user.id,'json'));next=updatePersonalMemory(current,memoryRequest);if(next.length>64000)return json({error:'A memória está cheia. Revise-a antes de adicionar informações.'},413);await env.Memory.put('memory:user:'+user.id,next);}
   catch{return json({reply:english?'I could not save this to your memory. Please try again.':'Não consegui salvar isso na sua memória. Tente novamente.',memorySaved:false},503);}
   let reply=english?'Saved to your personal memory.':'Salvo na sua memória pessoal.';
   history.push({role:'user',content:text},{role:'assistant',content:reply});
   try{await env.Memory.put('history:user:'+user.id,JSON.stringify(history));}catch{return json({reply:reply+(english?' I could not update this conversation.':' Não consegui atualizar esta conversa.'),memorySaved:true});}
   return json({reply,history,memorySaved:true});
  }
  if(isResearchQuestion(text)||isResearchFollowup(text)||isWeatherFollowup(text)||isBareCityReply(text)){
   if(request.headers.get('origin')!==url.origin)return json({error:'Origem não autorizada.'},403);
   let user;try{const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];user=token&&await verify(token,env);}catch{return json({error:'Não consegui verificar sua sessão agora.'},503);}
   if(!user?.id)return json({error:'Entre na Lumi para continuar.'},401);
   if(!env?.Memory)return json({error:'Histórico temporariamente indisponível.'},503);
   let history;try{history=cleanedHistory(await env.Memory.get('history:user:'+user.id,'json'));}catch{return json({error:'Não consegui recuperar a conversa agora.'},503);}
   const context=isResearchQuestion(text)?null:researchContext(history);
   const cityReply=isBareCityReply(text)&&asksWeatherCity(history.at(-1)?.content)&&isWeatherQuestion(context||'');
   if(isResearchQuestion(text)||(context&&((isResearchFollowup(text)||isWeatherFollowup(text))&&(!isWeatherFollowup(text)||isWeatherQuestion(context))))||cityReply){
    let question=context?'Pergunta anterior: '+context+'\nPergunta atual: '+text:text;
    if(isWeatherQuestion(text)||isWeatherQuestion(context||'')){
     let memory;try{memory=await env.Memory.get('memory:user:'+user.id);}catch{return json({error:'Não consegui consultar sua cidade agora.'},503);}
     const city=resolveWeatherCity(text,history,memory);
     if(!city){
      const reply=english?'Which city should I check?':'Qual cidade você quer consultar?';
      history.push({role:'user',content:text},{role:'assistant',content:reply});
      try{await env.Memory.put('history:user:'+user.id,JSON.stringify(cleanedHistory(history)));}catch{return json({error:'Não consegui salvar a conversa agora.'},503);}
      return json({reply,history:cleanedHistory(history),researchStatus:'needs_location'});
     }
     if(/^(?:s[oó]|somente|apenas)\s+(?:apresentar|mostrar|consultar)[\s\S]{0,80}\b(?:clima|tempo|previs[aã]o)\b[\s\S]{0,80}\bcidade\b/iu.test(text)){
      const reply=english?'I will use '+city+' for weather unless you ask for another city.':'Usarei '+city+' para o clima, salvo quando você pedir outra cidade.';
      history.push({role:'user',content:text},{role:'assistant',content:reply});
      try{await env.Memory.put('history:user:'+user.id,JSON.stringify(cleanedHistory(history)));}catch{return json({error:'Não consegui salvar a conversa agora.'},503);}
      return json({reply,history:cleanedHistory(history),researchStatus:'preference_acknowledged'});
     }
     question='Cidade da previsão: '+city+'\n'+question;
    }
    if(question.length>1200)return json({error:'Resuma a pergunta para até 1.200 caracteres.'},400);
    const upstream=await research(new Request(url.origin+'/research',{method:'POST',headers:{origin:url.origin,authorization:request.headers.get('authorization')||'','content-type':'application/json',...(language?{'x-lumi-language':language}:{})},body:JSON.stringify({question})}),env);
    const data=await upstream.json();
    const ok=upstream.ok&&data.status==='complete'&&Array.isArray(data.citations)&&data.citations.length;
    let reply=ok?removeUnsolicitedOffers(data.answer)+(english?'\n\nSources:\n':'\n\nFontes:\n')+data.citations.filter(c=>typeof c.url==='string'&&c.url.startsWith('https://')).map(c=>(english?'[Source](':'[Fonte](')+c.url+')').join('\n'):(english?(data.status==='limited'?'Research limit reached. Please try again later.':'I could not verify this information right now.'):(data.answer||data.error||'Não consegui verificar essa informação agora.'));
    // A completed request time is distinct from a source publication/update date.
    if(ok&&data.researchedAt)reply+=(english?'\nSearched on ':'\nConsulta realizada em ')+new Date(data.researchedAt).toLocaleString(english?'en-GB':'pt-BR',{timeZone:'America/Sao_Paulo',hourCycle:'h23'})+(english?' (Brasilia time).':' (Brasília).');
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
  const nextEnv=proxy?{...env,Memory:proxy}:env;
  const response=await original.fetch.call(original,request,language?{...nextEnv,LUMI_RESPONSE_LANGUAGE:language}:nextEnv,ctx);
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return response;
  const data=sanitizeResponse(await response.json()),headers=new Headers(response.headers);for(const key of ['etag','content-length','content-encoding'])headers.delete(key);headers.set('cache-control','no-store');return new Response(JSON.stringify(data),{status:response.status,headers});
 }};
}
