# Medical security implementation status — isolated branch

## Implemented in source (NOT deployed)
- Fail-closed authorization helper in `medical/security-gate.js`.
- Requires verified authenticated identity, successful server-side WebAuthn step-up and record ownership.
- Rejects requests if verifier functions are absent.
- Upload validation: maximum three files, five MiB per file, fifteen MiB combined, PDF/JPEG/PNG MIME types.

## Critical unfinished tasks (BLOCK real data)
1. Recover actual deployed `lumi-develop` Worker source; repo `worker.js` is NOT a reliable copy of deployment. Never overwrite the deployed Worker with it.
2. Implement and test server-side Supabase JWT verification (JWKS, issuer, audience, expiration).
3. Implement WebAuthn registration and challenge/response with origin, RP ID, challenge expiry, one-time consumption, replay protection and credential ownership. Never accept a client-provided `verified: true`.
4. Bind owner lookup to server-verified identity; test cross-user reads/writes and IDOR.
5. Implement encrypted medical data and file storage with server-side secret management and rotation plan. Never log PHI or return it in caches.
6. Enforce file count/size including already stored files, MIME magic bytes, quota, atomic writes, malware policy and storage access restrictions.
7. Build tests for 401, 403, replay, expired challenge, cross-user access, malformed uploads and failed encryption.
8. Verify on isolated staging Worker, including Android/PC; obtain consent and review LGPD obligations before volunteers upload anything.

This module is deliberately not wired to a route because the actual Worker implementation and authentication contract have not yet been reconciled. No security readiness is claimed.
