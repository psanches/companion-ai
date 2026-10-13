# Ativa demo implementation status · 13 October 2026

## Implemented

Five entirely synthetic records; patient profile; timeline; prescriptions; lab results; reports; full-text search; PDF creation/view/download/local import/removal; illustrative Portuguese explanations; server-side AI implementation; synthetic-only input boundary; shared-code demo sessions; durable global AI budget and caching; responsive CSS; large-text mode; keyboard/status accessibility.

All production source, root Worker configuration and existing medical security files/tests are unchanged. The new branch originates from `feature/medical-security-gates-20261012`.

## Confirmed locally

- Existing medical security suite: 139 passing tests.
- Demo unit/security and frontend DOM suite: 18 passing tests, including blocked medical routes, synthetic PDF allowlist, HMAC sessions, origin checks, strict AI input, upstream errors, concurrency-safe budget and restart persistence model.
- Isolated Wrangler dry-run bundle: succeeds; assets, new budget Durable Object and synthetic-only variables are the only bindings.
- Original medical staging assertion refuses the demo branch by design. No attempt to bypass or change it.

- Local Wrangler runtime preview could not start in this container (`uv_interface_addresses` system error). Hosted runtime and actual browser/device checks remain pending; dry-run bundling succeeds.

## Pending before claiming a working hosted demo

- Cloudflare sign-in/account access. No Cloudflare account token is available in the current workspace; cloud browser shows login.
- Configure existing user-authorized Lumi Research API key securely on the new Worker, and a new demo access-code secret. No live key has been accessed or written.
- Deploy new Worker and record returned URL. No demonstration URL is available until successful deployment.
- Verify a real OpenAI response and provider quota/model availability.
- Actual visual/device QA on desktop and Android; frontend DOM interaction tests do not replace device tests. Android PDF rendering varies by browser, so a native viewer/download fallback is supplied.

## Deliberate demo limits

No real patient data; no production record storage; only exact sample PDFs accepted; no arbitrary medical chat/upload text; prepared explanations explicitly distinguished from generated AI. Sample PDFs use basic Helvetica/ASCII transliteration; UI retains Brazilian Portuguese accents. A shared demo code does not provide individual patient authentication. No clinical, privacy, accessibility or penetration-testing certification is claimed.
