import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {installLumiLanguage} from './language.mjs';
import assets from '../lumi-ativa-integration/assets.generated.mjs';
const dictionary=JSON.parse(fs.readFileSync(new URL('./translations.json',import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const dom=new JSDOM(assets['/lumi-original/index.html'].content,{url:'https://lumi-develop.psanchesnle.workers.dev',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const script=[...w.document.scripts].find(s=>s.textContent.includes("const dialog=document.getElementById('lumiPrivacyDialog')"));assert.ok(script);w.eval(script.textContent);return dom;
}
test('privacy help does not access personal data or external services and restores accessible focus',()=>{
 const dom=fixture();try{
  const w=dom.window,d=w.document;w.fetch=()=>assert.fail('Privacy information must not call any service');w.localStorage.setItem('personal-fixture','unchanged');
  const trigger=d.getElementById('lumiPrivacyBtn'),dialog=d.getElementById('lumiPrivacyDialog');
  assert.equal(trigger.getAttribute('aria-controls'),dialog.id);trigger.click();assert.equal(dialog.open,true);d.getElementById('lumiPrivacyClose').click();assert.equal(dialog.open,false);assert.equal(d.activeElement,trigger);
  trigger.closest('aside').setAttribute('inert','');trigger.click();d.getElementById('lumiPrivacyClose').click();assert.equal(d.activeElement.id,'chatHistoryBtn');assert.equal(w.localStorage.getItem('personal-fixture'),'unchanged');
 }finally{dom.window.close();}
});
test('privacy status distinguishes active controls from unresolved integrity and retention issues in both languages',async()=>{
 const dom=fixture();try{
  const w=dom.window,d=w.document,nodes=[...d.querySelectorAll('#lumiPrivacyDialog h2,#lumiPrivacyDialog h3,#lumiPrivacyDialog p:not(:has(strong)),#lumiPrivacyDialog strong,#lumiPrivacyDialog button,#lumiPrivacyBtn')],originals=nodes.map(n=>n.textContent);
  for(const text of originals)assert.ok(dictionary[text],text);
  const text=d.getElementById('lumiPrivacyDialog').textContent;
  for(const phrase of ['não tem criptografia de ponta a ponta','não equivale a retenção zero','sobrescrever mensagens','não apaga automaticamente conversas','Cloudflare','Supabase','OpenAI','Google'])assert.ok(text.includes(phrase),phrase);
  w.eval('('+installLumiLanguage.toString()+')('+JSON.stringify(dictionary)+')');await tick();w.LumiI18n.setLanguage('en');await tick();nodes.forEach((n,i)=>assert.equal(n.textContent,dictionary[originals[i]]));w.LumiI18n.setLanguage('pt-BR');await tick();nodes.forEach((n,i)=>assert.equal(n.textContent,originals[i]));
 }finally{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();}
});
