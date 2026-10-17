# Lumi institutional presentation — isolated review

Branch: `feature/lumi-institutional-refresh-20261017`.

This folder is independent of the application. Never deploy it with the repository-root Wrangler configuration. The preview Worker has no bindings, secrets, schedules or custom routes. Nothing imports the Lumi application. Its fetch handler rejects production and lumi-develop hosts. No service worker, cookies, analytics, forms, third-party fonts or browser storage are used.

## Content and build

- `src/content.mjs`: complete matching English and Brazilian Portuguese copy.
- `src/site.css`: shared mobile-first visual design, keyboard focus and reduced-motion support.
- `build.mjs`: renders complete server-delivered pages at `/` (English) and `/pt/`; generates SHA-256 fingerprint asset names, local logo and inquiry text templates. No JavaScript is needed by visitors.
- `worker.mjs`: static preview routing, strict CSP, noindex, explicit cache policy and commit/release headers.

`npm ci --ignore-scripts && npm run build && npm test`. Browser validation: `npx playwright install --with-deps chromium && npm run test:browser`. Chromium tests simulate desktop/Android sizes and run axe WCAG A/AA rules; they are not real Android or accessibility certification. Screenshots/results are workflow artifacts. All content, links and translations also work without JavaScript. No claim is made that an experimental application feature is clinically validated.

## Contact activation

Pedro chose to create an institutional mailbox rather than publish his personal email. Confirmed addresses: `faleconosco@mylumicompanion.com` and `speakwithus@mylumicompanion.com`. Both remain subject to provisioning, DNS activation and delivery tests. The navigation label is Contact information / Informações de contato. Do not publish a mailto address until the mailbox exists, receives mail and replies successfully. The review site clearly marks contact as pending and offers a download-only inquiry template. It does not pretend to send a message. A functional inbox is a release blocker for presentation to institutions.

GoDaddy opens at a sign-in screen in the agent browser; mailbox creation requires the account owner’s authenticated access and any appropriate email plan. No password, purchase, DNS or production hosting changes were performed as part of this preview. Never collect the password in chat. If a new credential must be created, the account owner enters/submits it directly.

## Hosting investigation

Read-only HTTPS snapshot on 17 October 2026: `https://mylumicompanion.com/` returns HTTP 200, title Companion AI, Cloudflare headers and HTML SHA-256 `addb5365069f9edbdc03af37fffba7df2bbcbe6fb8fdd86ffe5e0e5bbdeecea3`, identical to `origin/main:index.html` at inspection. It is the application shell, not the institutional landing page. Repository root `wrangler.jsonc` names `companion-ai` with static directory `.` and backend `worker.js`. README mentions GitHub Pages as a manual alternative. There is no production deploy workflow in the inspected repository workflows. An older institutional presentation exists only on `feature/lumi-institutional-web-20261015` at `lumi-website/index.html` (commit ced822142a41b7e24c6d63b26b0a704432587263).

Pedro reports GoDaddy hosting/domain management. Public Cloudflare headers alone cannot establish whether GoDaddy manages the registrar, DNS, origin hosting or all three. The preview deployment performs read-only Cloudflare Pages/custom-domain inventory when permissions allow it and logs only safe source/routing metadata. Exact GoDaddy configuration must be verified in the authenticated account before promotion. The GitHub connector does not permit the `/pages` settings endpoint, so no unverified production auto-deploy claim is made.

The current development application identifies commit `6fcd58520d83dc9c8b367cf6d356552e2c36cfe8`; the before-preview homepage snapshot is SHA-256 `100cb918f959e9c7172df7410a8c6860592d038202a9f526b5ac4c7d950590a1`. Preview deployment hashes original source/modules, settings/bindings and schedules of companion-ai and lumi-develop before/after and asserts equality without exporting private values.

## Isolated preview deployment

Only `.github/workflows/lumi-institutional-preview.yml` can publish this folder and only on the exact branch above. It uses existing repository Cloudflare credentials, no new API key. The deploy script permits write URLs only for `/workers/scripts/lumi-institutional-preview-20261017` and its `/subdomain`; no custom-domain/zone/DNS writes exist. Read-only snapshots of companion-ai and lumi-develop are compared before/after. CI builds, runs contracts, browser/axe checks and screenshots before publication. Served pages, assets and commit/release identity are checked after rollout.

HTML revalidates on navigation; content-fingerprinted CSS/logo/text templates cache immutably for a year. Unknown paths return 404. The preview is noindex and does not register a service worker. Each tested immutable bundle is preserved by Git/Actions; the previous Cloudflare version can be reactivated for preview rollback. No private user state needs migration.

## Production plan — requires explicit authorization, not executed

1. Review both languages and layout evidence; finish verified institutional mailbox; confirm founder story and current feature wording. Complete actual Android, zoom and assistive-technology acceptance.
2. Inspect authenticated GoDaddy hosting/DNS and actual Cloudflare/custom-domain routing. Export exact current domain routes, assets, Worker version/settings and schedules to an appropriately protected rollback location. Never expose secret values.
3. Because the root domain currently serves the application, agree its permanent application URL and redirects first. Preserve existing OAuth redirect URLs, session origins, invitations, PWA scope and Calendar callbacks. Run regression tests at the intended application URL. Do not replace the root app with a landing page without that migration plan and explicit approval.
4. Build the approved website commit once. Create a separate production website target with only these static assets, adapting the preview-only host guard for the explicitly approved hostname. Remove preview banners/noindex and set correct canonical/hreflang absolute URLs only at promotion. Enable only the tested contact channel; no data-collection form without separate backend/privacy review.
5. After explicit approval, switch only the institutional domain/path routing agreed in step 3, using the snapshotted hosting provider settings. Never run root `wrangler deploy` for this folder. Verify both languages, asset hashes, email, links, no overflow and application auth/calendar/memory boundaries. Retain prior version and original routing.
6. If validation fails, restore the exact previous domain/path route or GoDaddy document-root package and reactivate the recorded original Worker version, as applicable to the verified hosting topology. Restore original settings/bindings/schedules if changed; never rewrite secrets from chat. Verify original homepage hash and original app/login/calendar callbacks. Stop rollout. DNS-only rollback may be delayed by TTL, so prefer a reversible route/document-root switch rather than changing nameservers.

There is intentionally no production deploy script. Exact production commands/target cannot safely be finalized until step 2 confirms GoDaddy/Cloudflare topology and step 3 resolves the root-domain application collision. The preview deploy script is exact and guarded; it is not a production promotion tool.

## Verified review release

- Preview: https://lumi-institutional-preview-20261017.psanchesnle.workers.dev/ (English) and `/pt/` (Brazilian Portuguese).
- Latest deployed source: `6fe2f76363855e0f65d81dae580869a5331e30e9`.
- Cloudflare version: `91ba6d6b-ee76-4485-ace4-0774c3e25b04`.
- Release: `85163834fc09704c83bf9d0b2f9eb17edf1615874df3d0d07a8adfc661fa8031`.
- Workflow: https://github.com/psanches/companion-ai/actions/runs/39027680126 . Six contract tests and eight Chromium scenarios (English/PT-BR at 1440×1000, 393×851, 320×640 and 851×393) passed; axe found zero violations in WCAG 2 A/AA and 2.1 AA rules tested. Keyboard skip/navigation, language switching, download, local-only requests and zero horizontal overflow passed. No JavaScript is required. These are simulations, not Android hardware or assistive-technology certification; actual zoom/user evaluation remains pending.
- Page content/screenshots were also verified in the initial successful run https://github.com/psanches/companion-ai/actions/runs/39027289496 ; its artifact includes eight full-page screenshots, built EN/PT pages and browser results. The later code change improves exact Cloudflare version evidence and narrows workflow triggers; public page content is unchanged.
- A read-only Cloudflare custom-domain inventory conclusively maps `mylumicompanion.com` to Worker `companion-ai`. Pages inventory was denied (403), so no Pages pipeline assertion is made. GoDaddy may be the registrar/email provider, but the active public website is served through this Worker custom domain. Account Git build settings still require authenticated inspection to finalize production promotion.
- Before/after source/modules/settings/schedule digests of companion-ai and lumi-develop matched. Only the separate preview script/subdomain was written. No application source file or production workflow was modified by this branch.
- Full readable content: `CONTENT.en.md` and `CONTENT.pt-BR.md`; source of truth remains `src/content.mjs`.
- First preview rollback version (before deployment-evidence correction): `2e2db468-3df8-4fdf-b7d8-d41b985beb43`, source `8d2d4957276b99f41c6a828396a4d7649ecfb01f`. In the Cloudflare dashboard for **lumi-institutional-preview-20261017 only**, Deployments → activate that version at 100%; verify its source headers and both languages. Do not select companion-ai or lumi-develop. The initial script-upload response's script identifier was not a UUID; exact version was subsequently read from the active deployment before being recorded here.

## Institutional email DNS follow-up

On 17 October Pedro supplied the exact GoDaddy Professional Email TXT, SPF, DMARC, DKIM, MX and autodiscover SRV settings. Public DNS confirmed `aria.ns.cloudflare.com` and `lee.ns.cloudflare.com`; there were no MX/SPF records and an existing DMARC quarantine policy. The isolated `lumi-email-dns.yml` workflow and `email-dns-setup.mjs` preflight the entire requested email-only record set, never delete records and never touch website address records, nameservers, routes or Workers. Conflicting existing senders/destinations stop for review; rollback snapshots are saved before any DNS write. The existing Cloudflare token returned 403 on zone access, **before any DNS mutation**. No broader token was created or requested. Email remains unconfigured pending authenticated DNS access.

DNS-specific new files: `email-dns-request.json`, `email-dns-setup.mjs`, `.github/workflows/lumi-email-dns.yml`. They do not run the website deployment workflow. Authenticating through the Cloudflare dashboard is a separate user-assisted step; the mailbox must still pass incoming and outgoing delivery checks before enabling a real institutional contact action. No test messages have been sent.

Google phone approval was completed, but the Cloudflare sign-in returned “Unable to sign in.” No successful authenticated DNS session or DNS write is claimed. Automated login stopped after this first generic failure. Manual account-owner continuation is required.

## Mailbox delivery confirmed, 17 October

The owner completed the GoDaddy setup and confirmed successful incoming and outgoing mail tests for faleconosco@mylumicompanion.com. Both MX records were independently verified through Google and Cloudflare DNS after correcting accidental numeric host names. The preview now enables only that verified mailto link. speakwithus@mylumicompanion.com remains explicitly unavailable pending provisioning and delivery testing; it has no mailto link. Contact information / Informações de contato remains the navigation and collaboration action label. No production/application deployment is authorized or performed.

Mailbox-enabled preview verified at source `8799b74d2e6467b90986df8400bc0addab69c551`, Cloudflare version `22571640-26c1-4bfa-af3d-a906f0b03f06`, release `d6730afb256292ac44e75760c8056eb57fcac675f8c6918610314f6472ab25f8`. Workflow https://github.com/psanches/companion-ai/actions/runs/39030642799 passed all six contracts and eight browser/axe scenarios. Public EN/PT responses independently identify that commit and contain only the verified faleconosco mailto link; speakwithus remains unlinked and explicitly unavailable. Source/modules/settings/schedules of production and lumi-develop were compared unchanged. The deployment JSON's legacy `contact` string still says pending and is not the source of truth for mailbox status: the rendered pages and owner-confirmed delivery test establish the active address. Update that diagnostic alongside the next deployment-script change; it does not affect served content. Latest screenshot artifact: 12099998751.
