const ALLOWED_ORIGINS=new Set(['https://dev.mylumicompanion.com','https://companion-ai-e42.pages.dev']);
export async function routeResearch(request,env,handler){
 if(new URL(request.url).pathname!=='/research')return null;
 const origin=request.headers.get('Origin');
 if(origin&&!ALLOWED_ORIGINS.has(origin))return Response.json({error:'Origem não autorizada.'},{status:403});
 const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});
 if(origin)headers.set('Access-Control-Allow-Origin',origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const response=await handler(request,env);
 const output=new Response(response.body,response);
 for(const [k,v] of headers)output.headers.set(k,v);
 return output;
}
