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
        redirect:'error',
        signal:AbortSignal.timeout(7000)
      });
      if (!response.ok) return null;
      const user = await response.json();
      return typeof user?.id === 'string' && user.id.length > 0 ? {id:user.id} : null;
    } catch { return null; }
  };
}
