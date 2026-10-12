# Lumi Medical Vault — security acceptance gates (Ativa pilot)

Status: NOT CLEARED FOR REAL MEDICAL DATA. This is a verification plan, not evidence of completed controls.

## Scope
Ten voluntary Ativa participants. The study evaluates Lumi, not the volunteers. Medical data must never enter aggregate beta metrics or administrator dashboards. Avoid reporting small health or demographic subgroups.

## Deployment source of truth
- Cloudflare development Worker currently deployed is authoritative; repository worker.js is known to differ.
- Export/reconcile deployed Worker before edits. Never deploy the stale repository worker.js.
- Do not change production, disable the medical deny-all gate, or upload real records until every gate passes.

## Required gates and evidence
1. **Authentication**: independently verify an unauthenticated request to each medical endpoint returns 401/403, never any data. Capture only status and timestamp, no payloads.
2. **Step-up**: use WebAuthn/passkey with server-issued, single-use challenge, origin/RP-ID validation, signature and sign-counter handling; reject replay, expired challenge, or normal login alone. Verify device compatibility and secure recovery. Do not accept browser-only PIN checks.
3. **Authorization**: test accounts A and B with synthetic records. Verify A cannot list/read/update/delete/download B's records, including guessed IDs and document URLs. Administrators have no blanket access.
4. **Encryption**: verify AES-GCM authenticated encryption with unique nonces, server-held secret/key management, no plaintext in KV, logs, analytics, backups, errors, or URLs. Test wrong key and tampered ciphertext.
5. **Consent**: plain-language, versioned, affirmative consent specifying purpose, access, retention, withdrawal, deletion and contact. Separate optional medical records from ordinary Lumi usage. Obtain applicable LGPD/legal and research ethics review before recruiting for real medical data.
6. **Files**: enforce file size/type, malware handling, encrypted storage, owner-scoped download, and no public file URLs. PDF/image parser must be isolated from prompts and never treat document content as instructions.
7. **Session safety**: short step-up validity, automatic lock, revocation after signout, audit events without medical content, rate limits, CSRF/CORS/origin protections.
8. **Reliability**: deploy versioned releases; check that PC and Android load same build, with no forced refresh during an active conversation.
9. **Pilot privacy**: obtain explicit volunteer consent; no personal health content in research report; only aggregate usability metrics, suppress identifying small groups.

## Minimum synthetic tests
- Anonymous medical GET/POST -> denied
- Authenticated without fresh step-up -> MEDICAL_STEP_UP_REQUIRED (or equivalent 403)
- Invalid/expired/replayed passkey proof -> denied
- Fresh valid proof -> only own synthetic record
- A accesses B record by ID -> denied
- File upload/download with B ID -> denied
- Sign out, retry prior proof -> denied
- Tampered encrypted record -> cannot decrypt
- Consent declined/revoked -> medical processing denied

## Go/no-go
**NO-GO** until deployed Worker source/config, each endpoint, and every gate above are verified with recorded results. A UI lock alone does not protect real records.

## First action
Read-only inspection of deployed development Worker code, routes, KV bindings, secrets' presence (never secret values), auth configuration and current medical response codes. Do not modify deployment during inspection.
