export class ResearchAuthUnavailable extends Error {constructor(){super('Authentication service unavailable');this.code='AUTH_SERVICE';}}
// Development-only Supabase session validation. The browser's claim is never
// sufficient: each research request is verified against Supabase Auth.
export function createSupabaseVerifier({fetcher = fetch} = {}) {
  return async (token, env) => {
    const url = env?.SUPABASE_URL;
    const key = env?.SUPABASE_PUBLISHABLE_KEY;
    if (typeof url !== 'string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
        typeof key !== 'string' || !key.startsWith('sb_publishable_') ||
        typeof token !== 'string' || token.length < 10 || token.length > 8192) return null;
    try {
      const response = await fetcher(url + '/auth/v1/user', {
        method: 'GET',
        headers: {apikey:key,authorization:'Bearer '+token},
        // Cloudflare Workers supports manual redirects; reject 3xx below.
        redirect:'manual',
        signal:AbortSignal.timeout(7000)
      });
      if (!response.ok) {if([401,403].includes(response.status))return null;throw new ResearchAuthUnavailable();}
      const user = await response.json();
      if(typeof user?.id!=='string'||!user.id)throw new ResearchAuthUnavailable();
      return {id:user.id};
    } catch { throw new ResearchAuthUnavailable(); }
  };
}
