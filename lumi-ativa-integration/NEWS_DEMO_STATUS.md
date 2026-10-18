# Health news: static demo and technical follow-up

Decision (18 October 2026): no Worker code deployment before the official beta launch in Develop. Keep production untouched. Prepare static demo code and pause the existing news cron only.

## Prepared, not deployed
- Frozen public edition of 17 October 2026 (five existing stories, original publication dates and source links preserved).
- Visible static demonstration notice and no automatic refresh or generation.
- Static endpoint reads bundled data, without KV or AI calls.
- News scheduled handler becomes a no-op; unrelated schedules are preserved.
- Live generation smoke workflow disabled. Deployment code no longer automatically re-adds the news cron.

## Technical evidence
- Cloudflare token revalidated successfully after secret update.
- Existing daily cron ran on 18 October at 09:00 UTC (06:00 Sao Paulo). Analytics report scriptThrewException, CPU p50/p99 99,898 ms, 30 subrequests.
- Publication metadata attribute parsing used an unanchored regex with quadratic behavior on malformed attribute names. A synthetic 100 KB name took about 11.25 seconds locally.
- Prepared replacement scans each attribute once. A 500 KB malformed name plus valid publication metadata passes in about 40 ms locally; date-conflict and source-verification checks remain covered.
- This reproduces and fixes a CPU-exhaustion defect, but the available Cloudflare analytics do not establish that this specific input caused the observed cron exception. Do not report full incident closure yet.

## Launch gate
Before enabling automatic news: validate the prepared fix with representative publisher HTML and the actual Worker runtime in an approved prelaunch window; confirm the exact exception and CPU headroom, generation/storage behavior, cost limits and failure recovery. Re-enable scheduled generation only after explicit launch approval. No live AI calls or temporary Worker deployments were performed during this static-demo preparation.

## Validation completed before beta (18 October, additional evidence)
- All five original public source pages were downloaded and checked: 117–160 KB each. Fixed and previous parsers returned identical source evidence, dates and extracted content. Fixed verification used approximately 2–5 ms elapsed per page locally.
- Malformed-attribute tests at 10 KB, 100 KB, 500 KB and 1.4 MB passed. The largest case took approximately 54 ms in Node. The previous parser exceeded a one-second deadline at only 100 KB (earlier full measurement: 11.25 s).
- Entire generation pipeline passed using those real page bodies, two simulated API responses, five verified output items and three simulated KV writes. Zero real AI requests.
- Local Cloudflare workerd 1.20261018.1, compatibility date 2026-10-06 (matching deployed settings): PASS, approximately 82.89 ms reported for the test. Covered the five real pages, 1.4 MB malformed metadata, complete mocked generation pipeline, static endpoint with no storage/credential access, paused news handler and preserved unrelated schedules.
- Existing GitHub validation: ten tests passed; operational pause confirmed news cron removed, remaining schedules empty, no Worker code deployed.
- Reproduction: install workerd@1.20261018.1, then run WORKERD_BIN=/absolute/path/to/workerd node lumi-ativa-integration/health-news-local-validation.mjs. This downloads public source fixtures, uses no API credentials, starts no hosted Worker and deploys nothing. Public pages can subsequently change or become unavailable; such failures must be reviewed, not bypassed.

The parser CPU defect is fixed and validated in the local Worker runtime. The exact cause of the original hosted cron exception is still not conclusively established: sampled analytics give an exception and CPU usage, not the offending source or stack trace. A hosted scheduled-run observation and live API behavior remain launch-time checks after authorization. Keep the news cron paused and do not deploy prepared code until the official beta launch.
