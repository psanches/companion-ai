import test from "node:test";
import assert from "node:assert/strict";
import {authorizeMedicalRequest} from "./security-gate.js";

const request = new Request("https://dev.mylumicompanion.com/medical/profile", {
  headers:{"Authorization":"Bearer example"}
});
const good = {
  authenticate:async()=>({id:"alice"}),
  verifyStepUp:async()=>true,
  ownerId:async()=>"alice"
};
test("medical route allows authenticated owner after verified step-up",async()=>{
  assert.deepEqual(await authorizeMedicalRequest(request,{},good),{userId:"alice"});
});
test("medical route denies wrong owner even with valid step-up",async()=>{
  const r=await authorizeMedicalRequest(request,{},{
    ...good,ownerId:async()=>"bob"
  });
  assert.equal(r.status,403);
});
test("medical route rejects client supplied user identity",async()=>{
  const r=await authorizeMedicalRequest(request,{},{
    ...good,authenticate:async()=>null
  });
  assert.equal(r.status,401);
});
test("medical route rejects failed step-up",async()=>{
  const r=await authorizeMedicalRequest(request,{},{
    ...good,verifyStepUp:async()=>false
  });
  assert.equal(r.status,403);
});
test("medical route denies missing verifier configuration",async()=>{
  const r=await authorizeMedicalRequest(request,{},{
    authenticate:good.authenticate,ownerId:good.ownerId
  });
  assert.equal(r.status,503);
});
test("medical route fails closed when owner resolution throws",async()=>{
  const r=await authorizeMedicalRequest(request,{},{
    ...good,ownerId:async()=>{throw Error("unavailable");}
  });
  assert.equal(r.status,403);
});
