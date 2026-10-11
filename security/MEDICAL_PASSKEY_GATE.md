# Lumi medical profile: passkey step-up security (development)

## Status
**Design and deployment gate only. NOT enabled.** Do not store real medical information yet.

## Threat model
Remember-me grants a normal Supabase session, not permission to read or change medical records. A stolen session token, a shared PC, or a malicious browser extension must not automatically unlock medical records. Browser-only flags, localStorage timestamps, a prompt PIN, and WebAuthn assertions verified only in JavaScript are **not** acceptable authorization.

## Proposed flow
1. Authenticate normal Lumi account with Supabase; verify JWT server-side for every medical API call.
2. Enroll a passkey through WebAuthn registration, requiring user verification. Bind credential ID, public key, sign count and user ID in an access-controlled server store. Require reauthentication to add/remove credentials.
3. To unlock medical data, request a fresh, single-use challenge from the Worker. Challenge is cryptographically random, expires in 2 minutes, is scoped to user ID + action + relying-party ID + expected origin, and is consumed atomically.
4. Browser calls navigator.credentials.get with userVerification='required'. Worker validates clientDataJSON.type, challenge, origin, authenticatorData RP ID hash, user-present and user-verified bits, and the assertion signature with the registered public key. Check signature counter when supported.
5. On successful verification, issue a server-side, opaque, short-lived authorization bound to user/session and action scope. Store only a hash of the grant, with 10-minute maximum expiry. Never use a client-supplied 'verified' flag. Expire on logout, credential removal, or session change.
6. Every GET/PUT/DELETE for medical records checks Supabase session **and** the server-side step-up grant. Deny with 403 if absent/expired. Require a fresh step-up for deletion or credential changes.
7. Encrypt medical data at rest with AEAD (AES-GCM) and unique random nonces; keys are Cloudflare secrets, never frontend code. Include user ID as authenticated associated data; enforce per-user ownership on reads and writes.
8. Use restrictive CORS, CSRF defenses where cookies are used, security logging without medical values, rate limits, explicit consent, and tests for replay, wrong user, expired challenge, invalid signature, mismatched origin/RP ID, UV missing, and revoked grants.

## Relying party deployment detail
WebAuthn credentials are origin/RP-ID scoped. Choose the final dev hostname (dev.mylumicompanion.com) and RP ID (mylumicompanion.com only if intentionally sharing credentials across subdomains); never silently mix workers.dev and dev.mylumicompanion.com. Supabase auth Google OAuth is **not** a passkey step-up.

## Blockers
- Inspect **actual deployed** lumi-develop Worker source: repository worker.js does not implement /profile/medical, while a fictional test reportedly succeeded. Replacing it risks breaking working functionality.
- Confirm existing MedicalStore binding and encryption strategy.
- Install and bundle an audited WebAuthn verification library such as @simplewebauthn/server, or independently review a standards-compliant implementation; do not hand-roll cryptographic assertion verification.
- Test real passkey registration and authentication on PC and Android, with recovery procedure and a device without biometric hardware.
- Only then enable real medical input persistence.

**Release rule:** Medical fields may be editable as a non-persistent preview, but saving, reading, or deleting real medical records remains disabled until the complete server-side checks pass.
