import bundle from './bundle.generated.mjs';
const DOMAIN='mylumicompanion.com';
const APP='https://mylumicompanion.com/?lumi_app=1';
const PREVIEW='lumi-institutional-public.psanchesnle.workers.dev';
const headers={'cache-control':'no-cache, max-age=0, must-revalidate','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-lumi-institutional-commit':bundle.commit,'x-lumi-institutional-release':bundle.release};
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.hostname==='app.'+DOMAIN){if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,allow:'GET, HEAD'}});return new Response(null,{status:302,headers:{...headers,location:APP+url.hash}});}
 if(![DOMAIN,PREVIEW,'localhost','127.0.0.1'].includes(url.hostname))return new Response('Not found',{status:404});
 // Preserve existing application paths, account callbacks and server APIs via its original service.
 const institution=Object.hasOwn(bundle.pages,url.pathname)||Object.hasOwn(bundle.assets,url.pathname)||['/pt','/index.html','/release.json','/robots.txt','/auth-return.js','/sw.js'].includes(url.pathname);
 if(!institution||url.searchParams.get('lumi_app')==='1'||(['code','error','error_description','token_hash'].some(k=>url.searchParams.has(k))&&url.pathname==='/')||!['GET','HEAD'].includes(request.method)){
  const original=new URL(request.url);original.hostname=DOMAIN;original.searchParams.delete('lumi_app');
  const response=await env.LEGACY_LUMI.fetch(new Request(original,request));
  const h=new Headers(response.headers);h.set('cache-control',request.headers.has('authorization')||response.headers.get('content-type')?.includes('text/html')?'private, no-store':'no-cache, max-age=0, must-revalidate');
  // A shared migration service worker must never cache authenticated application responses.
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
 }
 let body,type='text/plain; charset=utf-8',status=200;const h={...headers};
 if(url.pathname==='/pt')return new Response(null,{status:308,headers:{...h,location:'/pt/'}});
 if(url.pathname==='/sw.js'){body="self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(/^lumi-v\\d+$/.test(k))await caches.delete(k);await self.clients.claim();await self.registration.unregister();})()));";type='application/javascript';h['service-worker-allowed']='/';}
 else if(url.pathname==='/auth-return.js'){body="if(/(?:^|[#&])(access_token|refresh_token|error|error_description)=/.test(location.hash)){location.replace('/?lumi_app=1'+location.hash);}else if('serviceWorker' in navigator){navigator.serviceWorker.getRegistration('/').then(r=>{if(r)r.update().catch(()=>{});}).catch(()=>{});}";type='application/javascript';}
 else if(bundle.pages[url.pathname]||url.pathname==='/index.html'){
  body=(bundle.pages[url.pathname]||bundle.pages['/']).replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">').replace('</head>','<script src="/auth-return.js" defer></script></head>');
  body=body.replaceAll('Institutional preview · Development project','Independent initiative · In development').replaceAll('Preview institucional · Projeto em desenvolvimento','Iniciativa independente · Em desenvolvimento').replaceAll('This preview','This institutional website').replaceAll('Este preview','Este site institucional').replaceAll('Institutional preview for review.','Institutional presentation.').replaceAll('Preview institucional para revisão.','Apresentação institucional.');
  type='text/html; charset=utf-8';h['content-security-policy']="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests";
 }
 else if(bundle.assets[url.pathname]){const a=bundle.assets[url.pathname];body=Uint8Array.from(atob(a.body),c=>c.charCodeAt(0));type=a.type;h['cache-control']='public, max-age=31536000, immutable';}
 else if(url.pathname==='/release.json'){body=JSON.stringify({commit:bundle.commit,release:bundle.release});type='application/json';h['cache-control']='no-store';}
 else if(url.pathname==='/robots.txt')body='User-agent: *\nAllow: /\nDisallow: /*?lumi_app=\n';
 else{body='Not found';status=404;}
 return new Response(request.method==='HEAD'?null:body,{status,headers:{...h,'content-type':type}});
}};
