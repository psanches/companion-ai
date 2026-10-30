import assert from 'node:assert/strict';
import {sharedScienceCatalog} from './shared-worker.mjs';
const url='https://lumi-develop.psanchesnle.workers.dev/companion-science/catalog';
const response=await fetch(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});
assert.equal(response.status,200);const catalog=await response.json();assert.deepEqual(catalog,sharedScienceCatalog());
assert.match(response.headers.get('cache-control'),/public/);
const head=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000)});assert.equal(head.status,200);assert.equal(await head.text(),'');
console.log(JSON.stringify({sharedScientificKnowledgeVerified:true,version:catalog.version,topics:catalog.topics.length,speechTherapyTopics:catalog.topics.filter(t=>t.category==='Fonoaudiologia').length,psychologyTopics:catalog.topics.filter(t=>t.category==='Psicologia e saúde emocional').length,doctoralRecords:catalog.doctoralResearch.length,mode:'read-only',modelCalls:0}));
