// Read-only inspection. Never reads KV records or prints secret values.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/lumi-develop`;
async function get(suffix){const r=await fetch(base+suffix,{headers:{authorization:`Bearer ${token}`}});if(!r.ok)throw Error('Inspection HTTP '+r.status);return r;}
const settings=(await (await get('/settings')).json()).result;
console.log('CALENDAR_BINDINGS='+JSON.stringify(settings.bindings.map(({name,type})=>({name,type}))));
for(const [name,file] of await (await get('/content/v2')).formData()){
 if(typeof file==='string'||!name.includes('baseline'))continue;
 const text=(await file.text()).replace(/\\x([a-f0-9]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
 console.log('CALENDAR_SYMBOLS='+JSON.stringify([...text.matchAll(/(?:async )?function ([\w$]+)/g)].map(m=>m[1]).filter(x=>/calendar|google|auth|pending|confirm/i.test(x))));
 for(const term of ['Criação de eventos','temporariamente bloqueada','CONFIRMAR EVENTO','calendar/events','async function getGoogleAccessToken','async function createGoogleAuthUrl','async function finishGoogleAuth']){
  for(const m of text.matchAll(new RegExp(term,'g')))console.log('CALENDAR_GATE='+JSON.stringify({term,offset:m.index,code:text.slice(Math.max(0,m.index-500),m.index+5000)}));
 }
}

const app=await fetch('https://lumi-develop.psanchesnle.workers.dev/app.js?_calendar='+Date.now(),{cache:'no-store'});const appText=await app.text();
for(const term of ['async function getReply','calendar/events','CONFIRMAR EVENTO']){for(const m of appText.matchAll(new RegExp(term,'g')))console.log('CALENDAR_FRONTEND='+JSON.stringify({term,code:appText.slice(Math.max(0,m.index-400),m.index+5000)}));}
