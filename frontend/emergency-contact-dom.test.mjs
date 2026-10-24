import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {EMERGENCY_CONTACT_FRONTEND} from './emergency-contact.mjs';

async function fixture(){
 const dom=new JSDOM('<aside id="conversationSidebar"><button id="sidebarNewChatBtn">Nova conversa</button></aside>',{url:'https://lumi-develop.psanchesnle.workers.dev',runScripts:'outside-only'});
 const {window:w}=dom;let session=null;const callbacks=[];
 w.supabaseClient={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:cb=>callbacks.push(cb)}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(EMERGENCY_CONTACT_FRONTEND);
 const tick=()=>new Promise(resolve=>setImmediate(resolve));await tick();
 const auth=id=>{session=id?{user:{id}}:null;for(const cb of callbacks)cb('AUTH',session);};
 const open=async()=>{w.document.getElementById('lumiSosBtn').click();await tick();};
 const save=(name,phone)=>{w.document.getElementById('lumiSosName').value=name;w.document.getElementById('lumiSosPhone').value=phone;w.document.getElementById('lumiSosForm').dispatchEvent(new w.Event('submit',{cancelable:true}));};
 return {w,dom,auth,open,save};
}

test('SOS hides while signed out, scopes contacts by account, closes on logout/account change and keeps chat storage intact',async()=>{
 const f=await fixture();try{
  const {w,auth,open,save}=f,doc=w.document;assert.equal(doc.getElementById('lumiSosBtn').hidden,true);
  w.localStorage.setItem('companion-ai-v2','{"messages":[]}');
  auth('owner-a');await open();save('Contato fictício A','11999990000');
  assert.equal(doc.querySelector('#lumiSosActions h3').textContent,'Contato fictício A');
  assert.equal(doc.querySelector('#lumiSosActions button').hidden,true,'native sharing is hidden when unsupported');
  auth('owner-b');assert.equal(doc.getElementById('lumiSosDialog'),null);await open();
  assert.equal(doc.getElementById('lumiSosActions').hidden,true);assert.equal(doc.getElementById('lumiSosName').value,'');
  save('Contato fictício B','21999990000');assert.equal(doc.querySelector('#lumiSosCall').getAttribute('href'),'tel:+5521999990000');
  auth(null);assert.equal(doc.getElementById('lumiSosDialog'),null);assert.equal(doc.getElementById('lumiSosBtn').hidden,true);
  auth('owner-a');await open();assert.equal(doc.querySelector('#lumiSosActions h3').textContent,'Contato fictício A');
  assert.equal(w.localStorage.getItem('companion-ai-v2'),'{"messages":[]}');
 }finally{f.dom.window.close();}
});

test('SOS rejects invalid/blank entries and fails visibly if storage cannot save',async()=>{
 const f=await fixture();try{
  const {w,auth,open,save}=f,doc=w.document;auth('owner-a');await open();
  save('  ','11999990000');assert.match(doc.getElementById('lumiSosStatus').textContent,/nome/);
  save('Contato fictício','9999');assert.match(doc.getElementById('lumiSosStatus').textContent,/Confira o telefone/);
  assert.equal(w.localStorage.length,0);
  w.Storage.prototype.setItem=()=>{throw Error('denied');};
  save('Contato fictício','11999990000');assert.match(doc.getElementById('lumiSosStatus').textContent,/Não foi possível salvar/);
  assert.equal(doc.getElementById('lumiSosActions').hidden,true);
 }finally{f.dom.window.close();}
});

test('SOS renders a contact as text, does not send messages, and generic sharing contains only the fixed help text',async()=>{
 const f=await fixture();try{
  const {w,auth,open,save}=f,doc=w.document;let payload=null;
  w.navigator.share=async data=>{payload=data;};auth('owner-a');await open();save('<img src=x onerror=alert(1)>','11999990000');
  assert.equal(doc.querySelector('#lumiSosActions img'),null);
  assert.equal(doc.querySelector('#lumiSosActions h3').textContent,'<img src=x onerror=alert(1)>');
  assert.equal(payload,null);
  doc.querySelector('#lumiSosActions button').click();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(JSON.parse(JSON.stringify(payload)),{text:'Preciso de ajuda. Por favor, entre em contato comigo.'});
  assert.match(doc.getElementById('lumiSosStatus').textContent,/não confirma envio/);
 }finally{f.dom.window.close();}
});
