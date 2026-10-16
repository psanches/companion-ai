import assert from 'node:assert/strict';
const origin='https://lumi-develop.psanchesnle.workers.dev';
const response=await fetch(origin+'/health-news',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200,'Existing news edition must remain readable');
const edition=await response.json();assert.equal(edition.policyVersion,3);assert.equal(edition.items.length,5);
for(const item of edition.items){assert.equal(item.dateVerified,true);assert.ok(item.publishedAt);assert.equal(item.language,'pt-BR');assert.equal(new URL(item.url).protocol,'https:');}
assert.ok(edition.items.some(item=>item.region==='Internacional'));
const page=await fetch(origin+'/noticias',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(page.status,200);assert.match(await page.text(),/Notícias de Saúde/);
console.log(JSON.stringify({publicNewsEditionVerified:true,date:edition.date,items:edition.items.length,mode:'read-only',cron:'preserved and compared during deploy; not manually invoked'}));
