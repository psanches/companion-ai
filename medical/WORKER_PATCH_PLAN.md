# Lumi development Worker: safe passkey integration

## Exact existing routing boundary
The previously shared development Worker authenticates with Supabase and
checks `user.id` before dispatching `/profile/medical` to
`handleMedicalProfile(request, env, user.id, route, cors)`.

Keep the existing medical handler's unconditional HTTP 403
`MEDICAL_STEP_UP_REQUIRED` response. Do not expose CRUD.

## Proposed small code change (NOT applied)
In the actual deployed Worker source, after the existing Supabase authentication
succeeds, dispatch these four POST routes to the server-side handler:
- /medical/passkey/register/options
- /medical/passkey/register/complete
- /medical/passkey/authenticate/options
- /medical/passkey/authenticate/complete

Handler: `handleRealDevelopmentPasskeyRequest(request, env, user)`
from `medical/development-passkey-real.js`.

The Worker must be bundled with `@simplewebauthn/server`. A single-file
Cloudflare editor script cannot directly import repository modules.

## Cloudflare prerequisites
- Existing `lumi-develop` bindings and secrets must be preserved.
- Add Durable Object binding `MEDICAL_PASSKEY_DO` for
  `MedicalPasskeyStore` with a reviewed migration.
- Review existing CORS for `https://dev.mylumicompanion.com`.
- Confirm actual deployed Worker code is the deployment baseline;
  repository `develop/worker.js` is not a safe replacement.
- Add credential revocation, recovery, rate limits, and uniqueness checks
  before allowing real users to enroll.
- Never enable medical data access as part of this patch.

## Status
Real verification imports and user-scoped credential listing are committed
on the isolated security branch. Deployment and real browser verification
are not yet completed.
