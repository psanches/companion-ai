import test from "node:test";
import assert from "node:assert/strict";
import {verifyMedicalPasskey} from "./webauthn-step-up.js";
import {registerMedicalPasskey} from "./webauthn-registration.js";
import {authorizeMedicalRequest} from "./security-gate.js";

const common={userId:"alice",sessionId:"s1",challengeId:"c1",now:50,
  origin:"https://dev.mylumicompanion.com",rpID:"mylumicompanion.com"};
const challenge=(purpose)=>({userId:"alice",sessionId:"s1",purpose,
  issuedAt:1,expiresAt:100,value:"server-challenge"});

test("concurrent authentication replay: only one succeeds with atomic consume",async()=>{
  let consumed=false;
  const store={
    async consumeChallenge(){if(consumed)return null;consumed=true;return challenge("medical-step-up");},
    async getCredential(){return {userId:"alice",id:"cred",publicKey:new Uint8Array([1]),counter:1};},
    async commitCounter(){return true;}
  };
  const args={...common,response:{id:"cred"},store,
    verifyAuthenticationResponse:async()=>({verified:true,authenticationInfo:{userVerified:true,newCounter:2}})};
  const results=await Promise.all([verifyMedicalPasskey(args),verifyMedicalPasskey(args)]);
  assert.deepEqual(results.sort(),[false,true]);
});
test("reject authentication with incorrect challenge purpose",async()=>{
  const store={
    consumeChallenge:async()=>challenge("passkey-registration"),
    getCredential:async()=>({userId:"alice",id:"cred",publicKey:new Uint8Array([1]),counter:1}),
    commitCounter:async()=>true
  };
  assert.equal(await verifyMedicalPasskey({...common,response:{id:"cred"},store,
    verifyAuthenticationResponse:async()=>({verified:true,authenticationInfo:{userVerified:true,newCounter:2}})}),false);
});
test("reject registration when storage reports duplicate credential",async()=>{
  const store={consumeChallenge:async()=>challenge("passkey-registration"),saveCredential:async()=>false};
  assert.equal(await registerMedicalPasskey({...common,response:{id:"cred"},store,
    verifyRegistrationResponse:async()=>({verified:true,registrationInfo:{
      userVerified:true,credential:{id:"cred",publicKey:new Uint8Array([1]),counter:0}}})}),false);
});
test("medical gate denies absent server-side authenticators",async()=>{
  const result=await authorizeMedicalRequest(new Request("https://example.test/medical"),{});
  assert.equal(result.status,503);
  assert.equal((await result.json()).error,"MEDICAL_SECURITY_NOT_CONFIGURED");
});
test("medical gate denies wrong owner despite successful passkey",async()=>{
  const result=await authorizeMedicalRequest(new Request("https://example.test/medical"),{},{
    authenticate:async()=>({id:"alice"}),verifyStepUp:async()=>true,ownerId:async()=>"bob"
  });
  assert.equal(result.status,403);
});
test("medical gate denies missing step-up despite correct owner",async()=>{
  const result=await authorizeMedicalRequest(new Request("https://example.test/medical"),{},{
    authenticate:async()=>({id:"alice"}),verifyStepUp:async()=>false,ownerId:async()=>"alice"
  });
  assert.equal(result.status,403);
});
