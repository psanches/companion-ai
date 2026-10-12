# Isolated Cloudflare staging deployment
Worker name: lumi-medical-security-staging
Branch: feature/medical-security-gates-20261012
Build root / Path: medical
Build command: npm test && npm run build:staging
Deploy command: npm run deploy:staging
Preview builds: OFF

The deployment script refuses other branch names and other Worker names.
No custom domain, production routes, production KV, medical store, or API
keys are configured. Do not attach production resources.
The first deployment supports the health endpoint and negative security checks.
Existing chat/calendar routes require their separate test bindings to function.
Passkey success testing requires trusted test Supabase configuration; it remains
fail-closed until configured. Medical profile reads/writes/uploads stay blocked.
Only synthetic passkey test accounts should be used. Recovery, revocation,
rate limits and global credential uniqueness remain prerequisites for real users.
The Cloudflare entry uses a DurableObject RPC subclass with a separate SQLite
namespace. Unit tests and dry-run bundling do not replace deployed RPC/device tests.

The wizard's selected build token reports missing artifacts_read and
artifacts_write. Do not change the existing production build token blindly;
resolve this for an isolated staging build token if the build requires it.
