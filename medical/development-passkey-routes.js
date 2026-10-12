/**
 * Development-only passkey endpoint handler.
 * Must be mounted ONLY after existing authenticateUser() succeeds.
 * This is an integration adapter, not an automatic deployment.
 *
 * Requires:
 *   env.MEDICAL_PASSKEY_DO: per-user Durable Object binding
 *   user: trusted result of authenticateUser()
 *   deps: actual @simplewebauthn/server functions
 *   verifySupabaseMedicalIdentity: verified token session binding
 *
 * The medical profile handler MUST retain its unconditional 403 lock.
 */
import {verifySupabaseMedicalIdentity} from "./supabase-verified-identity.js";
import {beginMedicalPasskey,completeMedicalPasskey} from "./medical-passkey-orchestrator.js";

const reply=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json","cache-control":"no-store",
  "x-content-type-options":"nosniff"}
});
const routes=new Map([
  ["/medical/passkey/register/options","register"],
  ["/medical/passkey/authenticate/options","authenticate"],
  ["/medical/passkey/register/complete","register"],
  ["/medical/passkey/authenticate/complete","authenticate"]
]);
export async function handleDevelopmentPasskeyRoute(request,env,user,deps={}) {
  const url=new URL(request.url);
  const mode=routes.get(url.pathname);
  if (!mode) return reply({error:"NOT_FOUND"},404);
  if (request.method!=="POST") return reply({error:"METHOD_NOT_ALLOWED"},405);
  if (request.headers.get("Origin")!=="https://dev.mylumicompanion.com")
    return reply({error:"ORIGIN_DENIED"},403);
  if (!user?.id || !env?.MEDICAL_PASSKEY_DO)
    return reply({error:"PASSKEY_NOT_CONFIGURED"},503);
  const verifiedIdentity=await verifySupabaseMedicalIdentity(request,{
    supabaseUrl:env.SUPABASE_URL,
    supabasePublishableKey:env.SUPABASE_PUBLISHABLE_KEY,
    fetcher:deps.fetcher
  });
  if (!verifiedIdentity || verifiedIdentity.userId!==user.id)
    return reply({error:"AUTH_REQUIRED"},401);
  let body;
  try {
    if (Number(request.headers.get("content-length")||0)>65536)
      return reply({error:"PAYLOAD_TOO_LARGE"},413);
    const raw=await request.text();
    if (raw.length>65536) return reply({error:"PAYLOAD_TOO_LARGE"},413);
    body=JSON.parse(raw);
  } catch {return reply({error:"INVALID_JSON"},400);}
  const store=env.MEDICAL_PASSKEY_DO.get(
    env.MEDICAL_PASSKEY_DO.idFromName(verifiedIdentity.userId)
  );
  if (url.pathname.endsWith("/options")) {
    const credentials=await store.listCredentials(verifiedIdentity.userId);
    const result=await beginMedicalPasskey({
      verifiedIdentity,mode,store,credentials,
      userName:user.email || verifiedIdentity.userId,
      generateRegistrationOptions:deps.generateRegistrationOptions,
      generateAuthenticationOptions:deps.generateAuthenticationOptions
    });
    return result?reply(result):reply({error:"PASSKEY_SETUP_FAILED"},503);
  }
  const success=await completeMedicalPasskey({
    verifiedIdentity,mode,store,
    challengeId:body?.challengeId,response:body?.response,
    verifyRegistrationResponse:deps.verifyRegistrationResponse,
    verifyAuthenticationResponse:deps.verifyAuthenticationResponse
  });
  // Deliberately no medical access grant yet.
  return success?reply({ok:true,medicalAccess:false}):
    reply({error:"PASSKEY_VERIFICATION_FAILED"},403);
}
