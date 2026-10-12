// Development-only verification core; NOT routed or deployed.
// Install and bundle @simplewebauthn/server in the Cloudflare Worker build.
// Caller MUST authenticate Supabase bearer token and derive userId/sessionId
// server-side, not from request JSON. Use HTTPS origin and exact RP ID.
import { verifyRegistrationResponse, verifyAuthenticationResponse } from "@simplewebauthn/server";

const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 24_000;
const ACTIONS = new Set(["medical:read", "medical:write", "medical:export", "medical:delete"]);

export function validateMedicalAction(action) {
  if (!ACTIONS.has(action)) throw new Error("Unsupported medical action");
  return action;
}
export function validateWebAuthnConfig({ origin, rpID }) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash ||
      !rpID || !(url.hostname === rpID || url.hostname.endsWith("." + rpID))) {
    throw new Error("Invalid passkey origin/RP configuration");
  }
  return { origin: url.origin, rpID };
}
export async function consumeChallenge(db, { challengeId, userId, sessionId, purpose, action, now = Date.now() }) {
  if (!db || !challengeId || !userId || !sessionId) throw new Error("Missing security context");
  // Atomic single-use claim. The RETURNING row is only available to one caller.
  const row = await db.prepare(`
    UPDATE medical_passkey_challenges
    SET consumed_at = ?
    WHERE challenge_id = ? AND user_id = ? AND session_id = ?
      AND purpose = ? AND (action = ? OR (action IS NULL AND ? IS NULL))
      AND consumed_at IS NULL AND expires_at > ? AND expires_at <= ?
    RETURNING challenge
  `).bind(now, challengeId, userId, sessionId, purpose, action ?? null,
          action ?? null, now, now + MAX_AGE_MS).first();
  if (!row?.challenge) throw new Error("Passkey challenge expired, invalid or already used");
  return row.challenge;
}
export async function verifyMedicalRegistration({
  db, challengeId, userId, sessionId, response, origin, rpID, now = Date.now()
}) {
  validateWebAuthnConfig({ origin, rpID });
  const challenge = await consumeChallenge(db, {
    challengeId, userId, sessionId, purpose: "register", action: null, now
  });
  const result = await verifyRegistrationResponse({
    response, expectedChallenge: challenge, expectedOrigin: origin,
    expectedRPID: rpID, requireUserVerification: true
  });
  if (!result.verified || !result.registrationInfo?.credential) throw new Error("Passkey verification failed");
  const c = result.registrationInfo.credential;
  // Fail closed on duplicate IDs (including IDs belonging to another user).
  await db.prepare(`
    INSERT INTO medical_passkey_credentials
    (credential_id, user_id, public_key, counter, transports, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(c.id, userId, c.publicKey, c.counter,
          JSON.stringify(response.response?.transports ?? []), now).run();
  return { verified: true };
}
export async function verifyMedicalAssertion({
  db, challengeId, userId, sessionId, action, response, origin, rpID, now = Date.now()
}) {
  validateMedicalAction(action);
  validateWebAuthnConfig({ origin, rpID });
  const challenge = await consumeChallenge(db, {
    challengeId, userId, sessionId, purpose: "authenticate", action, now
  });
  const saved = await db.prepare(`
    SELECT credential_id, public_key, counter, transports
    FROM medical_passkey_credentials WHERE credential_id = ? AND user_id = ?
  `).bind(response?.id ?? "", userId).first();
  if (!saved) throw new Error("Unknown passkey");
  const result = await verifyAuthenticationResponse({
    response, expectedChallenge: challenge, expectedOrigin: origin,
    expectedRPID: rpID, requireUserVerification: true,
    credential: {
      id: saved.credential_id, publicKey: new Uint8Array(saved.public_key),
      counter: saved.counter, transports: JSON.parse(saved.transports || "[]")
    }
  });
  if (!result.verified) throw new Error("Passkey verification failed");
  // Reject concurrent replay or stale counters; update only matching prior state.
  const changed = await db.prepare(`
    UPDATE medical_passkey_credentials SET counter = ?, last_used_at = ?
    WHERE credential_id = ? AND user_id = ? AND counter = ?
    RETURNING credential_id
  `).bind(result.authenticationInfo.newCounter, now,
          saved.credential_id, userId, saved.counter).first();
  if (!changed) throw new Error("Passkey counter conflict");
  // The caller must mint a cryptographically random, action-scoped,
  // short-lived grant, store only its hash, and bind it to this session.
  return { verified: true, userId, sessionId, action };
}
export { MAX_BODY_BYTES };
