/**
 * Actual cryptographic WebAuthn functions for development.
 * Never replace these with a mock in deployed routes.
 */
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
import {handleDevelopmentPasskeyRoute} from "./development-passkey-routes.js";

const realVerifiers={
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse
};

/**
 * Mount after the existing Supabase authenticateUser(request, env) succeeds.
 * Do not expose medical profile CRUD; leave the 403 lock intact.
 */
export function handleRealDevelopmentPasskeyRequest(request,env,verifiedUser) {
  return handleDevelopmentPasskeyRoute(request,env,verifiedUser,realVerifiers);
}
