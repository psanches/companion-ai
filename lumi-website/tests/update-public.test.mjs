import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import bundle from '../bundle.generated.mjs';import {updatePublicWebsite} from '../update-public.mjs';

function fixture({failPage=false}={}){
 const old={...bundle,commit:'old-website',release:'old-release'};
 const router=fs.readFileSync(new URL('../public-worker.mjs',import.meta.url));
 let current=old,items=[{name:'public-worker.mjs',bytes:router},{name:'bundle.generated.mjs',bytes:Buffer.from('export default '+JSON.stringify(old)+';\n')}];
 const calls=[],mutations=[];const result=value=>Response.json({result:value});
 const domains=[{hostname:'mylumicompanion.com',service:'lumi-institutional-public'},{hostname:'app.mylumicompanion.com',service:'lumi-institutional-public'}];
 const settings={compatibility_date:'2026-10-16',bindings:[{name:'LEGACY_LUMI',type:'service',service:'companion-ai'}]};
 const fetchImpl=async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET';calls.push({path:u.pathname,host:u.hostname,method});
  if(u.hostname==='api.cloudflare.com'){
   const path=u.pathname.replace('/client/v4/accounts/account','');
   if(method!=='GET')mutations.push({path,method});
   if(path==='/workers/domains')return result(domains);
   const name=path.split('/')[3],target=name==='lumi-institutional-public';
   if(method==='PUT'){assert.equal(path,'/workers/scripts/lumi-institutional-public');const data=options.body;assert.deepEqual(JSON.parse(data.get('metadata')).bindings,settings.bindings);items=[];for(const [name,f]of data)if(typeof f!=='string')items.push({name,bytes:Buffer.from(await f.arrayBuffer())});current=JSON.parse(items.find(m=>m.name==='bundle.generated.mjs').bytes.toString().replace(/^export default /,'').replace(/;\s*$/,''));return result({id:'uploaded'});}
   if(method==='POST'){assert.equal(path,'/workers/scripts/lumi-institutional-public/deployments');assert.deepEqual(JSON.parse(options.body).versions,[{version_id:'old-version',percentage:100}]);return result({id:'restored'});}
   if(path.endsWith('/settings'))return result(target?settings:{bindings:[],compatibility_date:'2026-10-16'});
   if(path.endsWith('/schedules'))return result({schedules:[]});
   if(path.endsWith('/deployments'))return result({deployments:[{versions:[{version_id:'old-version',percentage:100}]}]});
   if(path.endsWith('/content/v2')){const form=new FormData();for(const m of target?items:[{name:'worker.js',bytes:Buffer.from('unchanged '+name)}])form.set(m.name,new File([m.bytes],m.name,{type:'application/javascript+module'}));return new Response(form);}
   throw Error('Unexpected API '+path);
  }
  if(u.hostname==='app.mylumicompanion.com')return new Response(null,{status:302,headers:{location:'https://mylumicompanion.com/?lumi_app=1'}});
  assert.equal(u.hostname,'mylumicompanion.com');
  if(u.searchParams.has('lumi_app'))return new Response('original application html');
  if(u.pathname==='/release.json')return Response.json({commit:current.commit,release:current.release});
  if(current.pages[u.pathname])return new Response(current.pages[u.pathname],{status:failPage&&current.commit===bundle.commit?503:200,headers:{'x-lumi-institutional-commit':current.commit}});
  if(current.assets[u.pathname])return new Response(Buffer.from(current.assets[u.pathname].body,'base64'));
  throw Error('Unexpected public URL');
 };
 return {calls,mutations,fetchImpl,current:()=>current};
}
const options={account:'account',token:'synthetic-token',commit:bundle.commit,ref:'refs/heads/feature/lumi-institutional-refresh-20261017',confirm:'UPDATE_EXISTING_PUBLIC_WEBSITE_ONLY',pause:async()=>{}};
test('public update replaces only website modules and preserves application and domain configuration',async()=>{
 const f=fixture();const result=await updatePublicWebsite({...options,fetchImpl:f.fetchImpl});
 assert.equal(result.updated,true);assert.equal(result.applicationHomepageUnchanged,true);assert.equal(result.domainsUntouched,true);
 assert.deepEqual(f.mutations,[{path:'/workers/scripts/lumi-institutional-public',method:'PUT'}]);
 assert.equal(f.current().commit,bundle.commit);
});
test('failed public page verification restores previous website modules and active version',async()=>{
 const f=fixture({failPage:true});await assert.rejects(updatePublicWebsite({...options,fetchImpl:f.fetchImpl}));
 assert.equal(f.current().commit,'old-website');
 assert.deepEqual(f.mutations.map(x=>x.method),['PUT','PUT','POST']);
 assert.ok(f.mutations.every(x=>x.path.startsWith('/workers/scripts/lumi-institutional-public')));
});
test('website update rejects unauthorized branch or missing confirmation before network access',async()=>{
 const f=fixture();for(const extra of [{ref:'refs/heads/main'},{confirm:''}])await assert.rejects(updatePublicWebsite({...options,...extra,fetchImpl:f.fetchImpl}));assert.equal(f.calls.length,0);
});
