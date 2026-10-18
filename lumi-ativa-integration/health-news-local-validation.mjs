// Local validation only. Public source downloads; no credentials, AI calls or deployment.
// Install workerd@1.20261018.1 and set WORKERD_BIN to its binary if not on PATH.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {NEWS_DEMO_DIGEST as snapshot} from './health-news-ui-assets.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-news-runtime-'));
try{
 const pages=await Promise.all(snapshot.items.map(async item=>{
  const response=await fetch(item.url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Public fixture unavailable: '+response.status);
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw Error('Public fixture exceeds page limit');}chunks.push(value);}
  return {item,html:Buffer.concat(chunks).toString('utf8')};
 }));
 fs.writeFileSync(path.join(dir,'runtime-fixtures.mjs'),'export default '+JSON.stringify({snapshot,pages})+';');
 for(const [source,target] of [['./health-news-runtime-test.mjs','runtime-test.mjs'],['./health-news-runtime-test.capnp','runtime-test.capnp'],['./health-news-worker.mjs','health-news-worker.mjs'],['./health-news-ui-assets.mjs','health-news-ui-assets.mjs'],['../health-news-daily.mjs','health-news-daily.mjs'],['../health-news-verification.mjs','health-news-verification.mjs']])fs.copyFileSync(new URL(source,import.meta.url),path.join(dir,target));
 execFileSync(process.env.WORKERD_BIN||'workerd',['test','runtime-test.capnp'],{cwd:dir,stdio:'inherit',timeout:30000});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
