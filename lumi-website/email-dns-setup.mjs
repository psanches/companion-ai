// Email DNS only. Never changes website addresses, Workers, routes or nameservers.
import fs from'node:fs';import assert from'node:assert/strict';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/lumi-institutional-refresh-20261017');
const request=JSON.parse(fs.readFileSync(new URL('./email-dns-request.json',import.meta.url)));assert.equal(request.domain,'mylumicompanion.com');assert.equal(request.mode,'apply-godaddy-email-only');
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;assert.ok(token&&account);
const origin='https://api.cloudflare.com/client/v4';
async function call(path,options={}){const r=await fetch(origin+path,{...options,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...options.headers},signal:AbortSignal.timeout(30000)});if(!r.ok){const error=new Error('Cloudflare email DNS access failed HTTP '+r.status);error.status=r.status;throw error;}const body=await r.json();assert.equal(body.success,true);return body.result;}
// Preview UUID evidence: read only, separate from mail DNS permissions.
try{const d=await call(`/accounts/${account}/workers/scripts/lumi-institutional-preview-20261017/deployments`);console.log(JSON.stringify({previewVersions:d.deployments?.[0]?.versions?.map(v=>({version:v.version_id,percentage:v.percentage}))}));}catch(e){console.log(JSON.stringify({previewVersionRead:e.message}));}
try{
 const zones=await call('/zones?name=mylumicompanion.com');assert.equal(zones.length,1,'Expected exact domain zone');const zone=zones[0];assert.equal(zone.name,'mylumicompanion.com');assert.equal(zone.status,'active');
 const base='/zones/'+zone.id+'/dns_records';const records=await call(base+'?per_page=500');assert.ok(records.length<500,'Unexpected large zone; audit required');
 const full=name=>name==='@'?'mylumicompanion.com':name+'.mylumicompanion.com';
 const desired=[
 {type:'TXT',name:full('@'),content:'T3448044'},
 {type:'TXT',name:full('@'),content:'v=spf1 include:secureserver.net -all'},
 {type:'TXT',name:full('_dmarc'),content:'v=DMARC1; p=reject; rua=mailto:dmarc_rua@onsecureserver.net; adkim=r; aspf=r;'},
 {type:'CNAME',name:full('email'),content:'email.secureserver.net',proxied:false},
 {type:'CNAME',name:full('secureserver1._domainkey'),content:'s1.dkim.mylumicompanion_com.710.onsecureserver.net',proxied:false},
 {type:'CNAME',name:full('secureserver2._domainkey'),content:'s2.dkim.mylumicompanion_com.710.onsecureserver.net',proxied:false},
 {type:'MX',name:full('@'),content:'smtp.secureserver.net',priority:0},
 {type:'MX',name:full('@'),content:'mailstore1.secureserver.net',priority:10},
 {type:'SRV',name:'_autodiscover._tcp.mylumicompanion.com',data:{priority:100,weight:1,port:443,target:'autodiscover.secureserver.net'}}
 ];
 const canonical=s=>s?.replace(/\.$/,'').replace(/^"|"$/g,'');
 // Preflight the ENTIRE change set before writing any record. Conflicts stop.
 const spf=records.filter(r=>r.type==='TXT'&&r.name===full('@')&&canonical(r.content).startsWith('v=spf1'));assert.ok(spf.length<=1,'Multiple SPF records require review');assert.ok(!spf.length||canonical(spf[0].content)==='v=spf1 include:secureserver.net -all','Existing SPF sender configuration requires review');
 for(const old of records.filter(r=>r.type==='MX'&&r.name===full('@')))assert.ok(desired.some(r=>r.type==='MX'&&canonical(r.content)===canonical(old.content)&&r.priority===old.priority),'Existing mail service requires owner review; no deletion performed');
 const tasks=[];
 for(const d of desired){
 let matches=records.filter(r=>r.type===d.type&&r.name===d.name);
 if(d.type==='TXT'&&d.name===full('@'))matches=matches.filter(r=>d.content.startsWith('v=spf1')?canonical(r.content).startsWith('v=spf1'):canonical(r.content)===d.content);
 if(d.type==='MX')matches=matches.filter(r=>canonical(r.content)===canonical(d.content));
 assert.ok(matches.length<=1,'Duplicate record requires review: '+d.name);
 if(d.type==='CNAME')assert.ok(!records.some(r=>r.name===d.name&&r.type!=='CNAME'),'Existing record at CNAME destination requires review');
 const old=matches[0];if(old&&d.type!=='TXT')assert.ok(d.type==='SRV'?JSON.stringify(old.data)===JSON.stringify(d.data):canonical(old.content)===canonical(d.content),'Conflicting destination requires review');
 if(old&&d.name===full('_dmarc'))assert.ok(canonical(old.content)===d.content||canonical(old.content)==='v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;','Unexpected DMARC requires review');
 const equal=old&&(d.type==='SRV'?JSON.stringify(old.data)===JSON.stringify(d.data):canonical(old.content)===canonical(d.content))&&(d.priority===undefined||old.priority===d.priority)&&(d.proxied===undefined||old.proxied===d.proxied);
 if(!equal)tasks.push({old,desired:d});
 }
 const protectedRecords=rs=>JSON.stringify(rs.filter(r=>!desired.some(d=>d.type===r.type&&d.name===r.name&&(d.type!=='TXT'||d.name!==full('@')||canonical(r.content).startsWith('v=spf1')||canonical(r.content)==='T3448044'))).map(r=>({id:r.id,type:r.type,name:r.name,content:r.content,proxied:r.proxied})).sort((a,b)=>a.id.localeCompare(b.id)));
 const before=protectedRecords(records);
 // Snapshot contains only public mail records, never credentials or private data.
 fs.mkdirSync(new URL('./test-results/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./test-results/email-dns-rollback.json',import.meta.url),JSON.stringify({domain:zone.name,before:tasks.map(({old,desired})=>({name:desired.name,type:desired.type,previous:old?{id:old.id,type:old.type,name:old.name,content:old.content,ttl:old.ttl,proxied:old.proxied,priority:old.priority,data:old.data}:null})),instruction:'Restore only these changed mail records; leave all website records unchanged.'},null,2));
 const applied=[];
 for(const {old,desired:d}of tasks){const body={...d,ttl:300};const path=old?base+'/'+old.id:base;const saved=await call(path,{method:old?'PATCH':'POST',body:JSON.stringify(body)});applied.push({id:saved.id,name:d.name,type:d.type,operation:old?'updated':'created'});fs.writeFileSync(new URL('./test-results/email-dns-applied.json',import.meta.url),JSON.stringify(applied,null,2));}
 const after=await call(base+'?per_page=500');assert.equal(protectedRecords(after),before,'Unrelated DNS records changed');console.log(JSON.stringify({emailDns:'configured',recordsApplied:applied.length,websiteRecordsUnchanged:true,mailboxDelivery:'not yet tested'}));
}catch(e){if(e.status===403){console.log(JSON.stringify({emailDns:'blocked',reason:'Existing Cloudflare token does not have DNS permissions. No broader token requested or secret exposed. Owner DNS access required.'}));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Email DNS setup blocked by existing token permissions. Use authenticated Cloudflare DNS access; no secrets were exposed.\n');}else throw e;}
