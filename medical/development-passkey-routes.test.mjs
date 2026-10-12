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
test("passkey routes reject authentication when Supabase unavailable",async()=>{
  const request=req("/medical/passkey/register/options");
  request.headers.set("Authorization","Bearer offline-test-token");
  let verificationCalls=0;
  const response=await handleDevelopmentPasskeyRoute(request,env,{id:"alice"},{
    fetcher:async(url,options)=>{
      verificationCalls++;
      assert.equal(url,"https://example.supabase.co/auth/v1/user");
      assert.equal(options.headers.Authorization,"Bearer offline-test-token");
      throw Error("offline");
    }
  });
  assert.equal(verificationCalls,1);
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{error:"AUTH_REQUIRED"});
});

test("development-origin responses include restricted CORS headers",async()=>{
  const response=await handleDevelopmentPasskeyRoute(
    req("/medical/passkey/register/options"),{}, {id:"alice"}
  );
  assert.equal(response.headers.get("access-control-allow-origin"),
    "https://dev.mylumicompanion.com");
  assert.equal(response.headers.get("vary"),"Origin");
});
test("rejected foreign origin never receives CORS permission",async()=>{
  const response=await handleDevelopmentPasskeyRoute(
    req("/medical/passkey/register/options","POST","https://evil.example"),
    env,{id:"alice"}
  );
  assert.equal(response.status,403);
  assert.equal(response.headers.get("access-control-allow-origin"),null);
});

const passkeyPaths=[
  "/medical/passkey/register/options",
  "/medical/passkey/register/complete",
  "/medical/passkey/authenticate/options",
  "/medical/passkey/authenticate/complete"
];
function authenticatedRequest(path,body="{}") {
  return new Request("https://lumi-develop.example"+path,{
    method:"POST",
    headers:{
      Origin:"https://dev.mylumicompanion.com",
      "content-type":"application/json",
      Authorization:"Bearer synthetic-test-token"
    },
    body
  });
}
function guardedEnvironment() {
  let storageCalls=0;
  return {
    environment:{...env,MEDICAL_PASSKEY_DO:{
      idFromName(){storageCalls++;throw Error("Unexpected storage access");},
      get(){storageCalls++;throw Error("Unexpected storage access");}
    }},
    storageCalls:()=>storageCalls
  };
}
for (const path of passkeyPaths) {
  test(path+" rejects a different Supabase identity before storage",async()=>{
    const guard=guardedEnvironment();
    let verificationCalls=0;
    const response=await handleDevelopmentPasskeyRoute(
      authenticatedRequest(path),guard.environment,{id:"alice"},{
        fetcher:async()=>{
          verificationCalls++;
          return Response.json({id:"bob"});
        }
      }
    );
    assert.equal(verificationCalls,1);
    assert.equal(response.status,401);
    assert.deepEqual(await response.json(),{error:"AUTH_REQUIRED"});
    assert.equal(guard.storageCalls(),0);
    assert.equal(response.headers.get("cache-control"),"no-store");
  });
  test(path+" rejects missing bearer before verification or storage",async()=>{
    const guard=guardedEnvironment();
    let verificationCalls=0;
    const response=await handleDevelopmentPasskeyRoute(
      req(path),guard.environment,{id:"alice"},{
        fetcher:async()=>{verificationCalls++;return Response.json({id:"alice"});}
      }
    );
    assert.equal(response.status,401);
    assert.deepEqual(await response.json(),{error:"AUTH_REQUIRED"});
    assert.equal(verificationCalls,0);
    assert.equal(guard.storageCalls(),0);
  });
  test(path+" rejects malformed JSON after identity verification",async()=>{
    const guard=guardedEnvironment();
    let verificationCalls=0;
    const response=await handleDevelopmentPasskeyRoute(
      authenticatedRequest(path,"{"),guard.environment,{id:"alice"},{
        fetcher:async()=>{verificationCalls++;return Response.json({id:"alice"});}
      }
    );
    assert.equal(verificationCalls,1);
    assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{error:"INVALID_JSON"});
    assert.equal(guard.storageCalls(),0);
  });
  test(path+" rejects oversized body without trusting content-length",async()=>{
    const guard=guardedEnvironment();
    const response=await handleDevelopmentPasskeyRoute(
      authenticatedRequest(path,JSON.stringify({data:"x".repeat(65536)})),
      guard.environment,{id:"alice"},{
        fetcher:async()=>Response.json({id:"alice"})
      }
    );
    assert.equal(response.status,413);
    assert.deepEqual(await response.json(),{error:"PAYLOAD_TOO_LARGE"});
    assert.equal(guard.storageCalls(),0);
  });
}
