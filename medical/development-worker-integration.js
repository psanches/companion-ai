/**
 * Development-only integration wrapper. No automatic deployment.
 * Wrap the reviewed, current lumi-develop Worker object; never use repo worker.js
 * as a substitute for that baseline. Preserve all existing bindings and ctx.
 */
import {verifySupabaseMedicalIdentity} from "./supabase-verified-identity.js";
import {handleRealDevelopmentPasskeyRequest} from "./development-passkey-real.js";
export {MedicalPasskeyStore} from "./medical-passkey-store.js";

import {getDevelopmentPasskeyContext} from "./development-passkey-context.js";
import {handlePasskeyTestPage} from "./passkey-test-page.js";
const passkeyPaths=new Set([
  "/medical/passkey/register/options",
  "/medical/passkey/register/complete",
  "/medical/passkey/authenticate/options",
  "/medical/passkey/authenticate/complete"
]);
function response(request,data,status) {
  return Response.json(data,{
    status,
    headers:{
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      ...(getDevelopmentPasskeyContext(request.headers.get("Origin"))?{
        "access-control-allow-origin":request.headers.get("Origin"),
        vary:"Origin"
      }:{})
    }
  });
}
export function createDevelopmentMedicalWorker(existingWorker) {
  if (!existingWorker || typeof existingWorker.fetch!=="function")
    throw new TypeError("Reviewed development Worker baseline required");
  return {
    ...existingWorker,
    async fetch(request,env,ctx) {
      const pathname=new URL(request.url).pathname;
      const path=pathname.startsWith("/api/")?pathname.slice(4):pathname;
      const testResponse=await handlePasskeyTestPage(request,env);
      if (testResponse) return testResponse;
      const origin=request.headers.get("Origin");
      // Medical CRUD, export and future subroutes remain unconditionally locked.
      if (path==="/profile/medical" || path.startsWith("/profile/medical/"))
        return response(request,{
          error:"Medical access locked until passkey verification is ready",
          code:"MEDICAL_STEP_UP_REQUIRED"
        },403);
      if (!passkeyPaths.has(path)) {
        // Reserve this namespace: unknown passkey endpoints cannot fall through.
        if (path==="/medical/passkey" || path.startsWith("/medical/passkey/"))
          return response(request,{error:"NOT_FOUND"},404);
        return existingWorker.fetch.call(existingWorker,request,env,ctx);
      }
      if (!getDevelopmentPasskeyContext(origin))
        return response(request,{error:"ORIGIN_DENIED"},403);
      if (request.method==="OPTIONS") {
        const method=request.headers.get("Access-Control-Request-Method");
        const headers=(request.headers.get("Access-Control-Request-Headers")||"")
          .split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
        if (method!=="POST" || headers.some(value=>
          !["authorization","content-type"].includes(value)))
          return response(request,{error:"PREFLIGHT_DENIED"},403);
        return new Response(null,{status:204,headers:{
          "access-control-allow-origin":origin,
          "access-control-allow-methods":"POST",
          "access-control-allow-headers":"Authorization, Content-Type",
          "cache-control":"no-store",
          vary:"Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
        }});
      }
      if (request.method!=="POST")
        return response(request,{error:"METHOD_NOT_ALLOWED"},405);
      try {
        const identity=await verifySupabaseMedicalIdentity(request,{
          supabaseUrl:env?.SUPABASE_URL,
          supabasePublishableKey:env?.SUPABASE_PUBLISHABLE_KEY
        });
        if (!identity)
          return response(request,{error:"AUTH_REQUIRED"},401);
        return await handleRealDevelopmentPasskeyRequest(
          new Request(new URL(path,request.url),request),env,{id:identity.userId}
        );
      } catch {
        return response(request,{error:"PASSKEY_SERVICE_UNAVAILABLE"},503);
      }
    }
  };
}
