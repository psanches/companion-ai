/**
 * WebAuthn medical step-up adapter — staging only.
 * Supply @simplewebauthn/server's verifyAuthenticationResponse and a
 * transactionally backed challenge/credential store. Never trust client flags.
 *
 * Challenge store consume() MUST atomically delete a challenge on first use.
 * Credential counter updates MUST be serialized/atomic per credential.
 */
export async function verifyMedicalPasskey({
  response, userId, sessionId, challengeId, now = Date.now(),
  origin, rpID, store, verifyAuthenticationResponse
}) {
  if (!userId || !sessionId || !challengeId ||
      !origin?.startsWith("https://") || !rpID ||
      typeof store?.consumeChallenge !== "function" ||
      typeof store?.getCredential !== "function" ||
      typeof store?.commitCounter !== "function" ||
      typeof verifyAuthenticationResponse !== "function") return false;
  try {
    // consumeChallenge must be atomic and must return null after first call.
    const challenge = await store.consumeChallenge(challengeId);
    if (!challenge || challenge.userId !== userId ||
        challenge.sessionId !== sessionId ||
        challenge.purpose !== "medical-step-up" ||
        !Number.isFinite(challenge.expiresAt) ||
        challenge.expiresAt <= now || challenge.issuedAt > now ||
        !challenge.value) return false;
    const credentialId = response?.id;
    if (typeof credentialId !== "string" || !credentialId) return false;
    const credential = await store.getCredential(userId, credentialId);
    if (!credential || credential.userId !== userId ||
        credential.id !== credentialId || !credential.publicKey) return false;
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.value,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports
      }
    });
    if (result?.verified !== true || !result.authenticationInfo?.userVerified)
      return false;
    const newCounter = result.authenticationInfo.newCounter;
    if (!Number.isSafeInteger(newCounter) || newCounter < 0) return false;
    // Atomic compare-and-swap, including a policy for zero-counter authenticators.
    return await store.commitCounter(userId, credentialId, credential.counter, newCounter) === true;
  } catch {
    return false;
  }
}
