# Lumi — Google Calendar isolation and consent acceptance plan

Status: NOT VERIFIED for multi-user beta. No production changes.

## Source inspection finding
The develop branch has a worker.js that is known to be stale; google-calendar.js and auth.js are not present at repository root on develop. This does NOT establish the deployed Worker implementation. Inspect the deployed development Worker read-only before any modification.

## Expected behavior
- Every user independently connects their Google account through OAuth.
- OAuth state must be short-lived, unpredictable, bound to the authenticated Lumi user/session, and validated on callback. Use PKCE where applicable.
- Store tokens server-side encrypted, with per-user ownership and least-privilege scopes. Do not log tokens, expose them in frontend, or store in global shared KV keys.
- Use read-only Calendar scopes for event viewing; request write permission only if a distinct, justified feature is approved.
- Calendar event retrieval must use only the requesting authenticated Lumi user's stored grant.
- User can view connected account, disconnect/revoke and delete tokens, and reconnect. Disconnect must prevent subsequent refresh/access.
- No admin or Ativa dashboard access to personal events; no calendar contents in beta analytics.
- Calendar access optional, independent of medical consent and medical step-up.

## Synthetic-account verification
1. Accounts A and B connect distinct test Google Calendars with different synthetic events.
2. A asks for today's events: only A's event appears. B sees only B's.
3. A cannot fetch B's events via user ID, altered URL, or token substitution.
4. Unauthenticated event fetch denied; expired access token refresh only with own stored refresh token.
5. Logout then calendar request denied.
6. Disconnect A: tokens removed, grant revoked where possible, A cannot fetch events; B unaffected.
7. OAuth state mismatch, replay, expired state, and swapped callback session all rejected.
8. Failed refresh and revoked Google consent return clear reauthorization prompt, not another user's calendar.
9. Mobile and desktop sign-in flows work without exposing tokens in URL/history/logs.

## Release gate
Do not recruit ten volunteers for connected-calendar testing until deployed development implementation, OAuth configuration, consent UI, revocation, and isolation tests pass. Test with synthetic events first. Do not change production or deploy stale repository worker.js.
