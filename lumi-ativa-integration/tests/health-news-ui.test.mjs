import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../../ativa-demo/node_modules/jsdom/lib/api.js';
import {NEWS_HTML,NEWS_SCRIPT} from '../health-news-ui-assets.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function setup(html=NEWS_HTML){const dom=new JSDOM(html,{url:'https://lumi-develop.psanchesnle.workers.dev/noticias',runScripts:'outside-only'});dom.window.AbortSignal=AbortSignal;return dom;}
test('homepage button has a visible label, links to reader and is not duplicated',()=>{
 const dom=setup('<html class="lumi-authenticated"><body><main class="app"><button id="lumiExerciseBtn">Mente e Corpo</button></main></body></html>');
 dom.window.eval(NEWS_SCRIPT);dom.window.eval(NEWS_SCRIPT);
 const button=dom.window.document.getElementById('lumiHealthNewsBtn');assert.equal(button.textContent,'📰 Notícias de Saúde');assert.equal(button.getAttribute('href'),'/noticias');assert.equal(button.previousElementSibling.id,'lumiExerciseBtn');assert.equal(dom.window.document.querySelectorAll('#lumiHealthNewsBtn').length,1);dom.window.close();
});
test('reader renders Portuguese cards, original date and safe source links as text',async()=>{
 const dom=setup(),w=dom.window;
 w.fetch=async()=>Response.json({policyVersion:3,date:'2026-10-16',items:[{title:'<img src=x onerror=alert(1)> Estudo',summary:'Resumo em português.',publishedAt:'2026-10-14',region:'Internacional',source:'www.michaeljfox.org',url:'https://www.michaeljfox.org/news/test',dateVerified:true},{title:'Unsafe',summary:'Unsafe',publishedAt:'2026-10-14',url:'javascript:alert(1)',dateVerified:true}]});
 w.eval(NEWS_SCRIPT);await tick();
 assert.equal(w.document.querySelectorAll('.news-card').length,1);assert.equal(w.document.querySelector('.news-card img'),null);assert.match(w.document.querySelector('h2').textContent,/<img/);
 assert.match(w.document.querySelector('time').textContent,/14\/10\/2026/);assert.equal(w.document.querySelector('time').dateTime,'2026-10-14');assert.equal(w.document.querySelector('.news-source a').rel,'noopener noreferrer');assert.match(w.document.getElementById('newsEdition').textContent,/1 notícia verificada/);w.close();
});
test('unavailable edition has a retry action and never initiates paid generation',async()=>{
 const dom=setup(),w=dom.window,calls=[];w.fetch=async(url,options)=>{calls.push({url,options});return new Response('',{status:503});};
 w.eval(NEWS_SCRIPT);await tick();assert.match(w.document.getElementById('newsItems').textContent,/Não consegui carregar/);assert.equal(w.document.getElementById('newsReload').disabled,false);
 w.document.getElementById('newsReload').click();await tick();assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url==='/health-news'&&!c.options.method));w.close();
});

test('reused reading is visibly labelled and retains its original publication date',async()=>{
 const dom=setup(),w=dom.window;
 w.fetch=async()=>Response.json({policyVersion:4,date:'2026-10-29',items:[{title:'Matéria anterior',summary:'Resumo verificado.',publishedAt:'2026-10-27',region:'Internacional',source:'www.parkinson.org',url:'https://www.parkinson.org/blog/test/example',dateVerified:true,repeated:true}]});
 w.eval(NEWS_SCRIPT);await tick();assert.equal(w.document.querySelector('.news-repeat').textContent,'Reapresentada');assert.equal(w.document.querySelector('time').dateTime,'2026-10-27');assert.match(w.document.getElementById('newsEdition').textContent,/29\/10\/2026/);w.close();
});

test('current edition separates new and reused stories without changing original dates or triggering research',async()=>{
 const dom=setup(),w=dom.window,calls=[];
 const item={title:'Pesquisa',summary:'Resumo verificado.',publishedAt:'2026-10-29',region:'Internacional',source:'www.parkinson.org',url:'https://www.parkinson.org/blog/test/example',dateVerified:true};
 w.fetch=async(url,options)=>{calls.push({url,options});return Response.json({policyVersion:4,date:'2026-10-30',items:[{...item,repeated:true},{...item,url:'https://www.parkinson.org/blog/test/new',repeated:false}]});};
 w.eval(NEWS_SCRIPT);await tick();
 assert.deepEqual([...w.document.querySelectorAll('.news-group-title')].map(x=>x.textContent),['Novas nesta edição (1)','Leituras anteriores (1)']);
 assert.match(w.document.getElementById('newsEdition').textContent,/30\/10\/2026.*1 nova na Lumi.*1 reapresentada/);
 assert.ok([...w.document.querySelectorAll('time')].every(x=>x.dateTime==='2026-10-29'));
 assert.equal(w.document.querySelector('.news-source a').href,'https://www.parkinson.org/blog/test/new');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/health-news');assert.equal(calls[0].options.method,undefined);w.close();
});

test('MJFF pin and WHO updates remain visible with original dates when general collection fails',async()=>{
 const dom=setup(),w=dom.window;
 const official=(host,slug,date)=>({url:'https://www.'+host+'/news/'+slug,title:'Original source title',publishedAt:date,dateVerified:true,kind:'official-update',source:host,language:'en'});
 const mjff={...official('michaeljfox.org','pin','2026-06-18'),titlePt:'Avanços na pesquisa de Parkinson'},who={...official('who.int','update','2026-10-29'),titlePt:'Atualização de saúde pública'};
 w.fetch=async()=>Response.json({policyVersion:4,date:'2026-10-30',items:[],officialSources:{mjff,who:[who]},verification:{collectionError:'Research API error: 429 (insufficient_quota)'}});
 w.eval(NEWS_SCRIPT);await tick();
 assert.equal(w.document.querySelectorAll('.news-card').length,2);assert.match(w.document.getElementById('newsItems').textContent,/Michael J. Fox Foundation — destaque fixo/);assert.match(w.document.getElementById('newsItems').textContent,/Últimas atualizações da OMS/);
 assert.deepEqual([...w.document.querySelectorAll('.news-card h2')].map(x=>x.textContent),[mjff.titlePt,who.titlePt]);assert.doesNotMatch(w.document.getElementById('newsItems').textContent,/Original source title|Título original da fonte/);
 assert.equal(w.document.querySelector('time').dateTime,'2026-06-18');assert.match(w.document.getElementById('newsEdition').textContent,/Busca de novas matérias indisponível/);assert.match(w.document.getElementById('newsEdition').textContent,/2 atualizações diretas/);
 const translation=[...w.document.querySelectorAll('a')].find(a=>a.textContent==='Ler em português ↗');assert.equal(new URL(translation.href).searchParams.get('u'),mjff.url);assert.equal(translation.rel,'noopener noreferrer');w.close();
});
