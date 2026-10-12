# Recovered development integration — NOT DEPLOYED
The baseline in recovered-development-baseline.js was recovered from Pedro's
already shared Worker code on 12 October 2026. Markdown formatting artifacts
were removed; no functional baseline changes were intentionally made.
It passes Node syntax checking and basic request tests. It has not been
compared byte-for-byte with the currently deployed Cloudflare Worker.
Secrets remain environment references; no credential values were added.

development-worker-entry.js wraps that recovered baseline and exports
MedicalPasskeyStore. Existing routes use the baseline; both /profile/medical
and /api/profile/medical namespaces remain unconditionally locked.
Both passkey route prefixes use real server-side verification and restricted
development-origin preflight.

No Cloudflare deployment configuration or migration is supplied. Do not
deploy this entrypoint over lumi-develop without reviewing the current
bindings, migration, bundling, development configuration and baseline parity.
Production is out of scope. Real medical data remains blocked.
Unit tests do not establish Cloudflare RPC compatibility or real-device
WebAuthn success. Actual browser/Android testing and review remain required.
