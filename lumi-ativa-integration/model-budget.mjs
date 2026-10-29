const encode=value=>new TextEncoder().encode(value);
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function signature(secret,value){const key=await crypto.subtle.importKey('raw',encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encode(value)));}
export async function reserveModelUsage(env,owner,options){
 if(!env?.LUMI_ATIVA_DEMO?.fetch||typeof env.LUMI_INTERNAL_BUDGET_SECRET!=='string'||env.LUMI_INTERNAL_BUDGET_SECRET.length<32||typeof owner!=='string'||!owner)throw Object.assign(Error('Serviço de limite de uso indisponível.'),{code:'LUMI_MODEL_UNAVAILABLE',status:503});
 const body=typeof options.body==='string'?options.body:'',payload=JSON.parse(body),bytes=encode(body).length;
 if(bytes>65536)throw Object.assign(Error('Esta mensagem e seu contexto estão muito longos. Inicie uma nova conversa.'),{code:'LUMI_MODEL_INPUT',status:413});
 const max=Number(payload.max_output_tokens);if(!Number.isInteger(max)||max<1||max>3200)throw Error('Unbounded model output');
 const ownerHash=await signature(env.LUMI_INTERNAL_BUDGET_SECRET,'owner:'+owner);
 const envelope=JSON.stringify({owner:ownerHash,id:crypto.randomUUID(),timestamp:Date.now(),tokens:bytes+max});
 let response;try{response=await env.LUMI_ATIVA_DEMO.fetch(new Request('https://budget.internal/internal/lumi-budget',{method:'POST',headers:{'content-type':'application/json','x-lumi-budget-signature':await signature(env.LUMI_INTERNAL_BUDGET_SECRET,envelope)},body:envelope,signal:AbortSignal.timeout(10000)}));}catch{throw Object.assign(Error('Não consegui verificar o limite de uso. Tente novamente.'),{code:'LUMI_MODEL_UNAVAILABLE',status:503});}
 if(response.status===429)throw Object.assign(Error('Limite de uso da IA atingido. Tente novamente mais tarde.'),{code:'LUMI_MODEL_LIMIT',status:429});
 let data;try{data=await response.json();}catch{}
 if(!response.ok||data?.allowed!==true)throw Object.assign(Error('Serviço de limite de uso indisponível.'),{code:'LUMI_MODEL_UNAVAILABLE',status:503});
}
export async function budgetedModelFetch(env,owner,url,options,fetcher=fetch){await reserveModelUsage(env,owner,options);return fetcher(url,options);}
