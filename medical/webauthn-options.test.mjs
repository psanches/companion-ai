import test from "node:test";
import assert from "node:assert/strict";
import {createPasskeyOptions} from "./webauthn-options.js";

function fixture(overrides={}) {
  let stored;
  return {
    args:{
      mode:"register",userId:"alice",sessionId:"verified-session",
      userName:"alice@example.test",now:1000,ttlMs:120000,
      randomId:()=>"challenge-id",
      store:{async createChallenge(v){stored=v;return true;}},
      generateRegistrationOptions:async opts=>{
        assert.equal(opts.authenticatorSelection.userVerification,"required");
        assert.equal(opts.rpID,"mylumicompanion.com");
        return {challenge:"a".repeat(43)};
      },
      generateAuthenticationOptions:async opts=>{
        assert.equal(opts.userVerification,"required");
        return {challenge:"b".repeat(43)};
      },
      ...overrides
    },
    stored:()=>stored
  };
}
test("registration persists exact browser challenge",async()=>{
  const {args,stored}=fixture();
  const r=await createPasskeyOptions(args);
  assert.equal(r.options.challenge,stored().value);
  assert.equal(stored().purpose,"passkey-registration");
  assert.equal(stored().sessionId,"verified-session");
});
test("authentication persists distinct medical step-up purpose",async()=>{
  const {args,stored}=fixture({mode:"authenticate"});
  const r=await createPasskeyOptions(args);
  assert.equal(r.options.challenge,stored().value);
  assert.equal(stored().purpose,"medical-step-up");
});
test("missing authenticated user fails closed",async()=>{
  assert.equal(await createPasskeyOptions(fixture({userId:""}).args),null);
});
test("missing session fails closed",async()=>{
  assert.equal(await createPasskeyOptions(fixture({sessionId:""}).args),null);
});
test("invalid generator result fails closed",async()=>{
  assert.equal(await createPasskeyOptions(fixture({
    generateRegistrationOptions:async()=>({challenge:"short"})
  }).args),null);
});
test("failed persistence fails closed",async()=>{
  assert.equal(await createPasskeyOptions(fixture({
    store:{createChallenge:async()=>false}
  }).args),null);
});
test("invalid mode fails closed",async()=>{
  assert.equal(await createPasskeyOptions(fixture({mode:"reset-password"}).args),null);
});
