/**
 * Resolve a verified Supabase user from an Authorization Bearer token.
 * STAGING ONLY. Uses Supabase Auth /auth/v1/user, not unverified JWT decoding.
 * sessionId is derived from a cryptographic digest of the bearer token and
 * bound to that token's lifetime. Do not expose this value to the browser.
 *
 * The caller must provide a trusted, fixed Supabase project URL and the
 * project's public/publishable API key via server environment bindings.
 * Never accept either from user input.
 */
export async function verifySupabaseMedicalIdentity(request, {
  supabaseUrl, supabasePublishableKey, fetcher = fetch
} = {}) {
  if (!request || typeof supabaseUrl !== "string" ||
      !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl) ||
      !supabasePublishableKey || typeof fetcher !== "function") return null;
  const auth = request.headers?.get("Authorization");
  if (typeof auth !== "string" || !/^Bearer [A-Za-z0-9._~-]+$/.test(auth))
    return null;
  const token = auth.slice(7);
  try {
    const response = await fetcher(
      supabaseUrl.replace(/\/$/,"") + "/auth/v1/user", {
        method:"GET",
        headers:{
          apikey:supabasePublishableKey,
          Authorization:"Bearer " + token
        },
        redirect:"error"
      }
    );
    if (!response?.ok) return null;
    const user = await response.json();
    if (typeof user?.id !== "string" || !user.id) return null;
    const digest = await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(token)
    );
    const bytes = new Uint8Array(digest);
    const sessionId = Array.from(bytes, b=>b.toString(16).padStart(2,"0")).join("");
    return {userId:user.id,sessionId};
  } catch { return null; }
}
