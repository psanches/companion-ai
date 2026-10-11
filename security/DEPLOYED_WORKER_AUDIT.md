# Deployed lumi-develop Worker audit (user-provided editor export, 2026-10-11)

The actual deployed Worker export was inspected, not the outdated GitHub develop/worker.js.

## Confirmed medical routes
- After Supabase bearer authentication via authenticateUser, the router dispatches `/profile/medical` and `/profile/medical/export` directly to `handleMedicalProfile(request, env, user.id, route, cors)`.
- `handleMedicalProfile` accepts DELETE, GET, PUT; GET export uses the same read path.
- It stores per-user profiles under `medical:profile:v1:user:${userId}` in `env.MedicalStore`.
- AES-GCM uses a random 12-byte IV, a key derived from `env.MEDICAL_ENCRYPTION_KEY` and associated data containing userId.
- PUT requires `consentToStore:true`; `consentToAI:false`; the medical profile is not injected into `askOpenAI`.
- **There is no WebAuthn/passkey step-up check on these medical routes.** Any valid ordinary session can invoke them.

## Priority
1. Before enabling real medical data, deny all medical GET/PUT/DELETE/export until a verified server-side WebAuthn grant is implemented. Prefer the route guard before handleMedicalProfile; do not rely on UI hiding buttons.
2. Save a genuine original-source backup in Cloudflare. The shared export is Markdown-rendered/escaped (e.g. HTML entities and escaped punctuation), **not safe to paste as executable JS without reconstruction and syntax tests**.
3. Build passkey registration and assertion verification using audited library; persist credential records and single-use challenges in strongly consistent storage, not eventual-consistency KV.
4. Add scoped, expiring, session-bound grants and check all four operations.
5. Verify device/browser compatibility and recovery, and test negative cases.
6. Deploy dev only after explicit review; do not touch production.

## Safest immediate route guard (not yet deployed)
Insert in the actual Worker, after normal user authentication and before existing medical route dispatch:

```js
if (route === "/profile/medical" || route === "/profile/medical/export") {
  return medicalJson(
    { error: "Medical access temporarily locked pending passkey verification",
      code: "MEDICAL_STEP_UP_REQUIRED" },
    403,
    cors
  );
}
```

This is a temporary **deny-all** guard, not passkey functionality. It must be removed/replaced only after the real verifier is deployed and tested.
