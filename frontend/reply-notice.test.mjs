import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {installReplyNotice,patchReplyNoticeChat} from './reply-notice.mjs';
const tick=()=>new Promise(r=>setTimeout(r,0));
async function fixture(){
 const dom=new JSDOM('<div id="lumiGuideDialog"><h2>Bem-vindo</h2><p>Olá! Sou a Lumi</p><button>Começar</button></div><div id="lumiDemoDialog"><h2>Conheça a Lumi</h2><p>Olá! Sou a Lumi, sua companheira</p><p>Outras informações</p></div><div id="messages"><div class="msg assistant" data-lumi-welcome="true">Bem-vindo</div></div>',{runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.LumiI18n={language:'pt-BR'};w.eval('('+installReplyNotice.toString()+')()');await tick();
 function add(role,text){const el=d.createElement('div');el.className='msg '+role;el.textContent=text;d.getElementById('messages').append(el);return el;}
 async function exchange(i){add('user','Question '+i);const reply=add('assistant','Answer '+i);w.dispatchEvent(new w.Event('lumi-chat-reply'));await tick();return reply;}
 return {dom,w,d,add,exchange};
}
test('welcome and every tenth completed exchange show the expanded notice; history and failed requests do not count',async()=>{
 const f=await fixture();const {d,w}=f;
 assert.match(d.querySelector('[data-lumi-welcome] small').textContent,/repositório de matérias especializadas/);
 assert.match(d.querySelector('#lumiGuideDialog small').textContent,/Consulte sempre/);
 assert.equal(d.querySelectorAll('#messages small').length,1);for(const id of ['lumiGuideDialog','lumiDemoDialog'])assert.equal(d.querySelector('#'+id+' > p').nextElementSibling.className,'lumi-reply-notice');
 for(let i=1;i<=20;i++){
  if(i===5){f.add('assistant','Restored history');f.add('system','Failed request');w.dispatchEvent(new w.Event('lumi-language-change'));await tick();}
  const reply=await f.exchange(i);assert.equal(reply.querySelectorAll('small').length,i%10===0?1:0,'exchange '+i);assert.equal(reply.firstChild.textContent,'Answer '+i);
 }
 assert.equal(d.querySelectorAll('#messages small').length,3);
 w.LumiI18n.language='en';w.dispatchEvent(new w.Event('lumi-language-change'));await tick();
 assert.match(d.querySelector('[data-lumi-notice-due] small').textContent,/repository of specialized articles/);
 assert.match(d.querySelector('[data-lumi-notice-due] small').textContent,/does not diagnose, prescribe/);
 w.dispatchEvent(new w.Event('lumi-session-change'));
 const afterReset=await f.exchange(1);assert.equal(afterReset.querySelectorAll('small').length,0);
 f.dom.window.close();
});
test('a new welcome restarts the cadence, and the chat emits only after successful reply handling',async()=>{
 const f=await fixture();for(let i=1;i<=9;i++)await f.exchange(i);
 const m=f.d.getElementById('messages');m.replaceChildren();const welcome=f.add('assistant','Bem-vindo novamente');welcome.dataset.lumiWelcome='true';await tick();
 const reply=await f.exchange(1);assert.equal(reply.querySelectorAll('small').length,0);
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),patched=patchReplyNoticeChat(source);
 assert.equal((patched.match(/dispatchEvent\(new Event\("lumi-chat-reply"\)\)/g)||[]).length,1);
 assert.ok(patched.indexOf('window.dispatchEvent(new Event("lumi-chat-reply"))')>patched.indexOf('form.onsubmit'));
 assert.throws(()=>patchReplyNoticeChat('unrecognized source'));
 f.dom.window.close();
});
