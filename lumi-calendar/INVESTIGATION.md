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

32 focused tests cover verified sessions, origins, permissions, prepare/confirm separation, encrypted drafts, cross-user access, cancellation/expiry, duplicate and concurrent confirmation, refresh tokens, OAuth PKCE/state/replay/refusal/readonly grants, invalid dates, browser review, unchanged reading delegation and production-host delegation. Combined adapter/integration/research suite: 88 tests. Deployment workflow also runs the existing 139 medical and 18 demo tests and verifies preserved production source and sandbox bindings.

Post-deployment checks exercise the actual served patched app and anonymous/foreign-origin/OAuth denials without calendar writes. Live authenticated Google account creation has not been performed automatically: it requires the account owner's Lumi session, Google consent if the existing grant is insufficient, and explicit confirmation of actual event details in the review dialog. No real event is invented for a test. A subsequent real end-to-end test should confirm one event, retry it and verify one matching entry in Google Calendar.

Relevant Google documentation: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert and https://developers.google.com/identity/protocols/oauth2/web-server . Google Calendar remains the final authority on access and write success.


## OAuth return correction after user validation

The first review dialog exposed a missing continuation: reconnect navigated away without preserving the form, while the callback only displayed a link back. The callback now returns a fixed same-origin 303 redirect into Lumi. When reconnect starts from a form, its values are kept in the encrypted, user-bound OAuth state and then in a ten-minute encrypted resume record. A random opaque resume ID returns the browser to that record; an authenticated endpoint prevents another account from retrieving it. Browser session storage keeps only that opaque ID, never event details. The dialog restores its values and automatically prepares the review, but never confirms creation automatically. If Lumi sign-in has expired, a visible Retomar evento action remains available after sign-in.

Date-time fields explicitly accept `DD/MM/AAAA HH:MM` and display 24-hour Brasilia time, independent of browser locale. Esc preserves the form and directs the person to the explicit Cancelar button. New tests exercise redirect, ownership, expiry, browser resume, Brazilian date rendering and Esc preservation. Real Google account validation still requires the user's login/consent and explicit event confirmation.


## Date/time picker correction

The explicit Brazilian text format had removed the browser's built-in date picker. Each start/end field now includes dedicated Escolher data and Escolher horário buttons. They call the native date/time picker synchronously from the user click and synchronize its ISO value into the Brazilian text field without losing the other component. Browsers without showPicker receive visible native inputs as a fallback. A regression test verifies the picker invocation, date/time conversion, retained values and fallback. The native widget appearance follows the browser/operating system; the event form remains DD/MM/AAAA with 24-hour time.


## User-approved duration default

The user requested optional end time with a 30-minute default. The dialog now provides an editable duration in minutes, defaults it to 30, and calculates the end when omitted. An explicitly supplied end takes precedence. Server validation applies the same rule for API requests with optional durationMinutes, validates bounds and returns the calculated end for review before confirmation. New tests cover the default, changed duration, explicit end precedence and blank-end browser submission.


## Conflict checks before confirmation

Both preparation and confirmation now query the authenticated primary calendar for the proposed interval. Recurring instances are expanded, pagination is followed, and busy all-day events use the calendar time zone. Adjacent events, cancelled events, entries marked free and invitations declined by the current user are excluded. The duplicate-safe event ID is excluded from conflicts when retrying a successful creation.

A warning lists overlapping events and offers Escolher outro horário or Criar mesmo assim. An override needs a random server-issued token tied to the reviewed conflict snapshot, plus explicit user confirmation. Confirmation checks Google again: changed/new conflicts issue a fresh warning and require another explicit click. Failed/incomplete checks do not assert availability or create an event. The check covers the primary calendar only, matching the existing creation target; external calendars are not inspected. Google does not provide an atomic check-and-insert operation, so another app can still add an event in the brief interval after the last check.

Seven new regression tests cover warnings and override tokens, changes during confirmation, all-day intervals and exclusive boundaries, free/cancelled/declined events, failures, pagination, recurrence query parameters and both browser choices. Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/list . Live real-account checks remain subject to the user's authenticated Google session and event confirmation.


## Clickable sign-in prompt

Calendar preparation, reconnect and resume authentication failures now render a sign-in button that invokes Lumi's existing Sign in control. Opening the existing authentication dialog preserves the event form currently in the DOM. A regression test verifies the click handler and retained fields. Authentication still uses the existing Supabase flow; no calendar action occurs from clicking sign-in.


## Return to Lumi and display the calendar after confirmation

Once Google confirms creation, the event dialog closes and Lumi automatically displays a daily primary-calendar panel in the existing conversation. It highlights the confirmed event, uses Brasilia dates/times, supports another selected date and provides Refresh/Close actions. An authenticated read-only day endpoint uses expanded recurring events and complete pagination; it does not require write scope when the existing Google grant is read-only. Existing reading endpoints remain delegated unchanged.

If loading the day fails after creation, the UI retains Google's actual creation receipt and offers retry without reporting creation failure or repeating the write. New tests cover authenticated daily reading and boundaries, the complete close-and-display browser flow and read failure after a successful creation. Actual real-account creation remains subject to the user's explicit confirmation.


## Brazilian short-date parsing from screenshot

The user's screenshot showed “criar dia 21/10” left in the title and today's date incorrectly prefilled. The request parser now recognizes D/M or DD/MM with an optional four-digit year, using the current Brasilia year when omitted, and strips the creation command/date from the title. A request without a day no longer silently assumes today. Invalid dates remain visible as supplied and are rejected by server validation rather than being normalized to another day. Regression tests cover the exact screenshot wording, a full date, absent date and invalid day.
