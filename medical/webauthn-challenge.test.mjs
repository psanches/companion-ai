import test from "node:test";
import assert from "node:assert/strict";
import {issuePasskeyChallenge} from "./webauthn-challenge.js";
const setup=(override={})=>{
  let stored;
  return {args:{
    userId:"alice",sessionId:"session-a",purpose:"medical-step-up",
    now:100000,ttlMs:120000,randomId:()=>"unique-id",
    generateChallenge:async()=>"a".repeat(43),
    store:{createChallenge:async(record)=>{stored=record;return true;}},
    ...override
  },read:()=>stored};
};
test("issues challenge bound to authenticated user, session, purpose and expiry",async()=>{
  const {args,read}=setup();
  const response=await issuePasskeyChallenge(args);
  assert.deepEqual(response,{challengeId:"unique-id",challenge:"a".repeat(43),expiresAt:220000});
  assert.equal(read().userId,"alice");
  assert.equal(read().sessionId,"session-a");
  assert.equal(read().purpose,"medical-step-up");
});
test("rejects absent session",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({sessionId:""}).args),null);
});
test("rejects invalid purpose",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({purpose:"admin"}).args),null);
});
test("rejects overly long expiration",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({ttlMs:3600000}).args),null);
});
test("rejects weak or missing challenge",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({generateChallenge:async()=>"123"}).args),null);
});
test("rejects unavailable atomic storage",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({store:null}).args),null);
});
test("rejects failed persistence",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({store:{createChallenge:async()=>false}}).args),null);
});
test("rejects generator exceptions",async()=>{
  assert.equal(await issuePasskeyChallenge(setup({generateChallenge:async()=>{throw Error("failure");}}).args),null);
});
