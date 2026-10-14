export const DEVELOPMENT_HOST='lumi-develop.psanchesnle.workers.dev';
export const DEMO_ORIGIN='https://lumi-ativa-medical-demo.psanchesnle.workers.dev';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
function response(body,status=200,type='application/json',extra={}){return new Response(body!==null && typeof body==='object' && !(body instanceof Uint8Array)?JSON.stringify(body):body,{status,headers:{...headers,'content-type':type,...extra}});}
async function limitedJson(request){if(!request.body)throw Error('empty');const reader=request.body.getReader();const chunks=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1024){await reader.cancel();throw Error('oversize');}chunks.push(value);}const all=new Uint8Array(length);let index=0;for(const chunk of chunks){all.set(chunk,index);index+=chunk.length;}return JSON.parse(new TextDecoder().decode(all));}
export function createLumiAtivaIntegration(original,assets,fetcher=fetch,researchRoute=null){if(!original||typeof original.fetch!=='function')throw Error('Verified existing Worker is required');return {...original,async fetch(request,env,ctx){const url=new URL(request.url);if(url.hostname!==DEVELOPMENT_HOST)return original.fetch.call(original,request,env,ctx);
 const sendDemo=(target,options)=>env?.LUMI_ATIVA_DEMO?env.LUMI_ATIVA_DEMO.fetch(new Request(target,{...options,signal:undefined})):fetcher(target,options);
 if(url.pathname==='/research' && researchRoute){return (await researchRoute(request,env)) ?? response({error:'Research unavailable'},503);}
 const path=url.pathname;const normalized=path.startsWith('/api/')?path.slice(4):path;
 if(normalized==='/medical'||normalized.startsWith('/medical/')||normalized==='/profile/medical'||normalized.startsWith('/profile/medical/'))return response({code:'MEDICAL_STEP_UP_REQUIRED',error:'Registros médicos reais continuam bloqueados.'},403);
 // Restore the original Lumi frontend as the default development experience.
 // The medical presentation remains isolated at /ativa.
 if(['GET','HEAD'].includes(request.method)&&(path==='/'||path==='/index.html'||['/app.js','/style.css','/manifest.json','/sw.js','/icon-192.png','/icon-512.png','/lumi-calendar-v2.js','/lumi-research.js','/lumi-mind-body.html'].includes(path))){
  const name=(path==='/'||path==='/index.html')?'index.html':path.slice(1);
  const asset=assets['/lumi-original/'+name];
  if(!asset)return response({error:'Lumi frontend asset missing'},503);
  const body=asset.encoding==='base64'?Uint8Array.from(atob(asset.content),c=>c.charCodeAt(0)):asset.content;
  return new Response(request.method==='HEAD'?null:body,{status:200,headers:{'content-type':asset.type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
 }
 if(path==='/ativa-status')return response({demo:'lumi-ativa-integration',fictional:true,backend:'isolated-synthetic-demo',originalBaselinePreserved:true,build:'lumi-ativa-local-v2',syntheticServiceBound:Boolean(env?.LUMI_ATIVA_DEMO)});
 if(path==='/demo-api/session'||path==='/demo-api/explain'){
  if(!['GET','POST','DELETE'].includes(request.method))return response({error:'Método não permitido.'},405);
  if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return response({error:'Origem não autorizada.'},403);
  if(path==='/demo-api/explain'&&request.method!=='POST')return response({error:'Método não permitido.'},405);
  let body;if(request.method==='POST'){try{const data=await limitedJson(request);if(path.endsWith('/session')){if(Object.keys(data).some(k=>k!=='code')||typeof data.code!=='string'||data.code.length>100)throw Error();body=JSON.stringify({code:data.code});}else{if(Object.keys(data).some(k=>!['recordId','questionId'].includes(k))||!['consulta','receita','laboratorio','fisio','historico'].includes(data.recordId)||!['resumo','explicar','consulta'].includes(data.questionId))throw Error();body=JSON.stringify({recordId:data.recordId,questionId:data.questionId});}}catch{return response({error:'Somente o código privado e perguntas do cenário fictício são aceitos.'},400);}}
  const upstreamHeaders={'content-type':'application/json',origin:DEMO_ORIGIN};const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)(ativa_session=[^;]+)/)?.[1];if(cookie)upstreamHeaders.cookie=cookie;
  try{const upstream=await sendDemo(DEMO_ORIGIN+path,{method:request.method,headers:upstreamHeaders,body,redirect:'manual',signal:AbortSignal.timeout(30000)});if(upstream.status>=300&&upstream.status<400)return response({error:'O servidor fictício retornou um redirecionamento inesperado.'},502);const h=new Headers(upstream.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);return new Response(upstream.body,{status:upstream.status,headers:h});}catch(error){return response({error:'A conexão com o demo está indisponível agora.',diagnostic:{stage:'synthetic-service',bound:Boolean(env?.LUMI_ATIVA_DEMO),errorType:typeof error?.name==='string'?error.name:'Error',category:['redirect','signal','Illegal invocation','unsupported','body','Response','fetch'].find(x=>String(error?.message||'').includes(x))||'unclassified'}},502);}
 }
 if(path.startsWith('/demo-api/'))return response({error:'Rota não permitida.'},404);
 if(path==='/ativa-medical'||path.startsWith('/ativa-medical/')){
  if(!['GET','HEAD'].includes(request.method))return response({error:'Upload ao servidor bloqueado.'},403);
  const target=(path==='/ativa-medical'||path==='/ativa-medical/')?'/ativa-medical/index.html':path;
  const asset=assets[target];if(!asset)return response({error:'Documento indisponível.'},404);
  return response(request.method==='HEAD'?null:asset.content,200,asset.type,{'x-frame-options':'SAMEORIGIN','content-security-policy':headers['content-security-policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});
 }
 const assetPath=(path==='/ativa'||path==='/ativa/')?'/ativa-ui/index.html':path;
 if(assetPath.startsWith('/ativa-ui/')){if(!['GET','HEAD'].includes(request.method))return response({error:'Gravação bloqueada.'},403);const asset=assets[assetPath];if(!asset)return response({error:'NOT_FOUND'},404);const bytes=asset.encoding==='base64'?Uint8Array.from(atob(asset.content),c=>c.charCodeAt(0)):asset.content;return response(request.method==='HEAD'?null:bytes,200,asset.type);}
 // Existing non-demo backend routes remain on their exact deployed baseline and bindings.
 return original.fetch.call(original,request,env,ctx);
 }};}
