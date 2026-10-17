import assert from 'node:assert/strict';
export async function verifyFeatureReturns(origin){
 assert.equal(origin,'https://lumi-develop.psanchesnle.workers.dev');
 for(const path of ['/lumi-mind-body.html','/ativa','/ativa-medical/']){
  const r=await fetch(origin+path,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);const html=await r.text();
  assert.match(html,/id="lumiReturnNav"/);assert.match(html,/<a href="\/" target="_top">← Voltar à Lumi<\/a>/);
  const cssPath=html.match(/href="(\/ativa-ui\/return\.[a-f0-9]+\.css)"/)[1];const css=await fetch(origin+cssPath,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(css.status,200);assert.match(await css.text(),/position:sticky/);
 }
 console.log(JSON.stringify({stage:'feature-return-navigation-verified',pages:3,directVisitSafe:true}));
}
