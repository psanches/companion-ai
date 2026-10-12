import {getDevelopmentPasskeyContext} from "./development-passkey-context.js";
const client="\nconst status=document.getElementById(\"status\");\nconst register=document.getElementById(\"register\");\nconst authenticate=document.getElementById(\"authenticate\");\nlet config,token=null,busy=false;\nconst show=text=>{status.textContent=text;};\nconst decode=value=>Uint8Array.from(atob(value.replace(/-/g,\"+\").replace(/_/g,\"/\")),c=>c.charCodeAt(0));\nconst encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\\+/g,\"-\").replace(/\\//g,\"_\").replace(/=+$/,\"\");\nfunction serialize(credential,mode){\n const r=credential.response;\n return {id:credential.id,rawId:encode(credential.rawId),type:credential.type,\n  clientExtensionResults:credential.getClientExtensionResults(),\n  authenticatorAttachment:credential.authenticatorAttachment,\n  response:mode===\"register\"?{\n    clientDataJSON:encode(r.clientDataJSON),attestationObject:encode(r.attestationObject),\n    transports:r.getTransports?r.getTransports():[]\n  }:{\n    clientDataJSON:encode(r.clientDataJSON),authenticatorData:encode(r.authenticatorData),\n    signature:encode(r.signature),userHandle:r.userHandle?encode(r.userHandle):null\n  }};\n}\nasync function api(path,body){\n const response=await fetch(path,{method:\"POST\",headers:{\n  \"Content-Type\":\"application/json\",Authorization:\"Bearer \"+token\n },body:JSON.stringify(body),cache:\"no-store\",redirect:\"error\"});\n const data=await response.json();\n if(!response.ok)throw Error(data.error||\"Solicitação recusada\");\n return data;\n}\nasync function ceremony(mode){\n if(busy||!token)return;\n busy=true;register.disabled=authenticate.disabled=true;\n try{\n  const start=await api(\"/medical/passkey/\"+mode+\"/options\",{});\n  const publicKey=start.options;\n  publicKey.challenge=decode(publicKey.challenge);\n  if(mode===\"register\"){\n   publicKey.user.id=decode(publicKey.user.id);\n   publicKey.excludeCredentials=(publicKey.excludeCredentials||[]).map(c=>({...c,id:decode(c.id)}));\n  }else{\n   publicKey.allowCredentials=(publicKey.allowCredentials||[]).map(c=>({...c,id:decode(c.id)}));\n  }\n  show(\"Confirme a passkey no seu dispositivo.\");\n  const credential=mode===\"register\"?await navigator.credentials.create({publicKey}):await navigator.credentials.get({publicKey});\n  if(!credential)throw Error(\"Teste cancelado\");\n  const result=await api(\"/medical/passkey/\"+mode+\"/complete\",{\n   challengeId:start.challengeId,response:serialize(credential,mode)\n  });\n  if(result.ok!==true||result.medicalAccess!==false)throw Error(\"Resposta inesperada: teste interrompido\");\n  show(mode===\"register\"?\"Passkey cadastrada. Registros médicos continuam bloqueados.\":\"Passkey verificada. Registros médicos continuam bloqueados.\");\n }catch(error){show(error.name===\"NotAllowedError\"?\"Teste cancelado ou tempo esgotado. Tente novamente.\":error.message);}\n finally{busy=false;register.disabled=authenticate.disabled=!token;}\n}\ndocument.getElementById(\"login\").addEventListener(\"submit\",async event=>{\n event.preventDefault();\n const submit=document.getElementById(\"send\");submit.disabled=true;\n try{\n  if(!config)throw Error(\"Configuração de teste pendente\");\n  const response=await fetch(config.supabaseUrl+\"/auth/v1/otp?redirect_to=\"+encodeURIComponent(location.origin+\"/passkey-test\"),{\n   method:\"POST\",headers:{apikey:config.publishableKey,\"Content-Type\":\"application/json\"},\n   body:JSON.stringify({email:document.getElementById(\"email\").value.trim(),\n    create_user:false}),\n   redirect:\"error\"\n  });\n  if(!response.ok)throw Error(\"Não foi possível solicitar o link. Confira o e-mail e tente novamente.\");\n  show(\"Confira seu e-mail e spam. Abra o link recebido para voltar a esta página.\");\n }catch(error){show(error.message);}finally{submit.disabled=false;}\n});\nregister.addEventListener(\"click\",()=>ceremony(\"register\"));\nauthenticate.addEventListener(\"click\",()=>ceremony(\"authenticate\"));\ndocument.getElementById(\"clear\").addEventListener(\"click\",()=>{\n token=null;register.disabled=authenticate.disabled=true;\n show(\"Sessão removida desta página. Registros médicos continuam bloqueados.\");\n});\nasync function initialize(){\n const fragment=new URLSearchParams(location.hash.slice(1));\n const incoming=fragment.get(\"access_token\");\n const loginError=fragment.has(\"error\")||fragment.has(\"error_description\");\n if(location.hash)history.replaceState(null,\"\",location.pathname);\n try{\n  const response=await fetch(\"/passkey-test/config\",{cache:\"no-store\",redirect:\"error\"});\n  if(!response.ok)throw Error(\"Faltam as configurações Supabase deste Worker de teste.\");\n  config=await response.json();\n  document.getElementById(\"send\").disabled=false;\n  if(loginError)throw Error(\"Link de entrada inválido ou expirado. Solicite outro.\");\n  if(incoming){\n   const verified=await fetch(config.supabaseUrl+\"/auth/v1/user\",{\n    headers:{apikey:config.publishableKey,Authorization:\"Bearer \"+incoming},redirect:\"error\",cache:\"no-store\"\n   });\n   if(!verified.ok)throw Error(\"Sessão inválida. Solicite outro link de entrada.\");\n   token=incoming;register.disabled=authenticate.disabled=false;\n   show(\"Conta autenticada. Cadastre ou verifique sua passkey. Registros médicos continuam bloqueados.\");\n  }else{show(\"Entre com o e-mail da sua conta. Nenhum dado médico será acessado.\");}\n }catch(error){show(error.message);}\n}\ninitialize();\n";
function publicConfiguration(env) {
  const url=env?.SUPABASE_URL,key=env?.SUPABASE_PUBLISHABLE_KEY;
  if(typeof url!=="string"||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)||
     typeof key!=="string")return null;
  let publicKey=key.startsWith("sb_publishable_");
  if(!publicKey){
    try{const payload=JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
      publicKey=payload.role==="anon";
    }catch{}
  }
  if(!publicKey)return null;
  return {supabaseUrl:url.replace(/\/$/,""),publishableKey:key};
}
export async function handlePasskeyTestPage(request,env) {
  const url=new URL(request.url);
  if(!["/passkey-test","/passkey-test/config"].includes(url.pathname))return null;
  const headers={"cache-control":"no-store","x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"};
  if(!getDevelopmentPasskeyContext(url.origin))
    return Response.json({error:"TEST_ORIGIN_DENIED"},{status:403,headers});
  if(request.method!=="GET")
    return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405,headers});
  if(url.pathname.endsWith("/config")){
    const config=publicConfiguration(env);
    return Response.json(config||{error:"TEST_AUTH_NOT_CONFIGURED"},{
      status:config?200:503,headers
    });
  }
  const nonce=crypto.randomUUID().replace(/-/g,"");
  headers["content-type"]="text/html; charset=utf-8";
  headers["content-security-policy"]="default-src 'none'; script-src 'nonce-"+nonce+
    "'; style-src 'nonce-"+nonce+"'; connect-src 'self' https://*.supabase.co; "+
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
  return new Response(`<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lumi — teste de passkey</title><style nonce="${nonce}">
body{font:18px/1.5 system-ui;max-width:680px;margin:auto;padding:24px;background:#111827;color:#f8fafc}
button,input{font:inherit;padding:12px;margin:8px 0;border-radius:10px;box-sizing:border-box}
input{width:100%}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}
#status{padding:16px;border:1px solid #64748b;border-radius:10px;white-space:pre-wrap}
</style></head><body><h1>Teste de passkey da Lumi</h1>
<p><strong>Registros médicos permanecem bloqueados.</strong> Esta página testa apenas a entrada na conta e a passkey. Não informe dados de saúde.</p>
<form id="login"><label for="email">E-mail da sua conta Lumi</label>
<input id="email" type="email" autocomplete="email" required>
<button id="send" type="submit" disabled>Sign in — receber link por e-mail</button></form>
<p id="status" role="status" aria-live="polite">Verificando configuração…</p>
<button id="register" disabled>Cadastrar passkey de teste</button>
<button id="authenticate" disabled>Verificar passkey</button>
<button id="clear">Limpar sessão desta página</button>
<p>O teste poderá abrir a confirmação de identidade do Android ou do computador.
Recarregar a página encerra esta sessão de teste.</p>
<script nonce="${nonce}">${client}</script></body></html>`,{headers});
}
