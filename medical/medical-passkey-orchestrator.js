/**
 * Server-only medical passkey step-up orchestration.
 * STAGING: integration scaffold, not a deployable Worker route.
 *
 * The caller MUST derive identity and sessionId from a verified Supabase JWT.
 * Do not use client-provided identity, sessionId, or authorization flags.
 * Pass in a Durable Object stub scoped to the verified user.
 */
import { createPasskeyOptions } from "./webauthn-options.js";
import { registerMedicalPasskey } from "./webauthn-registration.js";
import { verifyMedicalPasskey } from "./webauthn-step-up.js";

const allowedOrigin = "https://dev.mylumicompanion.com";
const rpID = "mylumicompanion.com";

export async function beginMedicalPasskey({
  verifiedIdentity, mode, userName, store, credentials,
  generateRegistrationOptions, generateAuthenticationOptions,
  now = Date.now()
}) {
  if (!verifiedIdentity?.userId || !verifiedIdentity?.sessionId ||
      !["register","authenticate"].includes(mode)) return null;
  return createPasskeyOptions({
    mode, userId:verifiedIdentity.userId,
    sessionId:verifiedIdentity.sessionId,
    userName, credentialList:credentials,
    rpID, store, now,
    generateRegistrationOptions, generateAuthenticationOptions
  });
}

export async function completeMedicalPasskey({
  verifiedIdentity, mode, response, challengeId, store,
  verifyRegistrationResponse, verifyAuthenticationResponse,
  now = Date.now()
}) {
  if (!verifiedIdentity?.userId || !verifiedIdentity?.sessionId ||
      !["register","authenticate"].includes(mode) ||
      !response || !challengeId) return false;
  const common = {
    response, challengeId, store, now, origin:allowedOrigin, rpID,
    userId:verifiedIdentity.userId, sessionId:verifiedIdentity.sessionId
  };
  if (mode === "register") {
    return registerMedicalPasskey({
      ...common, verifyRegistrationResponse
    });
  }
  return verifyMedicalPasskey({
    ...common, verifyAuthenticationResponse
  });
}
