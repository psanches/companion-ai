import test from "node:test";
import assert from "node:assert/strict";
import {createDevelopmentMedicalWorker,MedicalPasskeyStore} from "./development-worker-integration.js";

const origin="https://dev.mylumicompanion.com";
const paths=[
  "/medical/passkey/register/options","/medical/passkey/register/complete",
  "/medical/passkey/authenticate/options","/medical/passkey/authenticate/complete"
];
const request=(path,method="POST",headers={})=>new Request("https://dev.mylumicompanion.com"+path,{
  method,headers:{Origin:origin,...headers},
  ...(method==="POST"?{body:"{}"}:{})
});
function fixture() {
  let calls=0;
  const baseline={fetch(){calls++;return Response.json({baseline:true});}};
  return {worker:createDevelopmentMedicalWorker(baseline),calls:()=>calls};
}
test("integration requires reviewed baseline and exports Durable Object",()=>{
  assert.throws(()=>createDevelopmentMedicalWorker(null),TypeError);
  assert.equal(typeof MedicalPasskeyStore,"function");
});
test("existing routes preserve request env ctx and baseline receiver",async()=>{
  const req=request("/chat"),env={existing:true},ctx={existing:true};
  const expected=Response.json({baseline:true});
  const baseline={scheduled(){},fetch(r,e,c){
    assert.equal(this,baseline);
    assert.equal(r,req);assert.equal(e,env);assert.equal(c,ctx);
    return expected;
  }};
  const worker=createDevelopmentMedicalWorker(baseline);
  assert.equal(worker.scheduled,baseline.scheduled);
  assert.equal(await worker.fetch(req,env,ctx),expected);
});
for (const path of ["/profile/medical","/profile/medical/export","/profile/medical/upload"]) {
  for (const method of ["GET","PUT","DELETE","POST"]) {
    test(method+" "+path+" remains locked without touching baseline or storage",async()=>{
      const f=fixture();
      const env=new Proxy({}, {get(){throw Error("Medical storage must not be accessed");}});
      const response=await f.worker.fetch(request(path,method),env,{});
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,"MEDICAL_STEP_UP_REQUIRED");
      assert.equal(response.headers.get("cache-control"),"no-store");
      assert.equal(f.calls(),0);
    });
  }
}
for (const path of paths) {
  test(path+" allows only restricted development preflight",async()=>{
    const f=fixture();
    const response=await f.worker.fetch(request(path,"OPTIONS",{
      "Access-Control-Request-Method":"POST",
      "Access-Control-Request-Headers":"authorization, content-type"
    }),{},{});
    assert.equal(response.status,204);
    assert.equal(response.headers.get("access-control-allow-origin"),origin);
    assert.equal(response.headers.get("access-control-allow-methods"),"POST");
    assert.equal(f.calls(),0);
  });
  test(path+" rejects foreign origin without CORS",async()=>{
    const f=fixture();
    const response=await f.worker.fetch(request(path,"OPTIONS",{
      Origin:"https://evil.example","Access-Control-Request-Method":"POST"
    }),{},{});
    assert.equal(response.status,403);
    assert.equal(response.headers.get("access-control-allow-origin"),null);
    assert.equal(f.calls(),0);
  });
  test(path+" rejects unsupported preflight headers",async()=>{
    const f=fixture();
    const response=await f.worker.fetch(request(path,"OPTIONS",{
      "Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"x-user-id"
    }),{},{});
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,"PREFLIGHT_DENIED");
    assert.equal(f.calls(),0);
  });
  test(path+" denies unauthenticated POST and never delegates",async()=>{
    const f=fixture();
    const response=await f.worker.fetch(request(path),{
      SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public"
    },{});
    assert.equal(response.status,401);
    assert.deepEqual(await response.json(),{error:"AUTH_REQUIRED"});
    assert.equal(f.calls(),0);
  });
  test(path+" rejects GET",async()=>{
    const f=fixture();
    assert.equal((await f.worker.fetch(request(path,"GET"),{},{})).status,405);
    assert.equal(f.calls(),0);
  });
}
test("unknown passkey routes never fall through to existing Worker",async()=>{
  const f=fixture();
  assert.equal((await f.worker.fetch(request("/medical/passkey/unknown"),{},{})).status,404);
  assert.equal(f.calls(),0);
});
