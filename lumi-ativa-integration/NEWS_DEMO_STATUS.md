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
- Existing daily cron ran on 18 October at 09:00 UTC (06:00 Sao Paulo). Analytics report scriptThrewException, raw CPU p50/p99 99,898 microseconds = 99.898 ms, 30 subrequests. Unit confirmed directly from GraphQL schema field descriptions; an earlier conversational interpretation as ~100 seconds was incorrect.
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

The parser CPU defect is fixed and validated in the local Worker runtime. The exact cause of the original hosted cron exception is still not conclusively established: sampled analytics give an exception and CPU usage, not the offending source or stack trace. A hosted scheduled-run observation and live API behavior remain launch-time checks after authorization; the authorized isolated hosted regression below has now passed. Keep the news cron paused and do not deploy prepared code until the official beta launch.

## Authorized hosted validation completed (18 October)
- User authorized temporary deployment followed by pause/cleanup.
- Successful run: https://github.com/psanches/companion-ai/actions/runs/39131056541 . A temporary isolated Worker passed five real public page checks, the 1.4 MB malformed-metadata regression, the pipeline with simulated API responses/KV writes, and the static edition/paused handler checks. No real AI calls, user records or existing KV bindings were used.
- Existing Develop deployment ID was checked before and after and stayed unchanged. Its schedules stayed unchanged and empty. Temporary Worker deletion was confirmed by a 404 settings read after deletion.
- Earlier hosted preflight failed because CPU overrides are unsupported on this account's Workers Free plan. The unsupported override was removed; no plan upgrade or billing change was made. The successful run used the actual Free-plan constraints. A single successful invocation does not prove sustained CPU headroom for all future publishers or live discovery payloads.
- Read-only follow-up: https://github.com/psanches/companion-ai/actions/runs/39131111197 confirms empty schedules and authoritative GraphQL descriptions: cpuTimeP50 and cpuTimeP99 are microseconds. The incident value 99898 is 99.898 ms, not 99.898 seconds. This correction supersedes the earlier interpretation.
- Outcome: parser fix validated locally and hosted; demo static behavior validated hosted; temporary resources removed; live generation remains paused. Exact root cause of original scriptThrewException remains unproven without its exception stack/source payload. The incident was not marked as a confirmed exceededCpu outcome. No automatic news reactivation is authorized before beta launch review.
