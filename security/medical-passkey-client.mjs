// Browser-side passkey client for the future medical step-up flow.
// This module is intentionally not loaded by Lumi until the server routes
// have been deployed and validated. No medical data is handled here.
function base64urlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function bytesToBase64url(value) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function credentialJSON(credential) {
  if (!credential) throw new Error("Verificação cancelada.");
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      authenticatorData: response.authenticatorData ? bytesToBase64url(response.authenticatorData) : undefined,
      signature: response.signature ? bytesToBase64url(response.signature) : undefined,
      userHandle: response.userHandle ? bytesToBase64url(response.userHandle) : null,
      attestationObject: response.attestationObject ? bytesToBase64url(response.attestationObject) : undefined
    }
  };
}
async function postJSON(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Falha ao confirmar identidade.");
  return result;
}
export async function enrollMedicalPasskey({ apiBase, accessToken }) {
  if (!window.PublicKeyCredential || !window.isSecureContext) throw new Error("Este dispositivo não oferece passkeys seguras.");
  const start = await postJSON(apiBase + "/medical/passkeys/register/options", accessToken, {});
  const options = start.options;
  options.challenge = base64urlToBytes(options.challenge);
  options.user.id = base64urlToBytes(options.user.id);
  options.excludeCredentials = (options.excludeCredentials || []).map(item => ({
    ...item, id: base64urlToBytes(item.id)
  }));
  const credential = await navigator.credentials.create({ publicKey: options });
  return postJSON(apiBase + "/medical/passkeys/register/verify", accessToken, {
    credential: credentialJSON(credential), challengeId: start.challengeId
  });
}
export async function verifyMedicalPasskey({ apiBase, accessToken, action = "medical:read" }) {
  if (!window.PublicKeyCredential || !window.isSecureContext) throw new Error("Este dispositivo não oferece passkeys seguras.");
  const start = await postJSON(apiBase + "/medical/passkeys/auth/options", accessToken, { action });
  const options = start.options;
  options.challenge = base64urlToBytes(options.challenge);
  options.userVerification = "required";
  options.allowCredentials = (options.allowCredentials || []).map(item => ({
    ...item, id: base64urlToBytes(item.id)
  }));
  const credential = await navigator.credentials.get({ publicKey: options });
  // Server must verify challenge, RP ID, origin, UV, signature, session,
  // action and expiry BEFORE returning any authorization grant.
  return postJSON(apiBase + "/medical/passkeys/auth/verify", accessToken, {
    credential: credentialJSON(credential), challengeId: start.challengeId, action
  });
}
