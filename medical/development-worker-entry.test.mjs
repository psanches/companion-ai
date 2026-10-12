import test from "node:test";
import assert from "node:assert/strict";
import baseline from "./recovered-development-baseline.js";
import worker from "./development-worker-entry.js";

test("recovered baseline and integrated entry preserve health response",async()=>{
  for (const candidate of [baseline,worker]) {
    const response=await candidate.fetch(new Request("https://dev.mylumicompanion.com/"),{},{});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{status:"ok",message:"Lumi API funcionando"});
  }
});
test("existing protected chat still requires authentication",async()=>{
  const env={Memory:{},SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public"};
  for (const candidate of [baseline,worker]) {
    const response=await candidate.fetch(new Request("https://dev.mylumicompanion.com/api/chat",{
      method:"POST",body:"{}"
    }),env,{});
    assert.equal(response.status,401);
  }
});
for (const prefix of ["","/api"]) {
  for (const suffix of ["","/export","/upload"]) {
    test(prefix+"/profile/medical"+suffix+" stays locked in integrated entry",async()=>{
      const env=new Proxy({}, {get(){throw Error("Must not access any medical bindings");}});
      const response=await worker.fetch(new Request("https://dev.mylumicompanion.com"+prefix+"/profile/medical"+suffix),env,{});
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,"MEDICAL_STEP_UP_REQUIRED");
    });
  }
  test(prefix+" passkey routes require authenticated identity",async()=>{
    const response=await worker.fetch(new Request("https://dev.mylumicompanion.com"+prefix+"/medical/passkey/register/options",{
      method:"POST",headers:{Origin:"https://dev.mylumicompanion.com"},body:"{}"
    }),{},{});
    assert.equal(response.status,401);
    assert.deepEqual(await response.json(),{error:"AUTH_REQUIRED"});
  });
}
