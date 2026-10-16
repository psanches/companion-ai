import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../../ativa-demo/node_modules/jsdom/lib/api.js';
import {NEWS_HTML,NEWS_SCRIPT} from '../health-news-ui-assets.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function setup(html=NEWS_HTML){const dom=new JSDOM(html,{url:'https://lumi-develop.psanchesnle.workers.dev/noticias',runScripts:'outside-only'});dom.window.AbortSignal=AbortSignal;return dom;}
test('homepage button has a visible label, links to reader and is not duplicated',()=>{
 const dom=setup('<html class="lumi-authenticated"><body><main class="app"><button id="lumiExerciseBtn">Mente e Corpo</button></main></body></html>');
 dom.window.eval(NEWS_SCRIPT);dom.window.eval(NEWS_SCRIPT);
 const button=dom.window.document.getElementById('lumiHealthNewsBtn');assert.equal(button.textContent,'📰 Notícias de Saúde');assert.equal(button.getAttribute('href'),'/noticias');assert.equal(button.nextElementSibling.id,'lumiExerciseBtn');assert.equal(dom.window.document.querySelectorAll('#lumiHealthNewsBtn').length,1);dom.window.close();
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
