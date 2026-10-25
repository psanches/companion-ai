import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';import {installLumiLanguage} from './language.mjs';
import {EMERGENCY_CONTACT_FRONTEND} from './emergency-contact.mjs';
const dictionary=JSON.parse(fs.readFileSync(new URL('./translations.json',import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(saved=null){
 const dom=new JSDOM('<html lang="pt-BR"><head><title>Companion AI</title></head><body><header class="app-header"><div class="header-actions"><button id="signInBtn">Sign in</button></div></header><button id="menu">📅 Agenda</button><input id="draft" placeholder="Mensagem para a Lumi..." value="Salvar"><div id="messages"><div class="msg user">Salvar</div><div class="msg assistant">CASA · FLOR · SOL</div><section id="lumiCalendarWeek" class="msg assistant"><button>Fechar agenda</button><article>Salvar</article></section></div><section id="lumiSosActions"><h3>Salvar</h3></section><div id="lumiBetaFeedbackDialog"><article><p>Salvar</p></article></div><p id="words">CASA · FLOR · SOL</p></body></html>',{url:'https://lumi-develop.psanchesnle.workers.dev',runScripts:'outside-only'});
 const w=dom.window;if(saved)w.localStorage.setItem('lumi-language-v1',saved);w.speechSynthesis={cancel(){}};
 w.supabaseClient={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}}};
 w.eval(EMERGENCY_CONTACT_FRONTEND);
 w.eval('('+installLumiLanguage.toString()+')('+JSON.stringify(dictionary)+')');await tick();return dom;
}
test('language selection persists, translates UI and dynamically added controls, and leaves user text and editable values intact',async()=>{
 const dom=await fixture();try{const w=dom.window,d=w.document;assert.equal(d.getElementById('signInBtn').textContent,'Entrar');
 w.LumiI18n.setLanguage('en');await tick();assert.equal(d.documentElement.lang,'en');assert.equal(d.getElementById('menu').textContent,'📅 Calendar');assert.equal(d.getElementById('draft').placeholder,'Message Lumi...');assert.equal(d.getElementById('draft').value,'Salvar');assert.equal(d.querySelector('#messages .user').textContent,'Salvar');assert.equal(d.querySelector('#messages .assistant').textContent,'CASA · FLOR · SOL');assert.equal(d.querySelector('#lumiCalendarWeek button').textContent,'Close calendar');assert.equal(d.querySelector('#lumiCalendarWeek article').textContent,'Salvar');assert.equal(d.querySelector('#lumiSosActions h3').textContent,'Salvar');assert.equal(d.querySelector('#lumiBetaFeedbackDialog article').textContent,'Salvar');assert.equal(d.getElementById('words').textContent,'HOUSE · FLOWER · SUN');
 const button=d.createElement('button');button.textContent='Salvar contato';d.body.append(button);await tick();assert.equal(button.textContent,'Save contact');
 w.LumiI18n.setLanguage('pt-BR');await tick();assert.equal(button.textContent,'Salvar contato');assert.equal(d.getElementById('words').textContent,'CASA · FLOR · SOL');assert.equal(w.localStorage.getItem('lumi-language-v1'),'pt-BR');
 }finally{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();}
});
test('saved English preference is applied on a fresh page and invalid values are ignored',async()=>{
 for(const [saved,expected]of [['en','en'],['pt-BR','pt-BR'],['<script>','pt-BR']]){const dom=await fixture(saved);try{assert.equal(dom.window.document.documentElement.lang,expected);const link=dom.window.document.getElementById('lumiSosSamuCall');assert.equal(link.getAttribute('href'),expected==='en'?'tel:911':'tel:192');assert.equal(link.textContent,expected==='en'?'Dial 911':'SAMU · 192');dom.window.LumiI18n.setLanguage(expected==='en'?'pt-BR':'en');await tick();assert.equal(link.getAttribute('href'),expected==='en'?'tel:192':'tel:911');dom.window.LumiI18n.setLanguage(expected);await tick();assert.equal(dom.window.document.getElementById('lumiLanguageSelect').value,expected);assert.equal(dom.window.LumiI18n.setLanguage('fr'),false);}finally{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();}}
});
