# Standalone feature return navigation — 2026-10-17

Confirmed defects: the Mind, Body & Psychology page replaced the chat without an application return link. The standalone Ativa demonstration and its fictional medical page also had no explicit return to the main application. Settings offered Save but no explicit cancel/return control. Existing Health News, memory, research, calendar, guide and other dialogs already had return/close controls; no blanket modal replacement was needed.

The development asset builder now adds one shared sticky navigation bar to the three standalone pages, with a 48px touch target, visible keyboard focus, an explicit `/` destination and `_top` target for embedded medical pages. It works on direct entry without relying on browser history or window.close. Its stylesheet is content fingerprinted and packaged with the required assets. Settings has a native dialog return form that closes without calling Save. No backend, account, memory, Calendar or medical permission logic changed.

Files: `frontend/subpage-navigation.mjs`, `frontend/subpage-navigation.test.mjs`, `frontend/return-deployed-check.mjs`, `frontend/browser-test.mjs`, `frontend/experience.css`, `index.html`, `lumi-ativa-integration/build-assets.mjs`, `lumi-ativa-integration/deploy.mjs`.

Validation: all 284 Node regression tests passed. Five desktop/mobile Chromium viewport scenarios passed, including direct visits to all three feature pages, scrolling, accessible return controls, keyboard activation back to the chat and cancellation of settings edits without storage changes. Live development checks verified return markup and packaged CSS on all three deployed pages. Physical Android hardware was not tested. The three-page checks run inside the protected deployment/rollback block.

Deployed commit: `ae653000888e5a0d34e2f960245dc63d370f8bf4`.
Cloudflare version: `b16c97a7-b59d-4624-82ca-1d0e03d4e06f`.
Successful validation/deployment: https://github.com/psanches/companion-ai/actions/runs/39052155598.
Application: https://lumi-develop.psanchesnle.workers.dev/.
Only development was deployed; the institutional website and production application were not published or modified by this change. Production source hash verification passed.
