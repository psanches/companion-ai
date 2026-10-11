# Development Worker reconciliation — 2026-10-11

## Confirmed from GitHub
- `develop/worker.js` is a legacy, standalone Worker with permissive `Access-Control-Allow-Origin: *` and no `/profile/medical` route.
- `develop/app.js` uses `https://lumi-develop.psanchesnle.workers.dev/` for backend requests.
- `develop/index.html` previously issued `PUT /profile/medical` with fictional data from a browser test. The test button has now been removed from `develop` while server-side step-up is incomplete.
- Passkey code in `security/` on this feature branch is NOT deployed, wired into the Worker, or verified end to end.

## Unknown — must not guess
- Actual Cloudflare deployment source and its route order, secrets, storage bindings, encryption configuration, and authentication implementation.
- Whether `/profile/medical` is reachable with a normal session without step-up.
- Whether any medical data is currently stored, how it is encrypted, and whether a secure delete path exists.

## Safe integration checklist
1. Export actual `lumi-develop` Worker source and environment binding **names only** (never secrets), and compare with GitHub.
2. Preserve chat, history, memory, calendar and authentication routes. Do not replace deployed Worker with legacy `worker.js`.
3. Add audited WebAuthn verification dependency and durable challenge/credential storage.
4. Add authorization middleware to **all** medical GET, PUT, DELETE routes before they read or write.
5. Require user verification, enforce challenge replay protection, and use an origin/RP ID matching dev.mylumicompanion.com.
6. Verify at-rest encryption with test vectors and delete semantics.
7. Run negative security tests before enabling any medical data persistence.
8. Deploy to development only after review, with rollback snapshot; production requires explicit user approval.

## Current release decision
**Blocked:** Missing actual deployed Worker source and verified server integration. Do not represent the feature as finished or ask users to enter real medical information.
