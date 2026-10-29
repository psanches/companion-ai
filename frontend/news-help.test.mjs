import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import {installLumiLanguage} from './language.mjs';
import {NEWS_PREVIEW_POLICY,PARKINSON_SOURCE_CATALOG,GENERAL_SOURCES} from '../health-news-preview.mjs';
import {NEWS_WEEK} from '../health-news-week.mjs';
import {HEALTH_NEWS_CRON_UTC} from '../health-news-daily.mjs';
import assets from '../lumi-ativa-integration/assets.generated.mjs';
const html=assets['/lumi-original/index.html'].content;
const dictionary=JSON.parse(fs.readFileSync(new URL('./translations.json',import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const dom=new JSDOM(html,{url:'https://lumi-develop.psanchesnle.workers.dev',runScripts:'outside-only'});
 const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const script=[...w.document.scripts].find(s=>s.textContent.includes("const dialog=document.getElementById('lumiNewsHelpDialog')"));assert.ok(script);w.eval(script.textContent);return dom;
}
test('packaged help opens and closes without calling research or changing stored data',()=>{
 const dom=fixture();try{const w=dom.window,d=w.document;w.fetch=()=>assert.fail('Informational help must not call any API');w.localStorage.setItem('private-fixture','unchanged');
 const trigger=d.getElementById('lumiNewsHelpBtn'),dialog=d.getElementById('lumiNewsHelpDialog');assert.equal(trigger.getAttribute('aria-controls'),dialog.id);assert.equal(dialog.open,false);trigger.click();assert.equal(dialog.open,true);assert.equal(d.getElementById(dialog.getAttribute('aria-labelledby')).textContent,'Como pesquisamos as notícias de saúde');d.getElementById('lumiNewsHelpClose').click();assert.equal(dialog.open,false);assert.equal(d.activeElement,trigger);assert.equal(w.localStorage.getItem('private-fixture'),'unchanged');
 }finally{dom.window.close();}
});
test('help matches active editorial policy, source allowlists and finite update window',()=>{
 const dom=fixture();try{const d=dom.window.document,text=d.getElementById('lumiNewsHelpDialog').textContent;
 assert.match(text,new RegExp('de '+NEWS_PREVIEW_POLICY.minItems+' a '+NEWS_PREVIEW_POLICY.maxItems+' matérias completas'));assert.match(text,new RegExp('máximo '+NEWS_PREVIEW_POLICY.maxAgeDays+' dias'));assert.match(text,new RegExp('mínima de '+NEWS_PREVIEW_POLICY.minScore+' em 10'));
 for(const source of [...PARKINSON_SOURCE_CATALOG.map(x=>x.domain),...GENERAL_SOURCES])assert.ok([...d.querySelectorAll('#lumiNewsHelpDialog li')].some(x=>x.textContent.endsWith(source)),source);
 assert.equal(d.querySelectorAll('#lumiNewsHelpDialog li').length,PARKINSON_SOURCE_CATALOG.length+GENERAL_SOURCES.length);
 assert.match(NEWS_WEEK.start,/2026-10-28T00:00:00-03:00/);assert.match(NEWS_WEEK.end,/2026-11-04T00:00:00-03:00/);assert.equal(HEALTH_NEWS_CRON_UTC,'0 9 * * *');assert.match(text,/28\/10\/2026/);assert.match(text,/04\/11\/2026/);assert.match(text,/as 6h/);
 }finally{dom.window.close();}
});
test('all explanatory sections and controls translate into English and back',async()=>{
 const dom=fixture();try{const w=dom.window,d=w.document;const nodes=[...d.querySelectorAll('#lumiNewsHelpDialog h2,#lumiNewsHelpDialog h3,#lumiNewsHelpDialog p,#lumiNewsHelpDialog button,#lumiNewsHelpBtn')],originals=nodes.map(n=>n.textContent);
 for(const text of originals)assert.ok(dictionary[text],text);w.eval('('+installLumiLanguage.toString()+')('+JSON.stringify(dictionary)+')');await tick();w.LumiI18n.setLanguage('en');await tick();nodes.forEach((n,i)=>assert.equal(n.textContent,dictionary[originals[i]]));w.LumiI18n.setLanguage('pt-BR');await tick();nodes.forEach((n,i)=>assert.equal(n.textContent,originals[i]));
 }finally{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();}
});
