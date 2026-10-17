# Owner-authorized institutional publication

Pedro authorized the public-domain change on 2026-10-17, after reviewing the institutional development site. This is a website publication, not a promotion of the development application's experimental medical modules.

## Architecture

- `mylumicompanion.com/`: institutional English presentation; `/pt/`: Brazilian Portuguese.
- Separate `lumi-institutional-public` Worker, containing the reviewed bilingual bundle, its four fingerprinted assets and a small public router.
- `app.mylumicompanion.com/`: HTTP 302 entry to `https://mylumicompanion.com/?lumi_app=1`. The redirect deliberately retains the original application origin because the existing production email login hardcodes that callback origin. A full independent application-origin migration is not claimed complete.
- Application-mode requests, original resources/APIs and query-based authentication callbacks are delegated through the `LEGACY_LUMI` service binding to the existing `companion-ai` Worker. Its source, bindings and schedules are not overwritten. The `lumi-develop` Worker is not deployed by this workflow.
- The institutional page's same-origin script recognizes an authentication token/error fragment and navigates to application mode on the same origin, preserving the fragment. It does not store or transmit tokens. This preserves the existing implicit-flow callback without putting tokens in a server query string.
- A migration `/sw.js` retires the original root-scoped service worker and deletes only caches named `lumi-v<number>`. It does not clear local storage, account sessions, history or other caches.

## Caching and privacy

Institutional HTML revalidates; its four fingerprinted public assets are immutable for one year. Application HTML is private/no-store, and legacy resources revalidate. The institutional website has no accounts, contact form or analytics. The original application has its own authentication/privacy behavior. No email DNS changes are part of this publication.

## Deployment and recovery

The narrowly scoped `.github/workflows/lumi-publication.yml` requires the exact institutional branch and the owner-approved publication marker. Tests precede publication. The script first creates/verifies the new Worker and checks the delegated application homepage is byte-identical to the previously deployed production HTML. It creates and verifies the application entry before changing the root domain.

Cloudflare rejected direct reassignment of an occupied custom domain (HTTP 409 / code 100116). Transfer therefore explicitly detaches the existing custom-domain association immediately before attaching the same hostname to the new Worker. A brief routing/TLS propagation period is possible. On a failed check, the script detaches its own new association, restores the original `companion-ai` association and removes the newly created application entry. It refuses to replace an unexpected domain owner.

Manual rollback: in Cloudflare Workers & Pages, remove `mylumicompanion.com` from the custom domains of `lumi-institutional-public`, then add the same custom domain to `companion-ai` (production environment). Remove the `app.mylumicompanion.com` entry if no longer needed. Keep email TXT/MX/DKIM/SRV records unchanged. The untouched application Worker version before publication is `1018feab-0f67-4fda-9c68-195aa1341d9d`; the untouched development Worker version is `679f13c2-1469-4371-83eb-21cf3ca29c10`.

## Validation scope

Public-router contracts cover language/content/resources, cache headers, original application delegation, redirect, callback-fragment behavior and retirement of only the legacy shell cache. Browser tests cover eight Chromium desktop/Android viewport and language combinations with automated WCAG 2 A/AA and 2.1 AA rule checks, no overflow, navigation, contact links/downloads and language selection. This is not a WCAG certification or physical Android testing. A real user login and account/history/Calendar round trip after publication still require owner validation. Existing sessions/history are preserved by retaining their original origin; no account or storage migration is attempted.

## Successful publication evidence

- Published source commit: `3bc84be90e20905d59967fbd9872f24d922ba64b`.
- Cloudflare public-site version: `4025cf49-88d2-4184-a153-dc92c8e0954a`.
- Bundle release: `17c11800e93771ef43e1ebf4c943a12c763b2ef6c919900d24be92976ff5a5e4`.
- Successful pipeline: https://github.com/psanches/companion-ai/actions/runs/39036735983.
- Verified at 2026-10-17 13:32 UTC (10:32 São Paulo): English and Portuguese public pages, tested source header, contact address, exact four immutable asset hashes, migration service worker, application entry redirect and byte-identical original application homepage.
- Twelve Node contracts passed; all eight Chromium viewport/language scenarios passed with zero violations in the tested axe rules. Actual Android hardware and a real sign-in were not exercised.
- Production application Worker and development Worker source/configuration/schedule snapshots were unchanged. Email DNS was untouched.
- The first direct-transfer attempt failed with Cloudflare 409 and left/restored the original association. The successful attempt detached the occupied root domain immediately before reattaching it to the new public-site Worker. Rollback procedure above remains available.

The record-only documentation commit does not trigger another publication.
