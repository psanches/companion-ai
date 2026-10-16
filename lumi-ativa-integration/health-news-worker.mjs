import {NEWS_HTML,NEWS_SCRIPT,NEWS_CSS} from './health-news-ui-assets.mjs';
import {generateHealthDigest, getLatestHealthDigest, HEALTH_NEWS_CRON_UTC} from './health-news-daily.mjs';
const HOST = 'lumi-develop.psanchesnle.workers.dev';
/** Add public-news read access and cron without changing Lumi's existing handlers. */
export function withHealthNews(original, generate = generateHealthDigest, latest = getLatestHealthDigest) {
  return {
    ...original,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.hostname !== HOST)return original.fetch.call(original,request,env,ctx);
      const ui={'/noticias':[NEWS_HTML,'text/html; charset=utf-8'],'/noticias/':[NEWS_HTML,'text/html; charset=utf-8'],'/health-news-ui.js':[NEWS_SCRIPT,'application/javascript; charset=utf-8'],'/health-news-ui.css':[NEWS_CSS,'text/css; charset=utf-8']}[url.pathname];
      if(ui){if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});return new Response(request.method==='HEAD'?null:ui[0],{headers:{'content-type':ui[1],'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}});}
      if(url.pathname!=='/health-news'){
        const response=await original.fetch.call(original,request,env,ctx);
        if(request.method==='GET'&&['/','/index.html'].includes(url.pathname)&&response.ok&&response.headers.get('content-type')?.includes('text/html')){
          const html=await response.text();const h=new Headers(response.headers);for(const key of ['content-length','content-encoding','etag'])h.delete(key);h.set('cache-control','no-store');h.set('x-lumi-news-ui','1');
          const addition='<link rel="stylesheet" href="/health-news-ui.css?v=1"><script src="/health-news-ui.js?v=1" defer></script>';
          const body=/<\/body\s*>/i.test(html)?html.replace(/<\/body\s*>/i,addition+'</body>'):html+addition;
          return new Response(body,{status:response.status,headers:h});
        }
        return response;
      }
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
