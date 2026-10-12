import test from "node:test";
import assert from "node:assert/strict";
import {verifySupabaseMedicalIdentity} from "./supabase-verified-identity.js";
const config={
  supabaseUrl:"https://example-project.supabase.co",
  supabasePublishableKey:"public-test-key"
};
const req=(auth)=>new Request("https://dev.mylumicompanion.com/test",{
  headers:auth?{Authorization:auth}:{}
});
test("verified user is bound to bearer token hash",async()=>{
  const fetcher=async(url,options)=>{
    assert.equal(url,"https://example-project.supabase.co/auth/v1/user");
    assert.equal(options.headers.apikey,"public-test-key");
    return {ok:true,json:async()=>({id:"alice"})};
  };
  const a=await verifySupabaseMedicalIdentity(req("Bearer token-one"),{...config,fetcher});
  const b=await verifySupabaseMedicalIdentity(req("Bearer token-two"),{...config,fetcher});
  assert.equal(a.userId,"alice");
  assert.notEqual(a.sessionId,b.sessionId);
});
test("rejects absent bearer token",async()=>{
  assert.equal(await verifySupabaseMedicalIdentity(req(),config),null);
});
test("rejects untrusted Supabase URL",async()=>{
  assert.equal(await verifySupabaseMedicalIdentity(req("Bearer abc"),{
    ...config,supabaseUrl:"https://attacker.example"
  }),null);
});
test("rejects failed Supabase verification",async()=>{
  assert.equal(await verifySupabaseMedicalIdentity(req("Bearer abc"),{
    ...config,fetcher:async()=>({ok:false})
  }),null);
});
test("rejects missing verified user id",async()=>{
  assert.equal(await verifySupabaseMedicalIdentity(req("Bearer abc"),{
    ...config,fetcher:async()=>({ok:true,json:async()=>({})})
  }),null);
});
