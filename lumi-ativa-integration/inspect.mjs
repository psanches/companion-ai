import fs from 'node:fs';import {createHash} from 'node:crypto';
const target='lumi-develop';const account=process.env.CLOUDFLARE_ACCOUNT_ID;const token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare access is not configured.');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${target}`;
const get=async suffix=>{const r=await fetch(base+suffix,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Read-only development inspection failed: HTTP ${r.status}`);return r;};
const deployments=(await (await get('/deployments')).json()).result.deployments;
const versions=(await (await get('/versions')).json()).result.items;
const schedules=(await (await get('/schedules')).json()).result.schedules;
const settings=await (await get('/settings')).json();if(!settings.success)throw Error('Cannot inspect development settings');
const source=await get('/content/v2');const type=source.headers.get('content-type')||'';const entry=source.headers.get('cf-entrypoint');const modules=[];
if(type.includes('multipart/form-data')){for(const [name,file] of await source.formData()){if(typeof file==='string')continue;const text=file.type.includes('javascript')?await file.text():'';modules.push({name,type:file.type,size:file.size,sha256:createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),defaultExport:/export\s*(?:\{[^}]*default|default)/s.test(text),containsMedicalLock:/MEDICAL_STEP_UP_REQUIRED|MEDICAL_RECORDS_BLOCKED/.test(text),containsHtml:/<!doctype html|<html/i.test(text)});}}
else{const text=await source.text();modules.push({name:entry||'unknown',type,size:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),defaultExport:/export\s*(?:\{[^}]*default|default)/s.test(text),containsMedicalLock:/MEDICAL_STEP_UP_REQUIRED|MEDICAL_RECORDS_BLOCKED/.test(text),containsHtml:/<!doctype html|<html/i.test(text)});}
const report={deployments:deployments?.map(({id,created_on,source,versions})=>({id,created_on,source,versions})),versions:versions?.map(({id,number,metadata})=>({id,number,metadata})),schedules, target,mode:'read-only',entry,contentType:type.split(';')[0],modules,settings:{compatibility_date:settings.result.compatibility_date,compatibility_flags:settings.result.compatibility_flags,bindings:settings.result.bindings?.map(({name,type})=>({name,type})),hasAssets:Boolean(settings.result.assets),assetConfig:settings.result.assets?.config}};
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Read-only lumi-develop inspection\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\nNo source, secret values or patient data were logged/exported. No deployment was performed.\n');
