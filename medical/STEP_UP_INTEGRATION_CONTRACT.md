# Medical access step-up: integration contract (development only)

A successful passkey assertion is not itself authorization for every later medical
request. The existing medical route gate still needs a trustworthy server-side
proof of recent user verification.

## Required protocol

1. Verify the Supabase access token using the project's configured Auth service.
   Derive the user ID and session binding from that verified token, never from
   the request body.
2. Issue a fresh WebAuthn authentication challenge in the user's Durable Object.
   The challenge must expire quickly and be consumed atomically.
3. Verify the assertion cryptographically, check origin and relying party ID,
   require user verification, and atomically update the credential counter.
4. Only after successful verification, issue a random short-lived medical access
   grant. Store only its cryptographic digest, linked to the verified user and
   session. Never accept a browser-supplied `verified: true` flag.
5. On **every** medical read, write, delete, or upload request, verify the
   Supabase identity and atomically consume the grant. Check the requested
   resource's owner against the verified user. Fail closed on any error.
6. The grant must not survive a changed or expired Supabase session. Apply
   no-store response headers and strict development-origin controls.

## Tests still required

- Grant cannot be reused after a successful request.
- Concurrent attempts with the same grant allow at most one request.
- A grant from user A or session A cannot authorize user B or session B.
- Expired, malformed, or unknown grants fail closed.
- Credential revocation invalidates any remaining medical grants.
- All medical endpoints reject requests without a valid recent passkey step-up.
- Real device/browser end-to-end verification and independent security review.

## Deployment block

Do not remove the current unconditional medical 403 until the above is
implemented and verified against the *actual deployed* development Worker.
Never replace that Worker with the outdated repository worker.js.
Production must not be modified.
