import {DOCTORAL_RESEARCH} from '../companion-science/doctoral-research.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {TOPICS,SOURCES,VERSION,CHECKED,searchTopics} from '../companion-science/catalog.mjs';
import {installScience} from '../companion-science/interface.mjs';

test('science entries identify evidence, limits and source metadata',()=>{
 assert.ok(TOPICS.length>=20);assert.equal(new Set(TOPICS.map(t=>t.id)).size,TOPICS.length);
 assert.ok(TOPICS.filter(t=>t.category==='Exercícios e reabilitação').length>=7);
 for(const t of TOPICS){for(const key of ['title','category','evidence','text','practice','limits'])assert.ok(t[key],t.id+' '+key);assert.ok(t.sources.length);for(const id of t.sources){const s=SOURCES[id];assert.ok(s?.kind&&s.year);assert.equal(new URL(s.url).protocol,'https:');}}
 assert.ok(Object.values(SOURCES).some(s=>s.doi));assert.ok(TOPICS.find(t=>t.id==='flexibility').evidence.includes('baixa'));
 assert.ok(TOPICS.find(t=>t.id==='protein').limits.includes('Não reduzir'));
});
test('search distinguishes known content from no match, respects accents and category',()=>{
 assert.equal(searchTopics(TOPICS,'proteínas')[0].id,'protein');
 assert.ok(searchTopics(TOPICS,'ON/OFF').some(t=>t.id==='on-off'));
 assert.ok(searchTopics(TOPICS,'equilíbrio').some(t=>t.id==='balance'));
 assert.equal(searchTopics(TOPICS,'abcxyz').length,0);
 assert.ok(searchTopics(TOPICS,'','Exercícios e reabilitação').every(t=>t.category==='Exercícios e reabilitação'));
});
test('local science navigation never sends a request, preserves drafts and clears on sign-out',async()=>{
 const dom=new JSDOM('<html class="lumi-authenticated"><body><main class="app"><section id="messages">Histórico</section><form id="chatForm"><textarea id="messageInput"></textarea></form></main><button id="sidebarNewChatBtn"></button><button id="lumiBrazilResearchBtn"></button></body></html>',{url:'https://lumi-develop.psanchesnle.workers.dev/',runScripts:'outside-only'});
 const w=dom.window,d=w.document;let calls=0;w.fetch=()=>{calls++;throw Error('Unexpected API call');};
 w.LumiI18n={language:'pt-BR'};
 w.eval('('+installScience.toString()+')(window.__data,window.__search)'.replace('window.__data',JSON.stringify({topics:TOPICS,sources:SOURCES,version:VERSION,checked:CHECKED,research:DOCTORAL_RESEARCH})).replace('window.__search','('+searchTopics.toString().replaceAll('normalize(','window.__normalize(')+')'));
 w.__normalize=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 // ready callback runs after __normalize exists.
 await new Promise(r=>w.addEventListener('load',r,{once:true}));
 const tabs=d.querySelectorAll('#companionTabs button');tabs[1].click();assert.equal(d.getElementById('companionScience').hidden,false);assert.notEqual(d.activeElement.id,'companionScienceSearch');d.getElementById('lumiBrazilResearchBtn').click();assert.equal(d.getElementById('companionDoctoralResearch').open,true);
 assert.equal(d.querySelectorAll('#companionDoctoralResearch [data-research]').length,6);assert.match(d.getElementById('companionDoctoralResearch').textContent,/não equivale/);
 assert.ok(d.getElementById('companionScience').classList.contains('science-research-view'));tabs[1].click();assert.equal(d.getElementById('companionScience').classList.contains('science-research-view'),false);
 const input=d.getElementById('companionScienceSearch');input.value='proteínas';input.dispatchEvent(new w.Event('input'));
 assert.equal(d.querySelectorAll('#companionScienceResults > details').length,1);
 const draft=d.getElementById('messageInput');
 d.querySelector('.science-direct').click();assert.match(draft.value,/^Companion: Proteínas e levodopa$/);assert.equal(calls,0);draft.value='';tabs[1].click();
 draft.value='Mensagem ainda não enviada';
 d.querySelector('.science-record button:not(.science-direct)').click();assert.equal(draft.value,'Mensagem ainda não enviada');
 draft.value='';d.querySelector('.science-record button:not(.science-direct)').click();assert.match(draft.value,/Proteínas e levodopa/);assert.equal(d.getElementById('companionScience').hidden,true);assert.equal(calls,0);
 tabs[1].click();d.getElementById('sidebarNewChatBtn').click();assert.equal(d.getElementById('companionScience').hidden,true);
 tabs[1].click();const q=d.getElementById('companionScienceSearch');q.value='desconhecidox';q.dispatchEvent(new w.Event('input'));assert.match(d.getElementById('companionScienceResults').textContent,/Nenhum assunto/);
 w.LumiI18n.language='en';w.dispatchEvent(new w.Event('lumi-language-change'));assert.match(tabs[1].textContent,/Science/);
 d.documentElement.classList.remove('lumi-authenticated');await new Promise(r=>setTimeout(r,0));assert.equal(d.getElementById('companionScience').hidden,true);assert.equal(d.getElementById('companionScienceSearch').value,'');
 assert.equal(calls,0);dom.window.close();
});

test('sources and evidence are explained without treating a Brazilian study as consensus',()=>{
 assert.match(SOURCES.apta.name,/Associação Americana de Fisioterapia/);assert.match(SOURCES.apta.about,/entidade profissional/);
 const local=TOPICS.find(t=>t.id==='ativa-parkinson');assert.match(local.limits,/não prova/);assert.match(SOURCES.ativa2015.kind,/congresso/);
 for(const t of TOPICS)assert.ok(t.evidenceDescription);
 assert.ok(TOPICS.find(t=>t.id==='voice-therapy').terms.some(t=>t.name==='LSVT LOUD'));
});

test('research deep link waits for authentication and opens the register without focusing search',async()=>{
 const dom=new JSDOM('<html><body><main class="app"><section id="messages"></section><form id="chatForm"><textarea id="messageInput">Rascunho preservado</textarea></form></main></body></html>',{url:'https://lumi-develop.psanchesnle.workers.dev/?companion=pesquisa-brasileira',runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.__catalog={topics:TOPICS,sources:SOURCES,version:VERSION,checked:CHECKED,research:DOCTORAL_RESEARCH};w.__lookup=()=>TOPICS;
 w.eval('('+installScience.toString()+')(window.__catalog,window.__lookup)');
 await new Promise(r=>w.addEventListener('load',r,{once:true}));assert.equal(d.getElementById('companionScience').hidden,true);
 d.documentElement.classList.add('lumi-authenticated');await new Promise(r=>setTimeout(r,0));
 assert.equal(d.getElementById('companionScience').hidden,false);assert.equal(d.getElementById('companionDoctoralResearch').open,true);assert.notEqual(d.activeElement.id,'companionScienceSearch');assert.equal(d.getElementById('messageInput').value,'Rascunho preservado');
 dom.window.close();
});
