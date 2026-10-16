# Google Calendar creation restoration — development only

Inspected 2026-10-16. Target: `lumi-develop.psanchesnle.workers.dev`. Production is excluded.

## Root cause

Read-only Cloudflare inspection found the exact message in deployed module `ativa-baseline-preserved.mjs`, under `route === "/calendar/events" && request.method === "POST"`. An unconditional `return json({error: "Criação de eventos temporariamente bloqueada."},403,cors)` precedes the previous creation implementation. This is an intentional code-level write lock, not an OAuth feature flag or evidence of missing credentials. The inspected baseline SHA-256 is `e0631cc2dc97dba8527d684c28ea990141be7180ce49875536f7cc4aaa67066c`.

The live frontend was also different from repository `app.js`: it parsed only tomorrow's requests, assumed a one-hour duration, posted immediately and reported success on any successful response. Simply removing the lock would restore an unsafe, unconfirmed write path. A separate backend chat helper already supported preparation and exact-text confirmation, but the live frontend bypassed that helper. Its KV deletion before creation was not a concurrency-safe duplicate barrier.

Bindings for `Memory`, `CALENDAR_SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` exist. Their secret values and user records were not exported. The deployed OAuth scope was already `calendar.events`; the unrelated old root `worker-google-calendar.js` still uses a read-only scope and an obsolete callback, but is not the active deployment module. Actual account grants cannot be inferred from bindings.

## Restoration

A development-host-only adapter preserves the complete deployed baseline and live assets. It replaces only the served app's creation branch, retaining its calendar-reading block and other features. The old POST path now prepares an encrypted ten-minute draft and returns `202`, never creates immediately. A separate confirmation endpoint loads that user's server-held draft and requires `confirmed: true`.

The review dialog shows editable title, start, end and location, explicitly labels Brasilia time, asks for an end time rather than inventing duration, then presents a separate confirm button. It handles Portuguese and English. Esc/cancel before confirmation creates nothing. After an ambiguous upstream failure, cancellation does not claim that Google received nothing.

The adapter verifies the Supabase bearer session server-side, binds drafts to the authenticated user, denies foreign origins, refuses client-supplied identity/calendar/attendee fields, validates bounded dates and text, and targets only that user's primary calendar. Tokens use the existing AES-GCM encrypted storage format. Actual Google token scopes and OAuth client audience are checked before preparing and confirming; old read-only grants remain usable by the unchanged reading path but cannot write.

OAuth reconnect keeps the existing registered `/api/auth/google/callback` URL and adds PKCE, browser-bound Secure/HttpOnly/SameSite=Lax state cookie, ten-minute encrypted state, one-use code exchange and explicit granted-scope checks. A failed/refused connection preserves the prior tokens. No secret values reach the browser. Legacy chat confirmation commands cannot invoke the old writer.

Retries and concurrent confirmations send the same deterministic Google event ID for the same user and normalized event details. On conflict, the adapter reads the existing ID and checks its private request marker rather than creating a second event. No invitations or external update emails are requested.

## Validation and remaining user authorization

14 focused tests cover verified sessions, origins, permissions, prepare/confirm separation, encrypted drafts, cross-user access, cancellation/expiry, duplicate and concurrent confirmation, refresh tokens, OAuth PKCE/state/replay/refusal/readonly grants, invalid dates, browser review, unchanged reading delegation and production-host delegation. Combined adapter/integration/research suite: 70 tests. Deployment workflow also runs the existing 139 medical and 18 demo tests and verifies preserved production source and sandbox bindings.

Post-deployment checks exercise the actual served patched app and anonymous/foreign-origin/OAuth denials without calendar writes. Live authenticated Google account creation has not been performed automatically: it requires the account owner's Lumi session, Google consent if the existing grant is insufficient, and explicit confirmation of actual event details in the review dialog. No real event is invented for a test. A subsequent real end-to-end test should confirm one event, retry it and verify one matching entry in Google Calendar.

Relevant Google documentation: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert and https://developers.google.com/identity/protocols/oauth2/web-server . Google Calendar remains the final authority on access and write success.
