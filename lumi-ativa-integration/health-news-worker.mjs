import {generateHealthDigest, getLatestHealthDigest, HEALTH_NEWS_CRON_UTC} from './health-news-daily.mjs';
const HOST = 'lumi-develop.psanchesnle.workers.dev';
/** Add public-news read access and cron without changing Lumi's existing handlers. */
export function withHealthNews(original, generate = generateHealthDigest, latest = getLatestHealthDigest) {
  return {
    ...original,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.hostname !== HOST || url.pathname !== '/health-news')
        return original.fetch.call(original, request, env, ctx);
      const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
      if (!['GET','HEAD'].includes(request.method))
        return new Response(null, {status:405,headers:{...headers,allow:'GET, HEAD'}});
      let digest;
      try { digest = await latest(env); }
      catch { return new Response(request.method==='HEAD'?null:JSON.stringify({error:'Boletim indisponível.'}),{status:503,headers}); }
      return new Response(request.method==='HEAD'?null:JSON.stringify(digest || {status:'pending'}),{status:digest?200:503,headers});
    },
    scheduled(controller, env, ctx) {
      // Other schedules remain owned by the existing Worker.
      if (controller.cron !== HEALTH_NEWS_CRON_UTC)
        return original.scheduled?.call(original, controller, env, ctx);
      // Returning the promise lets cron failures remain visible to Cloudflare.
      const task = Promise.all([
        generate(env, new Date(controller.scheduledTime)),
        original.scheduled?.call(original, controller, env, ctx)
      ]).then(([digest]) => digest);
      ctx.waitUntil(task);
      return task;
    }
  };
}
