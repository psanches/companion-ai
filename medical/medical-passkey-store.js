/**
 * Cloudflare Durable Object: per-user passkey challenge and credential storage.
 * STAGING ONLY. Route requests through env.MEDICAL_PASSKEY_DO.idFromName(
 * serverVerifiedUserId). Never derive userId from request JSON.
 *
 * This class exposes methods to trusted Worker code via RPC. Do not expose a
 * public fetch API to it. Durable Object instances serialize storage
 * transactions; consumeChallenge is atomic under concurrent requests.
 *
 * IMPORTANT: Credentials are per-user here. A global uniqueness index and
 * recovery/revocation policy must be added before real-user deployment.
 */
export class MedicalPasskeyStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async createChallenge(record) {
    if (!record || typeof record.id !== "string" || !record.id ||
        typeof record.value !== "string" || record.value.length < 32 ||
        !record.userId || !record.sessionId ||
        !["medical-step-up", "passkey-registration"].includes(record.purpose) ||
        !Number.isSafeInteger(record.expiresAt) ||
        !Number.isSafeInteger(record.issuedAt) ||
        record.expiresAt <= record.issuedAt ||
        record.expiresAt - record.issuedAt > 300000) return false;
    return this.ctx.storage.transaction(async tx => {
      const key = "challenge:" + record.id;
      if (await tx.get(key)) return false;
      await tx.put(key, record);
      return true;
    });
  }

  async consumeChallenge(challengeId) {
    if (typeof challengeId !== "string" || !challengeId) return null;
    return this.ctx.storage.transaction(async tx => {
      const key = "challenge:" + challengeId;
      const value = await tx.get(key);
      if (!value) return null;
      await tx.delete(key);
      return value;
    });
  }

  async listCredentials(userId) {
    if (typeof userId !== "string" || !userId) return [];
    const entries = await this.ctx.storage.list({prefix:"credential:"});
    return [...entries.values()]
      .filter(c => c && c.userId === userId)
      .map(c => ({id:c.id, transports:Array.isArray(c.transports)?c.transports:[]}));
  }

  async getCredential(userId, credentialId) {
    if (!userId || !credentialId) return null;
    const value = await this.ctx.storage.get("credential:" + credentialId);
    return value?.userId === userId ? value : null;
  }

  async saveCredential(credential) {
    if (!credential?.userId || !credential?.id ||
        !(credential.publicKey instanceof Uint8Array) ||
        !Number.isSafeInteger(credential.counter) ||
        credential.counter < 0) return false;
    return this.ctx.storage.transaction(async tx => {
      const key = "credential:" + credential.id;
      if (await tx.get(key)) return false;
      await tx.put(key, credential);
      return true;
    });
  }

  async commitCounter(userId, credentialId, oldCounter, newCounter) {
    if (!userId || !credentialId ||
        !Number.isSafeInteger(oldCounter) ||
        !Number.isSafeInteger(newCounter) ||
        oldCounter < 0 || newCounter < 0) return false;
    return this.ctx.storage.transaction(async tx => {
      const key = "credential:" + credentialId;
      const record = await tx.get(key);
      if (!record || record.userId !== userId ||
          record.counter !== oldCounter ||
          !(newCounter > oldCounter || (oldCounter === 0 && newCounter === 0)))
        return false;
      await tx.put(key, {...record, counter:newCounter});
      return true;
    });
  }
}
