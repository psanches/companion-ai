import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import './assert-isolated.mjs';
const root=fs.realpathSync(new URL('.',import.meta.url));
assert.equal(fs.realpathSync(process.cwd()),root,'Run only inside ativa-demo');
const secrets=['OPENAI_API_KEY','DEMO_ACCESS_CODE'];
for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID',...secrets])assert.ok(process.env[name]?.trim(),`Missing ${name}`);
assert.ok(process.env.DEMO_ACCESS_CODE.length>=20,'Access code must be at least 20 characters');
function wrangler(args,input){return new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--config','wrangler.jsonc'],{cwd:root,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['pipe','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',()=>reject(Error('Unable to start isolated deployment tool.')));child.on('exit',code=>{if(code!==0)return reject(Error(`Isolated Cloudflare operation failed (${code}); check token permissions/account configuration. No credential values logged.`));resolve(output);});child.stdin.end(input);});}
// The first deployment fails closed for AI until the new Worker secrets exist.
const output=await wrangler(['deploy']);
const match=output.match(/https:\/\/lumi-ativa-medical-demo\.[a-z0-9-]+\.workers\.dev\b/);
assert.ok(match,'Cloudflare deployment did not return the exact demo Worker URL');
const url=match[0];
for(const name of secrets)await wrangler(['secret','put',name],process.env[name]+'\n');
const request=async(path,options={})=>fetch(url+path,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});
const page=await request('/');assert.equal(page.status,200,'Demo page is not available');assert.match(await page.text(),/Dados 100% fictícios/);
for(const path of ['/medical/profile','/api/profile/medical','/history','/memory'])assert.equal((await request(path)).status,403,`Blocked route regressed: ${path}`);
const login=await request('/demo-api/session',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:JSON.stringify({code:process.env.DEMO_ACCESS_CODE})});assert.equal(login.status,200,'Private demo login failed');const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'No demo session issued');
const ai=await request('/demo-api/explain',{method:'POST',headers:{origin:url,cookie,'content-type':'application/json'},body:JSON.stringify({recordId:'consulta',questionId:'explicar'})});assert.equal(ai.status,200,'Hosted AI smoke check failed; inspect provider quota/key configuration privately');const answer=await ai.json();assert.equal(answer.fictional,true);assert.ok(answer.reply?.length,'No AI explanation returned');
console.log(`Isolated demo deployed and HTTP/AI checks passed: ${url}`);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n## Isolated Ativa preview\n\n${url}\n\nHTTP page, blocked medical routes, private session and live synthetic AI response verified. Actual Android/desktop visual checks remain pending.\n`);
