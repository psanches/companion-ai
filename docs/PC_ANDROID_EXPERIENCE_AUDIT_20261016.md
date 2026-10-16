# Lumi PC and Android experience audit — 16 October 2026

Scope: `lumi-develop.psanchesnle.workers.dev` only. Branch: `feature/pc-android-permanent-fix-20261016`, based on `093001b0f9c08b6dee2e07add988657225795840`, preserving the latest Calendar runtime correction. Production must not be deployed.

## Findings and root causes

| Symptom | Evidence and classification | Change |
|---|---|---|
| UI changes disappear after a Git deployment | Confirmed: `deploy.mjs` replaces the generated `ativa-assets.mjs` with the currently deployed module. Live homepage also has a mobile Mente e Corpo link absent from Git's generated homepage. | Reconcile that link into the builder; publish the tested Git assets; verify previous source snapshot hash before replacing it. |
| Different interfaces depending on deployment path | Confirmed: `main` uses `worker.js` and root static assets; the active development branch uses a multipart Worker preserving a baseline plus integrations. `wrangler.jsonc` at root targets `companion-ai`, not the development Worker. | Dedicated branch and guarded existing development pipeline; do not run root Wrangler deploy. Keep every packaged module and current bindings. |
| Premature deployment verification | Confirmed during the Agenda rollout: immediately after activation, the version probe still returned the previous commit, while the old broad homepage check had already passed. Automatic rollback preserved the stable version. | Poll until BOTH homepage headers and version endpoint match the expected commit and manifest; bounded failure still rolls back. |
| Unreliable asset identity | Confirmed: HTML loads `app.js?v=` plus `Date.now()`; local assets lack fingerprints; development asset responses use `no-store`; service-worker development cache name is fixed. Live homepage was already `no-store`, so current stale HTML was not established by the HTTP probe. | Content hashes, explicit HTML revalidation, immutable asset URLs, version endpoint and retained previous assets. |
| Update interrupts work | Confirmed by source: service-worker `controllerchange` immediately reloads the page, irrespective of drafts and dialogs. | No reload on controller change. Show update notice; reload automatically only after inactivity when drafts, focused composer, chat/research requests and open dialogs are absent. The notice participates in normal layout so it cannot overlay the composer or Send button. No draft persistence is added. |
| Login occasionally unresponsive | Confirmed failure paths: all app initialization depends on a floating external Supabase script; malformed locally saved JSON throws before login listeners are installed. This does not establish the cause of every historical incident. | Vendor the exact SDK version resolved during audit (2.118.0), fingerprint its bytes, and tolerate invalid local JSON. Login history now loads on SIGNED_IN rather than only initial page load. |
| Truncated buttons, missing navigation, overflow | Confirmed layout risks: mobile fixed button sizes and nonshrinking header action group compete for narrow width; the sidebar's fixed controls and flex conversation list can exceed short screens. | Wrapping header, intrinsic auth label width, minimum touch sizes, scrollable sidebar, inert hidden mobile sidebar, preserved Mente e Corpo and Notícias links. Verified viewport behavior in browser tests; historical screenshots alone do not establish a current reproduction. |
| Composer obscured by Android keyboard | Confirmed missing handling: `100dvh` shell has no visual viewport controller or interactive-widget declaration. A hardware reproduction was not available. | Android viewport resize policy plus visualViewport height at scale 1; composer does not shrink; only message list scrolls. Pinch zoom stays enabled. |
| “This site can't be reached” | Not reproduced in HTTPS development probes. No DNS/Cloudflare-zone configuration evidence establishes a cause. | No unsupported claim of a DNS fix. |

## Changed files

- `app.js`: robust saved-state parsing, post-login history load, in-flight chat flag; remove unsafe service-worker reload handler. Personality, message-history window and API protocol remain intact.
- `index.html`: keyboard resize hint, stable script tags, locally packaged authentication dependency.
- `sw.js`: public fingerprint assets only; migrate old Lumi caches; never cache HTML, sessions or API data. Cache bounded to 100 files.
- `frontend/build-release.mjs`, `version-worker.mjs`, `wait-for-release.mjs`: deterministic SHA-256 asset names; final Calendar-patched app bytes; release/commit endpoint; HTML references; cache headers; previous release fallback.
- `frontend/experience.css`, `experience.js`: viewport layout, touch sizes, focus, sidebar accessibility, safe update notification.
- `lumi-calendar/calendar-week-frontend.mjs`, `calendar-frontend.mjs`, `calendar.mjs`, `deployed-check.mjs`: current-week reader, authenticated weekly read API, existing Google connection/return flow and deployed security checks.
- `frontend/vendor/*`: pinned existing Supabase browser SDK and MIT license/provenance.
- `frontend/package*.json`, `*.test.mjs`, `browser-test.mjs`, `deployed-check.mjs`: cache/service-worker/regression contracts, simulated desktop/mobile browser flows and deployed-byte verification.
- `lumi-ativa-integration/build-assets.mjs`, `package-worker.mjs`, `worker-entry.mjs`, `deploy.mjs`: reproducible release packaging, preserve active modules/bindings, commit verification, baseline/asset drift guards and existing automatic rollback.
- `.github/workflows/lumi-ativa-integration.yml`: dedicated branch guard, frontend tests before publication, screenshots/JSON validation artifact.
- `.gitignore`, `.gitattributes`: generated files, test artifacts and dependencies excluded; vendor bytes kept unchanged.

## Agenda addition requested during validation

The signed-in sidebar includes **Agenda**. Following the user's Android acceptance request, every click opens the current Monday–Sunday week in Brasília time, with seven day groups, previous/next week, current week, date selection and refresh. It lists the connected primary Google Calendar, including events created outside Lumi. Opening it never creates an event. A new authenticated read-only weekly route queries Google once for the seven-day interval and preserves the existing read-only grant support. Post-creation event receipts still use the existing daily view. Missing Calendar consent now offers **Conectar Google Calendar** using the existing OAuth route, with a Google-origin URL check; the ordinary Google connection returns to the weekly agenda without affecting interrupted event creation.

The user reported that the Android screen showed only email sign-in, then clarified that the Google option was absent rather than describing a failed OAuth response. The canonical development link was supplied again. A confirmed source-level mobile risk was then addressed: opening Sign in forcibly focused the email field, which can raise the Android keyboard and scroll the Google choice above the visible area. The dialog now starts at its heading with both choices visible and does not request a text keyboard until the user selects email. Mobile browser tests assert the Google choice is visible before email focus. The current source and automated mobile flow contain **Continuar com Google**; the old shortcut/browser destination was not available for inspection, so its cause is not asserted or reported as fixed on hardware.

## Cache strategy and maintenance

HTML: `private, no-cache, max-age=0, must-revalidate`. Stable JS/CSS aliases: `no-cache, max-age=0, must-revalidate`. Fingerprinted JS/CSS: `public, max-age=31536000, immutable`; each hash is of the exact bytes returned. The final Calendar augmentation is included before hashing. Unknown hashes return 404, never unrelated HTML/JavaScript. Authentication and medical/API policies retain their original no-store behavior. `/sw.js` revalidates, and `/frontend-version` is no-store.

The service worker caches only same-origin `/_assets/<sha256>/...` resources, never private content. It removes legacy Lumi caches, leaves unrelated caches alone, and does not force a page reload. It intentionally does not provide an offline authenticated app. Previously downloaded public assets can be read offline; HTML and APIs still need a connection. The deployment carries the previous immutable asset collection (bounded to 100 entries) for open tabs. Very old tabs outside that retention must refresh online; indefinite historical asset hosting is not claimed.

Build once with `node lumi-ativa-integration/build-assets.mjs` under the tested `GITHUB_SHA`. Do not edit generated modules in Cloudflare. If an existing deployed snapshot differs from its recorded hash, the pipeline stops for review. The original Worker baseline remains an explicitly hash-verified deployed dependency, not a claim that all historical backend code has been reconstructed from Git.

## Validation and limitations

Local regression: 253 existing tests passed initially; final total with cache/deployment contracts, rollout convergence, standalone and weekly Agenda coverage is 272. CI results are recorded in the deployment evidence below. New tests cover immutable byte hashes, revalidation, unknown versions, original-handler boundaries, old-cache removal, offline public assets and version/rollback identity contracts.

Playwright uses Chromium and synthetic authentication/backend fixtures: 1440×900, 360×800, 393×851, 320×640, and 800×360. Tests check complete labels, click and keyboard activation, email/OAuth redirect contracts, signed-in navigation, six-message history with earlier-message loading, zero horizontal overflow, composer/send geometry, reduced-height keyboard simulation, draft-safe update notification, logout privacy and refresh. One scenario starts with malformed local state. Service workers are blocked in these routed UI fixtures. A separate real Chromium localhost test upgrades an installed legacy service worker, verifies old-cache removal, public asset access offline, uncached HTML/private requests, a subsequent deployment with retained prior assets, draft-safe updating, and rollback reload. The JavaScript harness also tests cache boundaries. These are isolated browser tests, not Android hardware tests.

No actual Android device, Gboard, installed-PWA upgrade, Samsung browser, assistive-technology or real Google consent was exercised. Real account sessions, private history and calendar events are not created or inspected by these fixtures. Existing Calendar integration tests exercise synthetic events; deployed checks verify anonymous writes, foreign-origin requests and invalid callbacks are denied. The first rollout triggered an automatic Cloudflare rollback because a new assertion mistakenly rejected legitimate demonstration clocks. The original source was restored and the legacy response was observed. That assertion was corrected and covered by a regression test; subsequent publication verified all served asset hashes. No separate manual rollback was performed. No claim of a fully verified production promotion is made until real Android/PWA and authenticated Google Calendar smoke tests are complete.

## Deployment evidence

The news validation for this frontend mission is read-only: it checks the existing five-story edition and page, without invoking the generation job or creating a temporary Worker. The cron and bindings are compared during deployment.

Final publication completed on 16 October 2026 at approximately 15:49 Brasília time.

| Evidence | Verified result |
|---|---|
| Deployed source commit | `c4596d80f6c2cdd74280317cc3ff4bb241c042b1` |
| Cloudflare version | `11af8e6c-70a5-4e40-8dfc-043b8d244a91` |
| Release manifest | `2082798a09ab974aee7950c29d1901a4c268301c819ea428c5d8c6d7b627affd` |
| Workflow | [Successful run 38950122403](https://github.com/psanches/companion-ai/actions/runs/38950122403) |
| Automated tests | 272 passed: medical 139, synthetic demo 18, integration/Calendar 85, Research 17, frontend contracts 13 |
| Browser scenarios | Five viewport scenarios passed; current-week Agenda opened and read the synthetic events in every scenario; Google sign-in choice was visible before text-keyboard focus |
| Service worker | Actual Chromium localhost upgrade/offline/next-release/rollback lifecycle passed |
| Deployed asset bytes | All nine immutable JS/CSS assets matched SHA-256 paths; independently rechecked after the workflow |
| Calendar security | Anonymous event/day writes denied; foreign origin denied; invalid OAuth callback denied; invalid session reached authentication and returned 401 |
| Medical restrictions | Real medical routes still 403; original baseline hash and modules verified |
| Existing features | Original backend route status/content-type boundaries preserved; new weekly route is read-only and authenticated; synthetic medical live AI passed; original conversation/history/personality code retained |
| News | Existing 16/10/2026 edition: five verified stories, with international coverage; read-only check passed |
| Schedule and bindings | Existing bindings preserved; `0 9 * * *` trigger retained and compared |
| Production | Source/module hash unchanged before and after development deployment; no production deployment |

Screenshots and browser results are downloadable from the workflow's `frontend-validation-c4596d80f6c2cdd74280317cc3ff4bb241c042b1` artifact. A report-only follow-up commit does not change the deployed runtime identity.

Additional live signed-out Chromium checks of the preceding cache-fix release (`9bd8880d0708199d58ecd02144e9cbd660f1f3d7`) through the environment's HTTPS proxy verified the real vendored SDK, the sign-in dialog and refresh on desktop and a mobile viewport without JavaScript exceptions. The proxy required ignoring its browser certificate trust error; these checks are not evidence of certificate validation or service-worker registration through that proxy. Normal HTTPS public probes independently verified the release and asset bytes. No real user login, private data or Calendar write was performed.

Two automatic restores were observed during rollout: one for an overly broad new clock assertion (then fixed and regression-tested), and one when the first version probe still identified the previous release (then fixed with bounded commit-plus-manifest convergence polling). The separate branch-specific legacy news smoke check also rejected the new branch; this mission now uses a read-only news check. These intermediate failures are not counted as successful releases. The final linked run passed every step.

## Final production-readiness assessment

Ready for continued development acceptance on PC and Android. **Not yet approved for production promotion**: real Android Chrome/Gboard and installed-PWA acceptance, real authenticated Google Calendar reading/creation/return (including the user-reported Android Google choice), and accessibility with actual zoom/assistive technology remain unverified. The production environment's deployment configuration and host guards require an explicit promotion review; do not use the root production-named Wrangler configuration to deploy this development package.

The inspected prior Cloudflare version before the final weekly publication was `b29cb4c2-c156-4c8f-ab63-13319fc02682` (cache-fix release `9bd8880d0708199d58ecd02144e9cbd660f1f3d7`). Rollback uses that prior development version and original module snapshot. The deployment restores the snapshot, schedules and active version allocation automatically if its protected checks fail. Historical public assets are bounded to 100 cached/retained files; indefinite support for very old open tabs and offline private access are intentionally not provided. Account authentication and API operations need a network connection.

## Follow-up: five recent conversations

The user requested that New Conversation archive the active conversation and show only the five most recent archives below the navigation. Older archives remain in KV without deletion. Confirmed frontend defects included sorting ISO dates with Number (NaN), dropping overlapping list refreshes, and no five-item bound. The server list now returns the newest five; successful archive/restore responses include metadata captured after the existing authenticated KV write completes. The original authentication, archive keys, saved content and restore behavior remain authoritative. A development-host-only wrapper binds native KV methods correctly and does not modify production behavior.

The frontend immediately merges successful archive metadata, tolerates temporarily older list responses, queues overlapping refreshes, prevents concurrent send/archive/restore, and rejects stale responses after account changes. Restore uses the returned saved history and preserves the existing six-message display with earlier-message loading. Failed archiving leaves the current conversation visible. Logout removes sidebar metadata. Files: app.js, index.html, frontend/experience.css, frontend/conversation-worker.mjs and its tests, frontend/browser-test.mjs, worker-entry.mjs and package-worker.mjs.

Local validation after this addition: 278 Node tests passed (six new archive-boundary tests), all five browser viewport scenarios passed with archive/new/restore and a deliberately stale list, and the separate real Chromium service-worker lifecycle passed. These fixtures use synthetic conversations; no private account archives were inspected. Follow-up publication succeeded at 16:05 Brasília time on 16 October 2026:

| Evidence | Result |
|---|---|
| Deployed commit | `581c8e31ef6217904be5645a7dc6fc7bb9ae6765` |
| Cloudflare version | `350b7769-93af-47d0-a20e-279e47b9adbc` |
| Release | `9595768ed84014d056317270276e86b4a441bec7e5a70af2ebdd2da35c595607` |
| Successful workflow | [38952163289](https://github.com/psanches/companion-ai/actions/runs/38952163289) |
| CI tests | 278 passed: medical 139, synthetic 18, integration/Calendar 85, Research 17, frontend 19; five browser scenarios and separate real Chromium service-worker lifecycle passed |
| Independent public probe | Nine fingerprinted assets matched SHA-256 bytes and tested commit/release after workflow completion |
| Preserved features | Calendar security checks passed without writes; existing five-story news edition verified read-only; bindings and cron preserved; production source unchanged |
| Rollback target | Prior development version `11af8e6c-70a5-4e40-8dfc-043b8d244a91` (commit `c4596d80f6c2cdd74280317cc3ff4bb241c042b1`) |

Browser evidence artifact: `frontend-validation-581c8e31ef6217904be5645a7dc6fc7bb9ae6765`. This is the latest runtime, superseding the weekly-publication evidence above. The same real-device and authenticated-Google limitations still apply. A report-only follow-up does not redeploy the runtime.

## Android navigation follow-up

The user confirmed both Google and email authentication choices are visible, but reported Mente e Corpo above the chat instead of in the left menu. Confirmed cause: build-assets injected a separate mobile-only link and experience.css explicitly displayed it below 900px. This was responsive duplication, not evidence of stale assets. Removed that injected element and its CSS. All navigation now uses the existing shared sidebar, accessible through ☰ on mobile. No authentication or backend behavior changed. Browser tests assert the duplicate is absent and Agenda, Mente e Corpo and Notícias de Saúde remain in the same sidebar order at all five viewports. Local frontend contracts (19), five browser scenarios and the real Chromium localhost service-worker lifecycle passed. Real Android acceptance remains pending.
