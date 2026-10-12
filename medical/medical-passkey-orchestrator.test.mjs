import test from "node:test";
import assert from "node:assert/strict";
import {beginMedicalPasskey,completeMedicalPasskey} from "./medical-passkey-orchestrator.js";

const identity={userId:"alice",sessionId:"verified-s1"};
const base={
  verifiedIdentity:identity,mode:"authenticate",
  store:{createChallenge:async()=>true},
  credentials:[],
  generateAuthenticationOptions:async()=>({challenge:"a".repeat(43)})
};
test("begin rejects missing verified identity",async()=>{
  assert.equal(await beginMedicalPasskey({...base,verifiedIdentity:null}),null);
});
test("begin rejects unverified session id",async()=>{
  assert.equal(await beginMedicalPasskey({...base,verifiedIdentity:{userId:"alice"}}),null);
});
test("begin uses development RP ID and verified user",async()=>{
  const seen=[];
  const result=await beginMedicalPasskey({
    ...base,
    store:{createChallenge:async record=>{seen.push(record);return true;}},
    generateAuthenticationOptions:async options=>{
      assert.equal(options.rpID,"mylumicompanion.com");
      return {challenge:"a".repeat(43)};
    }
  });
  assert.ok(result);
  assert.equal(seen[0].userId,"alice");
  assert.equal(seen[0].sessionId,"verified-s1");
});
test("complete rejects missing verified identity",async()=>{
  assert.equal(await completeMedicalPasskey({
    mode:"authenticate",response:{id:"credential"},challengeId:"x",
    verifiedIdentity:null
  }),false);
});
test("complete rejects unknown mode",async()=>{
  assert.equal(await completeMedicalPasskey({
    mode:"override",response:{id:"credential"},challengeId:"x",
    verifiedIdentity:identity
  }),false);
});
