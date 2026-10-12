/**
 * Issue a short-lived, single-use WebAuthn challenge.
 * Caller MUST obtain userId and sessionId from a server-verified session.
 * store.createChallenge must persist atomically and reject duplicate IDs.
 * Use a transactional DB or Durable Object, NOT plain Cloudflare KV.
 */
export async function issuePasskeyChallenge({
  userId, sessionId, purpose, store, generateChallenge,
  randomId = () => crypto.randomUUID(), now = Date.now(),
  ttlMs = 120000
}) {
  if (typeof userId !== "string" || !userId ||
      typeof sessionId !== "string" || !sessionId ||
      !["passkey-registration","medical-step-up"].includes(purpose) ||
      typeof store?.createChallenge !== "function" ||
      typeof generateChallenge !== "function" ||
      !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(ttlMs) || ttlMs < 30000 || ttlMs > 300000)
    return null;
  try {
    const value = await generateChallenge();
    const id = randomId();
    if (typeof value !== "string" || value.length < 32 ||
        typeof id !== "string" || !id) return null;
    const record = {
      id, value, userId, sessionId, purpose,
      issuedAt: now, expiresAt: now + ttlMs
    };
    if (await store.createChallenge(record) !== true) return null;
    return {challengeId:id, challenge:value, expiresAt:record.expiresAt};
  } catch { return null; }
}
