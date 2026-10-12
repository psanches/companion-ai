# Lumi medical passkeys — development deployment gate

Status: **NOT DEPLOYABLE. Medical routes must remain locked.**

## Current verified scope
The isolated branch contains unit-test scaffolding for WebAuthn option creation,
registration, assertion verification, a Durable Object credential/challenge
store, Supabase Auth /auth/v1/user identity verification, and route authorization.
These are not end-to-end tests against the deployed development Worker.

## Critical work before enabling medical data
1. Integrate the **actual deployed** lumi-develop Worker source. The repository's
   worker.js is not the same as the deployed Worker. Never overwrite it.
2. Bundle @simplewebauthn/server for Cloudflare Workers and use its real
   generateRegistrationOptions, generateAuthenticationOptions,
   verifyRegistrationResponse and verifyAuthenticationResponse functions.
3. Add a Durable Object binding and migration in a *development-only* Worker
   configuration. Ensure its methods are only reachable via a trusted Worker
   after server-side Supabase identity verification. Do not use KV for atomic
   challenge consumption.
4. Implement credential listing, registration, revocation, recovery, and
   uniqueness constraints. Bind each credential to the verified user. Review
   counter handling and concurrency, including zero-counter authenticators.
5. Implement a short-lived, server-issued medical step-up authorization that
   is bound to the verified session, expires quickly, cannot be forged by
   the client, and is checked on **every** protected medical route.
6. Implement strict origin, CORS, CSRF and session-bound challenge policies.
   Ensure the relying party ID is valid for the development origin.
7. Verify all medical CRUD and upload routes are denied by default. Recheck
   file signatures and enforce storage size/ownership limits on the server.
8. Run real browser/Android passkey tests, replay/race tests, cross-user IDOR
   tests, negative JWT tests, expiry/revocation tests, and an independent
   security review before unlocking any real medical data.
9. Add monitoring, rate limits, privacy/LGPD retention, consent, and deletion
   controls before any real-user beta.

## Deployment rule
Production https://mylumicompanion.com/ must remain untouched.
Do not deploy this branch or merge it into develop automatically.
Medical demo stays fictional and non-persistent.
