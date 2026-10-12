import test from "node:test";
import assert from "node:assert/strict";
import {MedicalPasskeyStore} from "./medical-passkey-store.js";
import {handleDevelopmentPasskeyRoute} from "./development-passkey-routes.js";

test("credential listing only exposes credentials owned by user",async()=>{
  const records=new Map([
    ["credential:a",{id:"a",userId:"alice",transports:["internal"],publicKey:new Uint8Array([1]),counter:0}],
    ["credential:b",{id:"b",userId:"bob",publicKey:new Uint8Array([2]),counter:0}]
  ]);
  const store=new MedicalPasskeyStore({storage:{list:async()=>records}},{});
  assert.deepEqual(await store.listCredentials("alice"),[{id:"a",transports:["internal"]}]);
  assert.deepEqual(await store.listCredentials("bob"),[{id:"b",transports:[]}]);
  assert.deepEqual(await store.listCredentials(""),[]);
});
const env={MEDICAL_PASSKEY_DO:{},SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public"};
const req=(path,method="POST",origin="https://dev.mylumicompanion.com")=>
  new Request("https://lumi-develop.example"+path,{
    method,headers:{"Origin":origin,"content-type":"application/json"},
    ...(method==="POST"?{body:"{}"}:{})
  });
test("unknown passkey route is 404",async()=>{
  assert.equal((await handleDevelopmentPasskeyRoute(req("/unknown"),env,{id:"alice"})).status,404);
});
test("passkey routes reject unexpected origins",async()=>{
  assert.equal((await handleDevelopmentPasskeyRoute(req("/medical/passkey/register/options","POST","https://evil.example"),env,{id:"alice"})).status,403);
});
test("passkey routes reject GET",async()=>{
  assert.equal((await handleDevelopmentPasskeyRoute(req("/medical/passkey/register/options","GET"),env,{id:"alice"})).status,405);
});
test("passkey routes fail closed without binding",async()=>{
  assert.equal((await handleDevelopmentPasskeyRoute(req("/medical/passkey/register/options"),{}, {id:"alice"})).status,503);
});
test("passkey routes fail closed when Supabase unavailable",async()=>{
  const response=await handleDevelopmentPasskeyRoute(req("/medical/passkey/register/options"),env,{id:"alice"},{
    fetcher:async()=>{throw Error("offline")}
  });
  assert.equal(response.status,503);
});
