import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseVerifier} from './supabase-auth.mjs';

const env={SUPABASE_URL:'https://hjdrnxqvmpwfztlrqknp.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
test('validates access token with Supabase user endpoint, not browser assertions',async()=>{
 let request;
 const verify=createSupabaseVerifier({fetcher:async(url,options)=>{request={url,options};return Response.json({id:'verified-user'});}});
 assert.deepEqual(await verify('long-access-token',env),{id:'verified-user'});
 assert.equal(request.url,env.SUPABASE_URL+'/auth/v1/user');
 assert.equal(request.options.headers.authorization,'Bearer long-access-token');
 assert.equal(request.options.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
 assert.equal(request.options.redirect,'manual');
});
test('fails closed on invalid config, invalid token, errors, and invalid user',async()=>{
 let calls=0;
 const verify=createSupabaseVerifier({fetcher:async()=>{calls++;return Response.json({id:''});}});
 assert.equal(await verify('long-access-token',{}),null);
 assert.equal(await verify('short',env),null);
 assert.equal(await verify('long-access-token',{...env,SUPABASE_URL:'https://evil.example'}),null);
 assert.equal(calls,0);
 assert.equal(await verify('long-access-token',env),null);
 const denied=createSupabaseVerifier({fetcher:async()=>new Response(null,{status:401})});
 assert.equal(await denied('long-access-token',env),null);
 const down=createSupabaseVerifier({fetcher:async()=>{throw Error('private network error');}});
 assert.equal(await down('long-access-token',env),null);
});

// Model the deployed Worker transport rather than Node fetch alone.
test('Worker-compatible validation rejects redirects without forwarding credentials',async()=>{
 let calls=0;
 const verify=createSupabaseVerifier({fetcher:async(url,options)=>{
  calls++;assert.equal(options.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://foreign.example/'}});
 }});
 assert.equal(await verify('long-access-token',env),null);
 assert.equal(calls,1);
});
