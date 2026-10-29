import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {patchCalendarApp} from '../lumi-calendar/calendar-frontend.mjs';
const source=patchCalendarApp(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'));
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,15));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function fixture(){
 const dom=new JSDOM(html,{url:'https://lumi-develop.psanchesnle.workers.dev/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,listeners=[],calls=[];
 let owner='alice',route=async url=>Response.json(url.endsWith('history/archives')?{archives:[]}:{history:[]});
 const session=()=>owner?{access_token:'synthetic-'+owner,user:{id:owner}}:null;
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.Headers=Headers;w.AbortController=AbortController;w.AbortSignal=AbortSignal;w.alert=()=>{};w.confirm=()=>false;w.speechSynthesis={cancel(){},getVoices(){return [];},speak(){assert.fail('Voice defaults off');}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:session()}}),getUser:async()=>({data:{user:session()?.user}}),onAuthStateChange:fn=>{listeners.push(fn);return {};},signOut:async()=>{change(null);return {};}}})};
 function change(next,event=next?'SIGNED_IN':'SIGNED_OUT'){owner=next;for(const fn of listeners)fn(event,session());}
 w.fetch=async(url,options)=>{calls.push({url,options});return route(url,options);};
 w.eval(source);await tick();
 return {w,d:w.document,calls,change,setRoute:fn=>route=fn,close:()=>dom.window.close()};
}
for(const next of [null,'bob'])test('late successful chat cannot render, speak, persist or restore input after '+(next||'logout'),async()=>{
 const f=await fixture();try{const pending=deferred();let signal;f.setRoute(async(url,o)=>{if(url.endsWith('/chat')){signal=o.signal;return pending.promise;}return Response.json(url.endsWith('archives')?{archives:[]}:{history:[]});});
 f.d.getElementById('messageInput').value='private Alice request';const done=f.d.getElementById('chatForm').onsubmit({preventDefault(){}});await tick();assert.ok(signal);f.change(next);assert.equal(signal.aborted,true);assert.equal(f.d.getElementById('messages').textContent,'');await tick();pending.resolve(Response.json({reply:'private Alice answer',history:[{role:'assistant',content:'private Alice answer'}]}));await done;await tick();
 assert.doesNotMatch(f.d.body.textContent,/private Alice answer/);assert.doesNotMatch(f.w.localStorage.getItem('companion-ai-v2')||'',/private Alice/);assert.equal(f.d.getElementById('messageInput').value,'');
 }finally{f.close();}
});
test('old chat rejection cannot restore Alice draft or unlock a pending Bob submission',async()=>{
 const f=await fixture();try{const first=deferred(),second=deferred();let count=0;f.setRoute(async url=>url.endsWith('/chat')?(++count===1?first.promise:second.promise):Response.json(url.endsWith('archives')?{archives:[]}:{history:[]}));
 const form=f.d.getElementById('chatForm'),input=f.d.getElementById('messageInput');input.value='Alice secret';const a=form.onsubmit({preventDefault(){}});await tick();f.change('bob');await tick();input.value='Bob question';const b=form.onsubmit({preventDefault(){}});await tick();first.reject(Error('Alice secret error'));await a;assert.equal(form.dataset.sending,'true');assert.equal(input.value,'');assert.doesNotMatch(f.d.getElementById('messages').textContent,/Alice/);second.resolve(Response.json({reply:'Bob answer'}));await b;assert.match(f.d.getElementById('messages').textContent,/Bob answer/);assert.equal(form.dataset.sending,undefined);
 }finally{f.close();}
});
test('logout during response body decoding cannot fill a new memory dialog',async()=>{
 const f=await fixture();try{const body=deferred();let signal;f.setRoute(async(url,o)=>{if(url.endsWith('/memory')){signal=o.signal;const r=Response.json({});r.json=()=>body.promise;return r;}return Response.json(url.endsWith('archives')?{archives:[]}:{history:[]});});
 const loading=f.d.getElementById('memoryBtn').onclick();await tick();assert.equal(f.d.getElementById('memoryDialog').open,true);f.change('bob');assert.equal(signal.aborted,true);assert.equal(f.d.getElementById('memoryDialog').open,false);f.d.getElementById('memoryStatus').textContent='Bob current status';body.resolve({memory:'Alice private memory'});await loading;assert.equal(f.d.getElementById('memoryText').value,'');assert.equal(f.d.getElementById('memoryStatus').textContent,'Bob current status');
 }finally{f.close();}
});
test('a token refresh for the same owner keeps the pending chat valid',async()=>{
 const f=await fixture();try{const pending=deferred();let signal;f.setRoute(async(url,o)=>{signal=o.signal;return pending.promise;});f.d.getElementById('messageInput').value='Alice question';const done=f.d.getElementById('chatForm').onsubmit({preventDefault(){}});await tick();f.change('alice','TOKEN_REFRESHED');pending.resolve(Response.json({reply:'Same account answer'}));await done;assert.equal(signal.aborted,false);assert.match(f.d.getElementById('messages').textContent,/Same account answer/);
 }finally{f.close();}
});
test('account change closes private calendar form, clears drafts and settles its pending chat',async()=>{
 const f=await fixture();try{f.d.getElementById('messageInput').value='agende consulta amanhã às 14:00';const done=f.d.getElementById('chatForm').onsubmit({preventDefault(){}});await tick();const dialog=f.d.getElementById('lumiCalendarDialog');assert.equal(dialog.dataset.owner,'alice');f.w.lumiCalendarRememberForSignIn();assert.equal(JSON.parse(f.w.sessionStorage.getItem('lumiCalendarSignInDraft')).owner,'alice');f.change('bob');await done;assert.equal(f.d.getElementById('lumiCalendarDialog'),null);assert.equal(f.w.sessionStorage.getItem('lumiCalendarSignInDraft'),null);assert.doesNotMatch(f.d.getElementById('messages').textContent,/consulta/);
 }finally{f.close();}
});
test('draft resumption rejects a different verified owner and legacy ownerless drafts without API calls',async()=>{
 const f=await fixture();try{f.change('bob');await tick();const fields={title:'Alice private appointment',start:'01/11/2026 14:00',duration:'30',end:'',location:''};let calls=0;
 for(const owner of ['alice',undefined]){f.w.sessionStorage.setItem('lumiCalendarSignInDraft',JSON.stringify({owner,fields,expiresAt:Date.now()+600000}));await f.w.lumiResumeCalendarSignIn(async()=>{calls++;},'https://lumi.test/',async()=>({id:'bob'}));assert.equal(f.w.sessionStorage.getItem('lumiCalendarSignInDraft'),null);assert.equal(f.d.getElementById('lumiCalendarDialog'),null);}
 assert.equal(calls,0);
 }finally{f.close();}
});
test('a pending draft owner check cannot reopen Alice event after account switch',async()=>{
 const f=await fixture();try{const verified=deferred();f.w.sessionStorage.setItem('lumiCalendarSignInDraft',JSON.stringify({owner:'alice',fields:{title:'Alice draft'},expiresAt:Date.now()+600000}));let calls=0;const done=f.w.lumiResumeCalendarSignIn(async()=>{calls++;},'https://lumi.test/',()=>verified.promise);f.change('bob');verified.resolve({id:'alice'});await done;assert.equal(f.d.getElementById('lumiCalendarDialog'),null);assert.equal(f.w.sessionStorage.getItem('lumiCalendarSignInDraft'),null);assert.equal(calls,0);
 }finally{f.close();}
});
