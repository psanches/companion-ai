import {DurableObject} from "cloudflare:workers";
import worker from "./development-worker-entry.js";
import {MedicalPasskeyStore as Store} from "./medical-passkey-store.js";

// Cloudflare RPC requires a class derived from DurableObject.
export class StagingMedicalPasskeyStore extends DurableObject {
  #store;
  constructor(ctx,env) {super(ctx,env);this.#store=new Store(ctx,env);}
  createChallenge(record) {return this.#store.createChallenge(record);}
  consumeChallenge(id) {return this.#store.consumeChallenge(id);}
  listCredentials(userId) {return this.#store.listCredentials(userId);}
  getCredential(userId,id) {return this.#store.getCredential(userId,id);}
  saveCredential(record) {return this.#store.saveCredential(record);}
  commitCounter(userId,id,oldCounter,newCounter) {
    return this.#store.commitCounter(userId,id,oldCounter,newCounter);
  }
}
export default worker;
