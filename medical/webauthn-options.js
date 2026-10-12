/**
 * Build browser WebAuthn options and persist their exact challenges.
 * STAGING ONLY. The caller must verify the Supabase JWT and derive sessionId
 * from the verified session; never accept either from request JSON.
 *
 * optionsGenerator should be @simplewebauthn/server's
 * generateRegistrationOptions or generateAuthenticationOptions, respectively.
 * The challenge store must be transactional (e.g. Durable Object), not KV.
 */
export async function createPasskeyOptions({
  mode, userId, sessionId, userName, credentialList = [],
  rpName = "Lumi Development", rpID = "mylumicompanion.com", origin,
  store, generateRegistrationOptions, generateAuthenticationOptions,
  randomId = () => crypto.randomUUID(), now = Date.now(), ttlMs = 120000
}) {
  if (!["register", "authenticate"].includes(mode) ||
      !userId || !sessionId || !rpID || !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(ttlMs) || ttlMs < 30000 || ttlMs > 300000 ||
      typeof store?.createChallenge !== "function" ||
      !Array.isArray(credentialList)) return null;
  try {
    let options;
    if (mode === "register") {
      if (typeof generateRegistrationOptions !== "function" ||
          typeof userName !== "string" || !userName) return null;
      options = await generateRegistrationOptions({
        rpName, rpID, userName, userDisplayName: userName,
        userID: new TextEncoder().encode(userId),
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required"
        },
        excludeCredentials: credentialList.map(c => ({
          id: c.id, transports: c.transports || []
        }))
      });
    } else {
      if (typeof generateAuthenticationOptions !== "function") return null;
      options = await generateAuthenticationOptions({
        rpID, userVerification: "required",
        allowCredentials: credentialList.map(c => ({
          id: c.id, transports: c.transports || []
        }))
      });
    }
    if (typeof options?.challenge !== "string" ||
        options.challenge.length < 32) return null;
    const challengeId = randomId();
    if (typeof challengeId !== "string" || !challengeId) return null;
    const purpose = mode === "register"
      ? "passkey-registration" : "medical-step-up";
    const persisted = await store.createChallenge({
      id: challengeId, value: options.challenge, rpID, ...(origin?{origin}:{}),
      userId, sessionId, purpose, issuedAt: now, expiresAt: now + ttlMs
    });
    if (persisted !== true) return null;
    return {options, challengeId, expiresAt: now + ttlMs};
  } catch { return null; }
}
