import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../ativa-demo/node_modules/jsdom/lib/api.js';
import assets from '../lumi-ativa-integration/assets.generated.mjs';
import {TOPICS,searchTopics} from '../companion-science/catalog.mjs';
import {packageWorker} from '../lumi-ativa-integration/package-worker.mjs';
test('daily routine is readable by default and tabs preserve a single visible section without requests',()=>{
 const dom=new JSDOM(assets['/lumi-original/lumi-mind-body.html'].content,{runScripts:'dangerously',url:'https://lumi-develop.psanchesnle.workers.dev/lumi-mind-body.html',beforeParse(w){w.fetch=()=>{throw Error('Unexpected request');};}});
 const d=dom.window.document;
 assert.equal(d.getElementById('routine').hidden,false);
 assert.match(d.getElementById('routine').textContent,/150 minutos semanais/);
 assert.match(d.getElementById('routine').textContent,/não foi testada como protocolo completo/);
 for(const id of ['mind','body','psych','routine']){d.getElementById(id+'Tab').click();for(const section of ['mind','body','psych','routine'])assert.equal(d.getElementById(section).hidden,section!==id);}
 assert.ok(d.querySelector('#lumiReturnNav a'));
 assert.equal(d.querySelectorAll('#routine a').length,5);
 dom.window.close();
});
test('routine is available in shared science and its runtime dependency is packaged',()=>{
 const r=searchTopics(TOPICS,'rotina diária').find(t=>t.id==='daily-routine');
 assert.ok(r);assert.match(r.text,/Em dias de maior cansaço ou OFF/);assert.match(r.limits,/não substitui avaliação individual/);
 assert.ok(packageWorker({type:'application/javascript+module',bytes:fs.readFileSync(new URL('../medical/recovered-development-baseline.js',import.meta.url))}).some(m=>m.name==='daily-routine.mjs'));
});
