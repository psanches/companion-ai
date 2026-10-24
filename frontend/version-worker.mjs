const HOST='lumi-develop.psanchesnle.workers.dev';
export function withFrontendVersion(original,release,previous={}){
 return {...original,async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.hostname!==HOST)return original.fetch.call(original,request,env,ctx);
  if(url.pathname==='/frontend-version')return Response.json({release:release.release,commit:release.commit},{headers:{'cache-control':'no-store'}});
  if(url.pathname.startsWith('/_assets/')){
   const asset=release.immutable[url.pathname]||previous[url.pathname];
   if(!asset)return new Response('Asset version unavailable. Reopen Lumi when online.',{status:404,headers:{'cache-control':'no-store'}});
   if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
   return new Response(request.method==='HEAD'?null:asset.content,{headers:{'content-type':asset.type,'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff','x-lumi-release':release.release,...(url.pathname.endsWith('/app.js')?{'x-lumi-calendar':'confirmed-events-v13'}:{})}});
  }
  // Stable asset aliases revalidate; immutable URLs are the only long-lived cache.
  if(release.routes[url.pathname]&&['GET','HEAD'].includes(request.method)){
   const asset=release.immutable[release.routes[url.pathname]];
   return new Response(request.method==='HEAD'?null:asset.content,{headers:{'content-type':asset.type,'cache-control':'no-cache, max-age=0, must-revalidate','x-content-type-options':'nosniff','x-lumi-release':release.release,...(url.pathname.endsWith('/app.js')?{'x-lumi-calendar':'confirmed-events-v13'}:{})}});
  }
  const response=await original.fetch.call(original,request,env,ctx);
  if(!['GET','HEAD'].includes(request.method))return response;
  const headers=new Headers(response.headers);
  if(headers.get('content-type')?.includes('text/html')&&response.ok){
   let body=request.method==='HEAD'?'':await response.text();
   for(const key of ['etag','content-length','content-encoding'])headers.delete(key);
   body=body.replace(/((?:src|href)=["'])([^"']+)(["'])/g,(all,prefix,value,suffix)=>{const path='/'+value.replace(/^\//,'').split('?')[0];return release.routes[path]?prefix+release.routes[path]+suffix:all;});
   body=body.replace(/(<meta name="lumi-build" content=")[^"]*(">)/, '$1'+release.commit+'$2');
   if(!url.pathname.startsWith('/sobre')&&release.routes['/language.js'])body=body.replace('</head>','<link rel="stylesheet" href="'+release.routes['/language.css']+'"><script src="'+release.routes['/language.js']+'" defer></script></head>');
   if(url.pathname==='/'||url.pathname==='/index.html')body=body.replace('</head>','<meta name="lumi-release" content="'+release.release+'"><link rel="stylesheet" href="'+release.routes['/experience.css']+'"><script src="'+release.routes['/experience.js']+'" defer></script></head>');
   headers.set('cache-control','private, no-cache, max-age=0, must-revalidate');headers.set('x-lumi-release',release.release);headers.set('x-lumi-commit',release.commit);
   return new Response(request.method==='HEAD'?null:body,{status:response.status,headers});
  }
  if(url.pathname==='/sw.js'){headers.set('cache-control','no-cache, max-age=0, must-revalidate');headers.set('service-worker-allowed','/');return new Response(response.body,{status:response.status,headers});}
  return response;
 }};
}
