# Lumi Ativa demo — verified deployment, 13 October 2026

Preview: https://lumi-ativa-medical-demo.psanchesnle.workers.dev/

Implementation branch: `feature/ativa-medical-demo`.
Deployed source commit: `ff99a278215c305bbce64a8e65c6e2fdeb45568c`.
Successful deployment run: https://github.com/psanches/companion-ai/actions/runs/38465668784

## Working and verified

- Fictional patient Helena Exemplo and five wholly invented clinical records.
- Profile/history, prescription, laboratory table and reports; accent-insensitive document/history search and type filters.
- Valid one-page sample PDFs; native desktop Chromium viewer, download and exact-sample import into browser session memory. Real/modified PDF rejection is covered by automated tests. Browser download and reimport passed.
- Prepared Brazilian Portuguese explanations, explicitly labeled as prepared rather than generated AI.
- Server-side OpenAI explanations: a real response passed the hosted HTTP smoke check after deployment. Fixed synthetic IDs/questions only, no arbitrary patient text or uploaded documents sent to AI.
- Private AI session, secure HttpOnly cookie, same-origin POST, durable atomic global budget, daily response caching.
- Existing medical security suite: **139 passed**; demo backend/security/frontend DOM suite: **18 passed**. Both suites passed again in the deployment run before any deployment.
- Public HTTP page, blocked medical/API/history/memory routes, private session login and live synthetic AI response passed on the deployed Worker.
- Desktop browser QA: loaded page, search, PDF display, download/reimport, illustrative explanation, tab navigation and reset.
- Deployment and source use only the new `lumi-ativa-medical-demo` Worker. Production domain, `lumi-develop`, root Worker files/configuration and existing medical gates/tests were not changed.
- Desktop screenshot: `screenshots/desktop.jpg`.

## Remaining verification

Actual Android device verification remains pending. Responsive CSS, viewport declaration, large-text control, touch-sized buttons and frontend DOM tests are implemented, but these do not establish a real-device test. Android browsers that do not embed PDFs have a native-viewer/download fallback.

## Deliberate limits and security boundary

The workers.dev preview exposes only synthetic demo content; the access code protects AI usage, not the fictional profile or static source. It is not real-patient authentication or production medical-record storage.

Only original sample PDF bytes are accepted. Imported records live only in browser memory and disappear on reload/reset/removal; nothing is uploaded to a server. No arbitrary chat or editable patient-data fields are available.

OpenAI key and demo access code are server secrets on the new Worker, provisioned through masked GitHub Actions secrets. The key is reused with user authorization and shares its OpenAI project billing/quota with Lumi Research. AI is capped at 50 upstream calls/day (UTC), 500 output tokens/call, a 25-second timeout, fixed input and daily caching. `store:false` is set; no zero-retention certification is claimed.

The temporary Cloudflare deployment token expires on 17 October 2026. Its expiry does not stop the already deployed app; a new token is needed for later deployments. The token can edit Workers within the chosen account, while the workflow/script enforce the exact isolated Worker/config and never deploy root Lumi or medical staging.

The PDF iframe sandbox was removed after a real-browser failure prevented native Chromium PDF display. CSP permits blob objects/frames only for this generated, allowlisted PDF viewer; existing medical security code/tests remain unchanged.

No clinical validity, accessibility certification, or penetration-test certification is claimed.
