import {createResearchRoute} from './route.mjs';
import {createSupabaseVerifier} from './supabase-auth.mjs';

// Development-only assembly. Import into the preserved Worker wrapper only
// after deployment bindings and rate limits have been reviewed.
export function createLumiResearchHandler({fetcher=fetch}={}) {
  const verifyToken=createSupabaseVerifier({fetcher});
  const route=createResearchRoute({verifyToken,fetcher});
  return async (request,env)=>{
    // Fail closed until a server-managed per-user rate limiter is configured.
    if (!env?.LUMI_RESEARCH_RATE_LIMIT || typeof env.LUMI_RESEARCH_RATE_LIMIT.limit!=='function')
      return Response.json({status:'unavailable',answer:'Pesquisa temporariamente indisponível.'},{status:503});
    const authorization=request.headers.get('authorization')||'';
    if (!authorization.startsWith('Bearer ')) return route(request,env);
    const token=authorization.slice(7);
    const user=await verifyToken(token,env);
    if (!user?.id) return Response.json({error:'Sign in required'},{status:401});
    try {
      const limit=await env.LUMI_RESEARCH_RATE_LIMIT.limit({key:user.id});
      if (!limit?.success) return Response.json({status:'limited',answer:'Limite de pesquisas atingido. Tente novamente mais tarde.'},{status:429});
    } catch {return Response.json({status:'unavailable',answer:'Pesquisa temporariamente indisponível.'},{status:503});}
    return route(request,env);
  };
}
