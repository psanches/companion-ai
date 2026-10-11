// Fail-closed authorization boundary for future medical APIs.
// NOT connected to the deployed Worker. A valid passkey verifier must
// create the grant after verifying a WebAuthn assertion server-side.
// Never accept a grant from client-side flags or unverified requests.

export class MedicalAuthorizationError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

export async function requireMedicalStepUp({ userId, sessionId, grant, db, now = Date.now() }) {
  if (!userId || !sessionId || !grant || !db) {
    throw new MedicalAuthorizationError("Confirme sua identidade para acessar dados médicos.");
  }
  if (typeof grant !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(grant)) {
    throw new MedicalAuthorizationError("Confirmação inválida.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(grant));
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
  const record = await db.prepare(
    "SELECT user_id, session_id, expires_at, revoked_at FROM medical_stepup_grants WHERE grant_hash = ?"
  ).bind(hash).first();
  if (!record || record.user_id !== userId || record.session_id !== sessionId ||
      record.revoked_at !== null || !Number.isFinite(record.expires_at) ||
      record.expires_at <= now || record.expires_at > now + 600000) {
    throw new MedicalAuthorizationError("Confirmação expirada. Confirme sua identidade novamente.");
  }
  return true;
}

export function medicalStepUpRequiredResponse() {
  return Response.json({
    error: "Confirmação de identidade necessária.",
    code: "MEDICAL_STEP_UP_REQUIRED"
  }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
