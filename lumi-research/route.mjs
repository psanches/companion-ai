import { researchNow } from './research.mjs';

// Development-only route adapter. The caller must provide a verified
// Supabase JWT validator; never trust a client-supplied authorization flag.
export function createResearchRoute({ verifyToken, fetcher = fetch } = {}) {
  if (typeof verifyToken !== 'function') throw new TypeError('Verified token handler required');
  return async function handleResearch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== 'lumi-develop.psanchesnle.workers.dev' || url.pathname !== '/research') return null;
    if (request.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
    if (request.headers.get('origin') !== url.origin) return Response.json({error:'Origin not allowed'},{status:403});
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer [^ ]+$/.test(auth)) return Response.json({error:'Sign in required'},{status:401});
    let user;
    try { user = await verifyToken(auth.slice(7), env); } catch { return Response.json({error:'Sign in required'},{status:401}); }
    if (!user?.id) return Response.json({error:'Sign in required'},{status:401});
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 1500) return Response.json({error:'Request too large'},{status:413});
    let question;
    try {
      const raw = await request.text();
      if (raw.length > 1500) throw Error('large');
      const payload = JSON.parse(raw);
      if (Object.keys(payload).length !== 1 || typeof payload.question !== 'string') throw Error('invalid');
      question = payload.question;
    } catch { return Response.json({error:'Invalid question'},{status:400}); }
    try {
      const result = await researchNow({question, authorized:true,apiKey:env?.LUMI_RESEARCH_OPENAI_API_KEY,fetcher,maxOutputTokens:600});
      return Response.json(result,{status:result.status==='complete'?200:result.status==='unverified'?422:503,
        headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
    } catch {
      return Response.json({status:'failed',answer:'Pesquisa indisponível no momento.'},{status:503});
    }
  };
}
