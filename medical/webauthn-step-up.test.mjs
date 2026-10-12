import test from "node:test";
import assert from "node:assert/strict";
import {verifyMedicalPasskey} from "./webauthn-step-up.js";

const make = (overrides = {}) => {
  let used = false;
  const store = {
    async consumeChallenge() {
      if (used) return null;
      used = true;
      return {userId:"alice",sessionId:"session-a",purpose:"medical-step-up",
        value:"server-generated-challenge",issuedAt:100,expiresAt:1000};
    },
    async getCredential(userId,id) {
      return userId === "alice" && id === "credential-a"
        ? {userId,id,publicKey:new Uint8Array([1]),counter:4} : null;
    },
    async commitCounter(_user,_id,oldCounter,newCounter) {
      return oldCounter === 4 && newCounter === 5;
    }
  };
  const args = {
    userId:"alice",sessionId:"session-a",challengeId:"challenge-a",now:500,
    origin:"https://dev.mylumicompanion.com",rpID:"mylumicompanion.com",
    response:{id:"credential-a"},store,
    async verifyAuthenticationResponse(options) {
      assert.equal(options.expectedChallenge,"server-generated-challenge");
      assert.equal(options.requireUserVerification,true);
      assert.equal(options.expectedOrigin,"https://dev.mylumicompanion.com");
      return {verified:true,authenticationInfo:{userVerified:true,newCounter:5}};
    }, ...overrides
  };
  return args;
};
test("valid verified assertion passes only once", async () => {
  const args = make();
  assert.equal(await verifyMedicalPasskey(args),true);
  assert.equal(await verifyMedicalPasskey(args),false);
});
test("wrong user rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({userId:"bob"})),false);
});
test("wrong session rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({sessionId:"session-b"})),false);
});
test("missing authenticator rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({verifyAuthenticationResponse:null})),false);
});
test("invalid assertion rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({verifyAuthenticationResponse:async()=>({verified:false})})),false);
});
test("no user verification rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({verifyAuthenticationResponse:async()=>({
    verified:true,authenticationInfo:{userVerified:false,newCounter:5}
  })})),false);
});
test("counter storage failure rejected", async () => {
  const args = make();
  args.store.commitCounter = async()=>false;
  assert.equal(await verifyMedicalPasskey(args),false);
});
test("expired challenge rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({now:1001})),false);
});
test("other credential rejected", async () => {
  assert.equal(await verifyMedicalPasskey(make({response:{id:"credential-b"}})),false);
});
