import test from "node:test";
import assert from "node:assert/strict";
import {registerMedicalPasskey} from "./webauthn-registration.js";

function setup(overrides={}) {
  let consumed=false, saved=0;
  const store={
    async consumeChallenge() {
      if(consumed) return null;
      consumed=true;
      return {purpose:"passkey-registration",userId:"alice",sessionId:"session-a",
        value:"challenge",issuedAt:10,expiresAt:1000};
    },
    async saveCredential(credential) {
      assert.equal(credential.userId,"alice");
      saved++;
      return true;
    }
  };
  return {args:{
    response:{id:"credential-a"},userId:"alice",sessionId:"session-a",
    challengeId:"challenge-id",now:500,origin:"https://dev.mylumicompanion.com",
    rpID:"mylumicompanion.com",store,
    async verifyRegistrationResponse({expectedChallenge,requireUserVerification}) {
      assert.equal(expectedChallenge,"challenge");
      assert.equal(requireUserVerification,true);
      return {verified:true,registrationInfo:{userVerified:true,
        credential:{id:"credential-a",publicKey:new Uint8Array([1,2]),counter:0}}};
    },...overrides
  },getSaved:()=>saved};
}
test("valid registration is single-use",async()=>{
  const {args,getSaved}=setup();
  assert.equal(await registerMedicalPasskey(args),true);
  assert.equal(await registerMedicalPasskey(args),false);
  assert.equal(getSaved(),1);
});
test("reject wrong account",async()=>{
  assert.equal(await registerMedicalPasskey(setup({userId:"bob"}).args),false);
});
test("reject wrong session",async()=>{
  assert.equal(await registerMedicalPasskey(setup({sessionId:"other"}).args),false);
});
test("reject expired challenge",async()=>{
  assert.equal(await registerMedicalPasskey(setup({now:1001}).args),false);
});
test("reject failed cryptographic verification",async()=>{
  assert.equal(await registerMedicalPasskey(setup({verifyRegistrationResponse:async()=>({verified:false})}).args),false);
});
test("reject absent user verification",async()=>{
  assert.equal(await registerMedicalPasskey(setup({verifyRegistrationResponse:async()=>({
    verified:true,registrationInfo:{userVerified:false,
      credential:{id:"credential-a",publicKey:new Uint8Array([1]),counter:0}}
  })}).args),false);
});
test("reject missing persistent store",async()=>{
  assert.equal(await registerMedicalPasskey(setup({store:null}).args),false);
});
test("reject insecure origin",async()=>{
  assert.equal(await registerMedicalPasskey(setup({origin:"http://example.com"}).args),false);
});
