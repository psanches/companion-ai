import test from "node:test";
import assert from "node:assert/strict";
import {getDevelopmentPasskeyContext} from "./development-passkey-context.js";
import {handlePasskeyTestPage} from "./passkey-test-page.js";
import {beginMedicalPasskey} from "./medical-passkey-orchestrator.js";
import {registerMedicalPasskey} from "./webauthn-registration.js";
import {verifyMedicalPasskey} from "./webauthn-step-up.js";
const origin="https://lumi-medical-security-staging.psanchesnle.workers.dev";
const rpID=new URL(origin).hostname;
test("staging context uses exact RP ID and rejects production",()=>{
 assert.equal(getDevelopmentPasskeyContext(origin).rpID,rpID);
 for(const unsafe of ["https://mylumicompanion.com","https://evil.example",origin+".evil.example","http://"+rpID])
  assert.equal(getDevelopmentPasskeyContext(unsafe),null);
});
test("staging registration persists challenge origin and RP ID",async()=>{
 let record;
 const result=await beginMedicalPasskey({
  verifiedIdentity:{userId:"alice",sessionId:"verified"},
  mode:"register",userName:"test-user",credentials:[],ceremonyOrigin:origin,
  store:{createChallenge:async r=>{record=r;return true;}},
  generateRegistrationOptions:async options=>{
   assert.equal(options.rpID,rpID);return {challenge:"a".repeat(43)};
  }
 });
 assert.ok(result);assert.equal(record.origin,origin);assert.equal(record.rpID,rpID);
});
test("test page loads without secrets and has strict cache/CSP headers",async()=>{
 const response=await handlePasskeyTestPage(new Request(origin+"/passkey-test"),{});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.ok(html.includes("Sign in"));
 assert.ok(html.includes("Registros médicos permanecem bloqueados"));
 assert.ok(html.includes("navigator.credentials.create"));
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.ok(response.headers.get("content-security-policy").includes("frame-ancestors 'none'"));
});
test("unconfigured test login returns 503",async()=>{
 assert.equal((await handlePasskeyTestPage(new Request(origin+"/passkey-test/config"),{})).status,503);
});
test("test configuration never exposes secret keys",async()=>{
 for(const key of ["sb_secret_synthetic", "service-role-synthetic"]){
  const response=await handlePasskeyTestPage(new Request(origin+"/passkey-test/config"),{
   SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:key
  });
  assert.equal(response.status,503);assert.equal((await response.text()).includes(key),false);
 }
});
test("test configuration only includes trusted public Supabase settings",async()=>{
 const response=await handlePasskeyTestPage(new Request(origin+"/passkey-test/config"),{
  SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic",
  OPENAI_API_KEY:"secret-must-not-appear"
 });
 assert.deepEqual(await response.json(),{supabaseUrl:"https://example.supabase.co",publishableKey:"sb_publishable_synthetic"});
});
test("test page refuses production host and non-GET requests",async()=>{
 assert.equal((await handlePasskeyTestPage(new Request("https://mylumicompanion.com/passkey-test"),{})).status,403);
 assert.equal((await handlePasskeyTestPage(new Request(origin+"/passkey-test",{method:"POST"}),{})).status,405);
});
for(const [mode,fn,purpose] of [
 ["registration",registerMedicalPasskey,"passkey-registration"],
 ["authentication",verifyMedicalPasskey,"medical-step-up"]
]){
 test(mode+" rejects cross-origin challenge before cryptography",async()=>{
  let calls=0;
  const store={consumeChallenge:async()=>({
   userId:"alice",sessionId:"verified",purpose,value:"a".repeat(43),
   issuedAt:1,expiresAt:2000,origin:"https://dev.mylumicompanion.com",rpID:"mylumicompanion.com"
  }),saveCredential:async()=>true,getCredential:async()=>null,commitCounter:async()=>true};
  const result=await fn({
   userId:"alice",sessionId:"verified",challengeId:"challenge",response:{id:"credential"},
   origin,rpID,now:1000,store,
   verifyRegistrationResponse:async()=>{calls++;return {verified:true};},
   verifyAuthenticationResponse:async()=>{calls++;return {verified:true};}
  });
  assert.equal(result,false);assert.equal(calls,0);
 });
}
