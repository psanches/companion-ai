import test from "node:test";
import assert from "node:assert/strict";
import {handleRealDevelopmentPasskeyRequest} from "./development-passkey-real.js";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";

test("real SimpleWebAuthn entrypoints are installed and importable",()=>{
  for(const fn of [generateRegistrationOptions,generateAuthenticationOptions,
    verifyRegistrationResponse,verifyAuthenticationResponse]){
    assert.equal(typeof fn,"function");
  }
  assert.equal(typeof handleRealDevelopmentPasskeyRequest,"function");
});
test("real passkey handler never grants medical access without configuration",async()=>{
  const request=new Request("https://lumi-develop.example/medical/passkey/register/options",{
    method:"POST",headers:{Origin:"https://dev.mylumicompanion.com",
      "Content-Type":"application/json"},body:"{}"
  });
  const response=await handleRealDevelopmentPasskeyRequest(request,{}, {id:"user-test"});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,"PASSKEY_NOT_CONFIGURED");
});
