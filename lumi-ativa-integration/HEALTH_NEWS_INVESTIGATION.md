# Lumi Health News — investigation and repair, October 16, 2026

Scope: `lumi-develop` only. Production `mylumicompanion.com` / Worker `companion-ai` is excluded from writes.

## Root cause established from repository and Cloudflare evidence

| Time (São Paulo, Oct 15) | Evidence |
| --- | --- |
| 07:25 | GitHub deployment run 38720085300 activated version `95ceafb1`. |
| 16:52 | Commit `9b90169` added `health-news-daily.mjs`; its green workflow was validation **without deployment**. |
| 17:07 | Cloudflare records an editor deployment of version `5e1f1d38`. |
| 17:13 | A Dashboard deployment activated `e8d6e35d-f709-46fe-8739-a5f20bf9c141` at 100% traffic. |
| 18:08 | Cron `0 9 * * *` was created, after the stale entry had been activated. |

The active version's Cloudflare metadata listed only `fetch`, with `last_deployed_from: dash`. Its `worker.js` hash was `8baa5c39b41d618bd6bf7f45ce3a833b6660702dc0d3e6169864b1bfc7ec5c2c`, an exact byte match to the old uploader's generated entry. Its eight-module package omitted `health-news-daily.mjs`.

Thus a later Dashboard publication activated the old entry/package. Separately, the GitHub uploader was also guaranteed to omit the news module on future deployments: it generated an inline entry and uploaded a fixed module list without the news module or scheduled wrapper. Editor-only changes had no persistent representation in that deployment path.

The available evidence identifies the final overwrite state, source and activation time. It does not identify which exact UI gesture discarded each earlier editor copy; do not invent that detail or blame a GitHub run after the news commit, because no such deployment was found.

`HEALTH_NEWS_KV` and the intended cron both existed during inspection. Missing KV did not cause the missing-handler error: that error occurs before the generator can access KV.

The repository's root `wrangler.jsonc` targets production `companion-ai`, with root `worker.js` as entry. It is **not** the sandbox build configuration and must not be used for this repair. The sandbox is deployed through `.github/workflows/lumi-ativa-integration.yml` and its target-guarded uploader.

## Permanent implementation

- `worker-entry.mjs` and `package-worker.mjs` define the tracked entry and complete upload package, including `health-news-worker.mjs` and `health-news-daily.mjs`.
- The wrapper attaches a default `scheduled()` handler for `0 9 * * *` (06:00 São Paulo); delegates existing backend routes, other schedules and handler receivers; and serves stored public editions at GET `/health-news`. HTTP reads do not generate paid requests.
- The uploader verifies that Cloudflare registered `scheduled`, compares every uploaded module hash, preserves existing bindings and cron triggers, and refuses to silently discard unknown modules. Rollback uses the previously **active deployment**, not the newest uploaded version, and restores previous schedules.
- Live baseline and frontend changes made after the historical Git deployment are preserved byte for byte: baseline `e0631cc2dc97dba8527d684c28ea990141be7180ce49875536f7cc4aaa67066c`; assets `8b23b20e2576b9d4137f2dbb0981d7506aa5d50b59b09d0ddcf1f5c4b94349e1`. Other existing integration modules match the repository.
- Read-only preflight records deployment/version history, registered handlers, module hashes, binding names/types and schedules without logging source or secret values.
- Ordinary pushes validate without deployment. The explicit `[health-news-develop-deploy]` marker on the existing authorized sandbox branch runs the guarded repair deployment; manual confirmation remains supported. `[health-news-runtime-check]` runs only the runtime verification.

## Additional generator defect found by live testing

The initial live generator request returned text that could not be parsed as JSON. The repaired request uses strict JSON schema for exactly five stories, low reasoning effort, a bounded 6,000 output-token budget, at most three built-in tool calls, a 120-second deadline and `store:false`. It requires web search and rejects incomplete responses before writing storage. It uses the existing dedicated Lumi Research key when available, with the existing main key as fallback. No new OpenAI key was created.

The last valid edition is retained on failure. Reusing a cached daily edition repairs the latest-edition pointer if a previous history write succeeded but the pointer write failed.

## Verification

- 44 integration/research tests, 139 medical security tests and 18 synthetic demo tests passed locally: **201 total**.
- Tests import the exact upload package's `worker.js` and verify its executable default scheduled handler; cover dispatch, route/receiver preservation, HTTP read-only behavior, daily reuse, latest-pointer repair, failed generation, structured requests and incomplete/unsearched result rejection.
- Deployment checks validate original homepage/app assets, research authentication, existing route statuses, synthetic medical demo/session/live AI, blocked real medical routes, unchanged baseline/bindings and unchanged production source hash.
- Direct KV API testing returned HTTP 401 because the deployment token lacks that API permission. Permissions were not expanded. Runtime verification instead creates a temporary Worker bound only to the public-news KV and existing dedicated research key, exercises the same scheduled wrapper, checks the edition through Lumi, and deletes the temporary Worker in `finally`.
- A runtime test is distinct from observing a real cron event. The next scheduled invocation after this repair is October 17 at 06:00 São Paulo.

## Completed live result

[Deployment and runtime verification run 38886799519](https://github.com/psanches/companion-ai/actions/runs/38886799519) completed successfully on October 16.

- Active sandbox version: `68f60c7f-70d8-43d2-9538-08d1bdfe5291`, deployed from commit `91cbebbbb0e42993c7d356556e9f9162e86e19ee` at 10:22:54 UTC.
- Cloudflare registered `scheduled`; cron remains `0 9 * * *`.
- Runtime verification returned `publicNewsEditionVerified:true`, date `2026-10-16`, five items, at 10:23:10 UTC.
- Temporary verification Worker removal completed at 10:23:11 UTC.
- Deployment confirmed `productionSourceUnchanged:true`, `bindingsPreserved:true` and `liveAI:true`.

Links: [Lumi Develop](https://lumi-develop.psanchesnle.workers.dev/) · [stored public edition](https://lumi-develop.psanchesnle.workers.dev/health-news).

Continue future news changes in the tracked modules on `feature/restore-lumi-home-20261014`, using the guarded development workflow. Publishing a stale Dashboard version can still revert any feature; dashboard-only edits are not a source-of-truth workflow. No real automatic cron invocation after the repair has yet been observed.
