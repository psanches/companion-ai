/**
 * Medical route security gate for Cloudflare Workers.
 * FAIL CLOSED. Do not wire into production until session verification,
 * WebAuthn step-up, ownership and integration tests are complete.
 *
 * authenticate(request, env) must verify the Supabase JWT server-side
 * (signature, issuer, audience, expiration) and return a trusted user id.
 * verifyStepUp(request, env, userId) must verify a server-issued,
 * short-lived, single-use WebAuthn challenge bound to this session.
 * Neither function may trust user IDs or booleans from request JSON.
 */
export async function authorizeMedicalRequest(request, env, {
  authenticate,
  verifyStepUp,
  ownerId
} = {}) {
  const denied = (status, code) => new Response(JSON.stringify({error:code}), {
    status,
    headers: {"content-type":"application/json","cache-control":"no-store"}
  });
  if (typeof authenticate !== "function" ||
      typeof verifyStepUp !== "function" ||
      typeof ownerId !== "function") return denied(503, "MEDICAL_SECURITY_NOT_CONFIGURED");
  let user;
  try { user = await authenticate(request, env); }
  catch { return denied(401, "MEDICAL_AUTH_REQUIRED"); }
  if (!user?.id || typeof user.id !== "string") return denied(401, "MEDICAL_AUTH_REQUIRED");
  let verified = false;
  try { verified = await verifyStepUp(request, env, user.id) === true; }
  catch { /* deny */ }
  if (!verified) return denied(403, "MEDICAL_STEP_UP_REQUIRED");
  let owner;
  try { owner = await ownerId(request, env); }
  catch { return denied(403, "MEDICAL_ACCESS_DENIED"); }
  if (owner !== user.id) return denied(403, "MEDICAL_ACCESS_DENIED");
  return {userId:user.id};
}

export const MEDICAL_LIMITS = Object.freeze({
  maxFiles:3, maxFileBytes:5*1024*1024, maxTotalBytes:15*1024*1024,
  allowedTypes:["application/pdf","image/jpeg","image/png"]
});

/** Validate before any storage write. Recheck content signature server-side. */
export function validateMedicalUpload(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MEDICAL_LIMITS.maxFiles)
    return "MEDICAL_FILE_COUNT_INVALID";
  let total = 0;
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size <= 0 ||
        file.size > MEDICAL_LIMITS.maxFileBytes) return "MEDICAL_FILE_SIZE_INVALID";
    if (!MEDICAL_LIMITS.allowedTypes.includes(file.type)) return "MEDICAL_FILE_TYPE_INVALID";
    total += file.size;
  }
  return total > MEDICAL_LIMITS.maxTotalBytes ? "MEDICAL_TOTAL_SIZE_INVALID" : null;
}
