import bundle from './bundle.generated.mjs';
export const PREVIEW_WORKER='lumi-institutional-preview-20261017';
const security={'content-security-policy':"default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",'x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','x-robots-tag':'noindex, nofollow','x-lumi-institutional-commit':bundle.commit,'x-lumi-institutional-release':bundle.release};
export default {async fetch(request){
const url=new URL(request.url);
if(!['localhost','127.0.0.1',PREVIEW_WORKER+'.psanchesnle.workers.dev'].includes(url.hostname))return new Response('Preview host only',{status:403});
if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...security,allow:'GET, HEAD','cache-control':'no-store'}});
let body,type,status=200,cache='no-cache, max-age=0, must-revalidate';
if(url.pathname==='/pt'){return new Response(null,{status:308,headers:{...security,location:'/pt/','cache-control':'no-cache'}});}
if(bundle.pages[url.pathname]){body=bundle.pages[url.pathname];type='text/html; charset=utf-8';}
else if(bundle.assets[url.pathname]){const a=bundle.assets[url.pathname];body=Uint8Array.from(atob(a.body),c=>c.charCodeAt(0));type=a.type;cache='public, max-age=31536000, immutable';}
else if(url.pathname==='/release.json'){body=JSON.stringify({commit:bundle.commit,release:bundle.release});type='application/json';cache='no-store';}
else if(url.pathname==='/robots.txt'){body='User-agent: *\nDisallow: /\n';type='text/plain';}
else{body='Not found';type='text/plain';status=404;cache='no-store';}
return new Response(request.method==='HEAD'?null:body,{status,headers:{...security,'content-type':type,'cache-control':cache}});
}};
