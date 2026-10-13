# Lumi + Ativa in the authorized development sandbox

Pedro explicitly authorized integrating the fictional medical demonstration into `lumi-develop` on 13 October 2026. Production `mylumicompanion.com` remains out of scope. This supersedes the earlier instruction not to change the development Worker for this integration only.

## Experience

Lumi's existing dark visual style and avatar are reused. The development demo adds warm conversational explanations, a same-origin integrated medical record viewer, voice output off by default, optional Brazilian Portuguese dictation, large text, synthetic scenario memory and a fictional routine. PDF/history/search functions remain from the verified Ativa medical module, now themed for Lumi.

The presenter uses the same private demo code in settings or the medical module. Activation is shared via a secure HttpOnly cookie. Chat answers refer only to Helena Exemplo and the synthetic records. Natural typed questions are mapped locally to fixed scenario/question IDs; arbitrary input never goes to the server and is not copied into chat history. Voice dictation uses the browser's speech service when supported and explicitly activated; do not dictate real information.

Memory and calendar shown in this presentation are fictional, explicitly labeled, and never call the existing real history/Memory/Google Calendar APIs. No Supabase patient account or original chat history is used by this synthetic frontend. Existing non-demo backend endpoints remain delegated unchanged for other existing clients.

## Exact baseline preservation

Read-only Cloudflare inspection confirmed a single deployed `worker.js` module with SHA-256 `4aa869208a980a8c5a0cd9c29458d782373492cbc7cb1f955d44f49b1f60fde4`. The script preserves those exact bytes as a server-only module and wraps it; it never substitutes the stale recovered repository Worker.

The Cloudflare upload API retains existing binding types with `keep_bindings`, preserves the compatibility date/configuration and adds only the `LUMI_ATIVA_DEMO` service binding to the synthetic backend. Worker-to-Worker calls use that internal binding, because URL-based calls within workers.dev failed with HTTP 502. The first attempt restored the exact prior development code automatically. Before and after upload, checks compare the configuration and exact preserved baseline source. No private deployed source or secret value is logged, committed, or exported. Existing code is obtained only in runner memory and remains in Cloudflare.

Changes apply only on `lumi-develop.psanchesnle.workers.dev`. Other hostnames delegate to the exact original backend. Real medical namespaces fail closed on the sandbox, independent of authentication. Synthetic API requests proxy only to the fixed Ativa demo Worker, forwarding only the demo session cookie—not Supabase credentials, original cookies or freeform text. Medical pages permit only same-origin iframe embedding.

## Deployment and verification

`request.json` must have `mode:deploy`, `target:lumi-develop`; workflow runs only on `feature/lumi-develop-ativa-integration`. It runs unchanged medical tests, demo and integration tests, packages static public UI, updates the isolated synthetic backend tone, then applies the sandbox wrapper. It never invokes the root Wrangler deployment.

Post-upload checks verify the page, integrated medical module, medical locks, original unauthenticated endpoint statuses, preserved config/source, unchanged production source hash, private demo session and a real synthetic AI response. If any check fails after upload, the exact previous development content is restored automatically. No production deployment occurs.

Browser/device verification is recorded separately after successful deployment. Actual Android dictation/PDF behavior depends on browser support. Code-based checks do not establish real-device verification.
