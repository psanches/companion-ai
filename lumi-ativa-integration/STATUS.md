# Lumi + Ativa: deployment report

Verified 13 October 2026. Working sandbox: https://lumi-develop.psanchesnle.workers.dev/

## Works

- Lumi avatar, dark interface, warm Brazilian Portuguese conversation and synthetic Helena Exemplo scenario.
- Integrated profile, timeline, prescriptions, laboratories, reports, search and generated PDF viewer/download.
- Imported PDFs accept only exact provided fictional samples and stay in browser memory.
- Shared private-code activation, server-only AI credentials and a real synthetic AI answer verified after deployment.
- Fictional memory/routine and optional browser voice controls; voice starts off.

## Verification

GitHub Actions run 38470896332 completed successfully for deployed commit 22e1cbc36e5a94778270dfd73326cb1766ee8997. All 173 tests passed: 139 original medical security tests, 18 demo tests, 16 integration tests.

Live checks verified private session, real AI, local medical assets, medical route blocking, unchanged original endpoint statuses, preserved development baseline and bindings, and unchanged production Worker source. Browser interaction verified prepared exam explanation, embedded history and rendered consultation PDF in desktop Chromium. Screenshot: screenshots/desktop.jpg.

## Errors encountered and corrected

Initial internal calls returned HTTP 502; deployment checks automatically restored the preceding sandbox code. Added a dedicated service binding, served medical static files locally, explicitly activated the new Worker version, waited for its readiness marker and used manual redirect handling for internal synthetic API requests. The final deployment passed all checks.

## Scope and limitations

Production mylumicompanion.com was not deployed or modified. Original deployed development Worker bytes remain preserved server-side; existing secrets/bindings are retained. Real medical namespaces remain blocked. The frontend never calls existing real Memory, Calendar or Supabase history; displayed memory/routine are fictional.

Medical AI accepts only fixed synthetic record/question IDs, not unrestricted conversation or real medical input. Keys are server-only; four-hour secure HttpOnly sessions; global limit 50 AI calls/day, 500 output tokens/call, daily successful-answer caching and 100 login attempts/day. Prepared answers are clearly distinguished from generated answers.

Actual Android device, spoken voice/dictation and Android PDF behavior are not yet verified. Responsive styles exist, but desktop/browser and automated tests do not establish real-device validation. Browser speech features depend on support and may use the browser provider's speech service. Never dictate real information. No production medical-record storage is implemented or intended.
