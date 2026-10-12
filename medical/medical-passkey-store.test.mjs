import test from "node:test";
import assert from "node:assert/strict";
import {MedicalPasskeyStore} from "./medical-passkey-store.js";

function fixture() {
  const db = new Map();
  const storage = {
    get:async key=>db.get(key),
    transaction:async fn=>fn({
      get:async key=>db.get(key),
      put:async(key,value)=>db.set(key,value),
      delete:async key=>db.delete(key)
    })
  };
  return new MedicalPasskeyStore({storage},{});
}
const challenge = ()=>({
  id:"ch-1",value:"a".repeat(43),userId:"alice",sessionId:"s1",
  purpose:"medical-step-up",issuedAt:100,expiresAt:120100
});
test("challenge can only be consumed once",async()=>{
  const store=fixture();
  assert.equal(await store.createChallenge(challenge()),true);
  assert.equal(await store.createChallenge(challenge()),false);
  assert.deepEqual(await store.consumeChallenge("ch-1"),challenge());
  assert.equal(await store.consumeChallenge("ch-1"),null);
});
test("reject malformed challenge",async()=>{
  const store=fixture();
  assert.equal(await store.createChallenge({...challenge(),expiresAt:900000}),false);
});
test("credential owner cannot be substituted",async()=>{
  const store=fixture();
  const credential={id:"cred",userId:"alice",publicKey:new Uint8Array([1]),counter:0};
  assert.equal(await store.saveCredential(credential),true);
  assert.equal(await store.saveCredential(credential),false);
  assert.equal(await store.getCredential("bob","cred"),null);
  assert.equal((await store.getCredential("alice","cred")).id,"cred");
});
test("counter must increase for nonzero authenticators",async()=>{
  const store=fixture();
  await store.saveCredential({id:"cred",userId:"alice",publicKey:new Uint8Array([1]),counter:4});
  assert.equal(await store.commitCounter("bob","cred",4,5),false);
  assert.equal(await store.commitCounter("alice","cred",4,4),false);
  assert.equal(await store.commitCounter("alice","cred",4,5),true);
  assert.equal(await store.commitCounter("alice","cred",4,6),false);
});
test("zero-counter authenticators may remain zero",async()=>{
  const store=fixture();
  await store.saveCredential({id:"cred",userId:"alice",publicKey:new Uint8Array([1]),counter:0});
  assert.equal(await store.commitCounter("alice","cred",0,0),true);
});
