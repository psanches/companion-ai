// Development-only public institutional subpages; application routes delegated intact.
const HOST='lumi-develop.psanchesnle.workers.dev',PREFIX='/sobre';
export function withInstitutional(original,bundle){return {...original,async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.hostname!==HOST||!(url.pathname===PREFIX||url.pathname.startsWith(PREFIX+'/')))return original.fetch.call(original,request,env,ctx);
 const headers={'cache-control':'no-cache, max-age=0, must-revalidate','content-security-policy':"default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow','x-lumi-institutional-commit':bundle.commit,'x-lumi-institutional-release':bundle.release};
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,allow:'GET, HEAD','cache-control':'no-store'}});
 if(url.pathname===PREFIX||url.pathname===PREFIX+'/pt')return new Response(null,{status:308,headers:{...headers,location:url.pathname===PREFIX?PREFIX+'/':PREFIX+'/pt/'}});
 const path=url.pathname.slice(PREFIX.length);let body,type,status=200;
 if(bundle.pages[path]){body=bundle.pages[path];type='text/html; charset=utf-8';}
 else if(bundle.assets[path]){const asset=bundle.assets[path];body=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));type=asset.type;headers['cache-control']='public, max-age=31536000, immutable';}
 else if(path==='/release.json'){body=JSON.stringify({commit:bundle.commit,release:bundle.release});type='application/json';headers['cache-control']='no-store';}
 else{body='Not found';type='text/plain';status=404;headers['cache-control']='no-store';}
 return new Response(request.method==='HEAD'?null:body,{status,headers:{...headers,'content-type':type}});
}};}
