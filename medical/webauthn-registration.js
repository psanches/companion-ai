/**
 * Staging-only WebAuthn credential registration verification.
 * The caller must verify the Supabase JWT and session server-side first.
 * store.consumeChallenge MUST be atomic (Durable Object / transactional DB).
 * store.saveCredential MUST enforce unique credential IDs and owner isolation.
 * Never use plain KV get+delete as an atomic consume operation.
 */
export async function registerMedicalPasskey({
  response, userId, sessionId, challengeId, now = Date.now(),
  origin, rpID, store, verifyRegistrationResponse
}) {
  if (!userId || !sessionId || !challengeId ||
      typeof origin !== "string" || !origin.startsWith("https://") ||
      !rpID || typeof store?.consumeChallenge !== "function" ||
      typeof store?.saveCredential !== "function" ||
      typeof verifyRegistrationResponse !== "function") return false;
  try {
    const challenge = await store.consumeChallenge(challengeId);
    if (!challenge || challenge.purpose !== "passkey-registration" ||
        challenge.userId !== userId || challenge.sessionId !== sessionId ||
        !challenge.value || !Number.isFinite(challenge.expiresAt) ||
        !Number.isFinite(challenge.issuedAt) ||
        challenge.issuedAt > now || challenge.expiresAt <= now) return false;
    if ((challenge.origin && challenge.origin!==origin) ||
        (challenge.rpID && challenge.rpID!==rpID)) return false;
    const verification = await verifyRegistrationResponse({
      response, expectedChallenge: challenge.value,
      expectedOrigin: origin, expectedRPID: rpID,
      requireUserVerification: true
    });
    if (verification?.verified !== true) return false;
    const info = verification.registrationInfo;
    const credential = info?.credential;
    if (!info?.userVerified || !credential?.id ||
        !(credential.publicKey instanceof Uint8Array) ||
        !Number.isSafeInteger(credential.counter) ||
        credential.counter < 0) return false;
    return await store.saveCredential({
      userId, id: credential.id, publicKey: credential.publicKey,
      counter: credential.counter, transports: credential.transports || [],
      createdAt: now
    }) === true;
  } catch { return false; }
}
