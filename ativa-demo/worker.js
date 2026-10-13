import {records,questions} from './public/data.js';
const encoder=new TextEncoder();
const security={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{...security,'content-type':'application/json',...extra}});
async function readJson(request){const reader=request.body?.getReader();if(!reader)throw Error();const chunks=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1024){await reader.cancel();throw Error();}chunks.push(value);}const bytes=new Uint8Array(total);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
async function key(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function unb64(s){return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
export async function issueSession(secret,now=Date.now()){const body=b64(encoder.encode(JSON.stringify({exp:now+4*3600000,nonce:crypto.randomUUID()})));return body+'.'+b64(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body)));}
export async function validSession(request,secret,now=Date.now()){if(!secret||secret.length<20)return false;try{const value=request.headers.get('cookie')?.match(/(?:^|;\s*)ativa_session=([^;]+)/)?.[1];const parts=value.split('.');if(parts.length!==2)return false;const [body,sig]=parts;const claims=JSON.parse(new TextDecoder().decode(unb64(body)));return Number.isFinite(claims.exp)&&claims.exp>now&&claims.exp<=now+4*3600000&&await crypto.subtle.verify('HMAC',await key(secret),unb64(sig),encoder.encode(body));}catch{return false;}}
export class DemoBudget {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){const {kind,id,reply}=await request.json();const day=new Date().toISOString().slice(0,10);const configured=Number(this.env.DAILY_REQUEST_LIMIT);const max=Number.isSafeInteger(configured)&&configured>0?Math.min(configured,50):50;const limit=kind==='login'?100:max;let allowed=false;let cached;
 await this.state.storage.transaction(async tx=>{
 const previous=await tx.get('budget');const current=previous?.day===day?previous:{day,counters:{},cache:{}};
 if(kind==='cache'){cached=current.cache[id];allowed=true;return;}
 if(kind==='save'){current.cache[id]=reply;allowed=true;}
 else {const count=current.counters[kind]||0;if(count<limit){current.counters[kind]=count+1;allowed=true;}}
 if(allowed)await tx.put('budget',current);
 });
 return json({allowed,cached},allowed?200:429);
 }
}
async function budget(env,kind,id,reply){const stub=env.BUDGET.get(env.BUDGET.idFromName('synthetic-demo-global'));return stub.fetch(new Request('https://budget.internal',{method:'POST',body:JSON.stringify({kind,id,reply})}));}
export async function handle(request,env,fetcher=fetch){const url=new URL(request.url);const path=url.pathname;
 if(env.DEMO_MODE!=='synthetic-only')return json({error:'Demonstração indisponível.'},503);
 // No fallthrough to Lumi, medical routes, passkeys or other APIs.
 if(path==='/medical'||path.startsWith('/medical/')||path==='/api'||path.startsWith('/api/')||path.startsWith('/history')||path.startsWith('/memory')||path.startsWith('/chat'))return json({error:'MEDICAL_RECORDS_BLOCKED'},403);
 if(path.startsWith('/demo-api/')){
 if(!env.DEMO_ACCESS_CODE||env.DEMO_ACCESS_CODE.length<20||!env.BUDGET)return json({error:'Acesso ao demo ainda não configurado.'},503);
 if(!['GET','HEAD'].includes(request.method) && request.headers.get('origin')!==url.origin)return json({error:'Origem não autorizada.'},403);
 if(path==='/demo-api/session'&&request.method==='GET')return json({authenticated:await validSession(request,env.DEMO_ACCESS_CODE),aiConfigured:Boolean(env.OPENAI_API_KEY)});
 if(path==='/demo-api/session'&&request.method==='DELETE')return json({ok:true},200,{'set-cookie':'ativa_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(path==='/demo-api/session'&&request.method==='POST'){
 if(!(await budget(env,'login')).ok)return json({error:'Limite de tentativas atingido. Tente amanhã.'},429);
 let body;try{body=await readJson(request);}catch{return json({error:'Pedido inválido.'},400);}
 const supplied=await crypto.subtle.digest('SHA-256',encoder.encode(String(body.code||'')));const expected=await crypto.subtle.digest('SHA-256',encoder.encode(env.DEMO_ACCESS_CODE));let diff=0;const a=new Uint8Array(supplied),b=new Uint8Array(expected);for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)return json({error:'Código de acesso incorreto.'},401);
 return json({ok:true},200,{'set-cookie':`ativa_session=${await issueSession(env.DEMO_ACCESS_CODE)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`});
 }
 if(!await validSession(request,env.DEMO_ACCESS_CODE))return json({error:'Entre com o código de acesso ao demo.'},401);
 if(path!=='/demo-api/explain'||request.method!=='POST')return json({error:'Rota indisponível.'},404);
 let body;try{body=await readJson(request);}catch{return json({error:'Pedido inválido.'},400);}
 if(Object.keys(body).some(k=>!['recordId','questionId'].includes(k))||!records.some(r=>r.id===body.recordId)||!questions.some(q=>q.id===body.questionId))return json({error:'A IA aceita somente o cenário fictício e as perguntas do demo.'},400);
 if(!env.OPENAI_API_KEY)return json({error:'A chave de IA ainda não foi configurada neste demo.'},503);
 const id=body.recordId+':'+body.questionId;const cached=await (await budget(env,'cache',id)).json();if(cached.cached)return json({reply:cached.cached,source:'ai-cache',fictional:true});
 if(!(await budget(env,'ai')).ok)return json({error:'Limite diário de IA atingido. A explicação ilustrativa continua disponível.'},429);
 const record=records.find(r=>r.id===body.recordId);const question=questions.find(q=>q.id===body.questionId);const context=body.questionId==='resumo'?records.map(r=>({title:r.title,text:r.text,date:r.date})):record;
 try{const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:env.AI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:500,instructions:'Você é Lumi em uma demonstração com dados 100% fictícios. Responda em português brasileiro claro, acolhedor, em até 180 palavras. Comece indicando que este é um cenário fictício. Explique somente o contexto fornecido, não invente fatos, não faça diagnóstico, não recomende doses ou alterações de tratamento. Quando houver prescrição, diga que não tem validade clínica. Para preparar consulta, sugira perguntas sobre o cenário. Termine lembrando que não substitui a equipe de saúde.',input:JSON.stringify({question:question.label,fictionalContext:context})}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)return json({error:'A IA está indisponível. Use a explicação ilustrativa enquanto verificamos a conexão.'},502);
 const data=await response.json();const reply=data.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').slice(0,8000);if(!reply)throw Error();await budget(env,'save',id,reply);return json({reply,source:'ai',fictional:true});
 }catch{return json({error:'Não foi possível obter a resposta da IA agora. A explicação ilustrativa continua disponível.'},502);}
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'Uploads ao servidor e gravação de prontuários estão bloqueados.'},403);
 if(!['/','/index.html','/app.js','/style.css','/data.js','/favicon.svg'].includes(path))return json({error:'Rota indisponível.'},404);
 const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);for(const [k,v] of Object.entries(security))headers.set(k,v);return new Response(response.body,{status:response.status,headers});
}
export default {async fetch(request,env){try{return await handle(request,env);}catch{return json({error:'Demonstração temporariamente indisponível.'},503);}}};
