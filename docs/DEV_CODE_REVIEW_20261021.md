# Lumi Develop — code review, 21 October 2026

Scope: active development branch `feature/pc-android-permanent-fix-20261016`, starting at `f5a7221fe7510380c6256a8cbb90901a491b46a8`. Reviewed chat instructions/history, research, Calendar confirmation/conflicts/authentication, voice input, frontend releases/service worker, synthetic medical boundaries, and deployment packaging. This is a targeted code review and regression pass, not an exhaustive security audit.

## Findings and corrections

1. **High — conversation policy was documentation only.** The original deployed backend was preserved and therefore did not use `companion-instructions.mjs`. Packaging now builds a derived runtime module by appending shared rules to its model instructions. It retains the original module byte-for-byte and fails before deployment if the expected instruction boundary is absent or ambiguous. A test executes the recovered backend with a mocked model and asserts that the appended rules reach the model request.
2. **High — automatic weather research was missing from server history.** The frontend called `/research` directly, so “essa informação é de hoje?” could reach a backend that had not seen the forecast. Automatic weather now travels through authenticated `/chat`; the question, reply and specific citation URLs are saved in the original owner's server history. Short source/date follow-ups use only the latest relevant server history. An intervening unrelated topic prevents resurrection of old weather. Client-supplied history cannot choose the research context.
3. **High — unsolicited reminder/radar offers survived explicit refusal.** Shared rules prohibit unsolicited offers and distinguish an actual persisted reminder from an unimplemented promise. A narrow output guard removes trailing reminder/monitoring offers from both the current response and its saved assistant entry; necessary questions for an explicitly requested reminder remain intact.
4. **Medium — current date and evidence validation were too weak.** Research now receives the server clock in America/Sao_Paulo and distinguishes search time, source update date and alert validity. Only completed web-search calls and complete responses with valid HTTPS citation annotations qualify. Weather requires a specific source page instead of homepage-only evidence. The response labels the search timestamp separately; a clock timestamp is not a publication date or proof of forecast accuracy.
5. **Medium — research bodies and requests lacked sufficient bounds.** Request bodies are bounded while streaming; the external request has a 30-second timeout and refuses redirects. Output-token bounds remain in place, including a safe fallback for a non-finite limit. Existing per-user server rate limiting is preserved. Each research handler invocation now verifies identity once, and foreign paths/origins do not consume that limiter.
6. **Medium — failed chat sends cleared the composer.** An unsuccessful send now restores the user's draft when no replacement text has been entered.

## Verified behavior retained

- Calendar defaults to 30 minutes; explicit duration/end takes precedence. Spoken “17 hs” is a start time, not a duration. Event review, conflict warnings, explicit override and server-confirmed creation remain separate.
- The Android dictation regression protections remain covered; no automated test records real microphone audio.
- Fingerprinted assets and cache/update behavior remain covered by unit and browser CI checks.
- Real medical routes remain blocked; the Ativa demo remains synthetic. Existing medical security tests are unchanged.
- Production is excluded from the deployment script, which compares its source hash before and after development deployment. The original development baseline and bindings are checked and preserved. News generation remains paused/static.

## Validation

Local suites: 177 integration/research/frontend tests, plus the separate unchanged medical security suite and synthetic-demo suite. Deployment CI also builds the exact package, runs PC/Android browser simulations, verifies deployed module bytes and confirms rollback safeguards. The workflow conclusion and `/frontend-version` commit must be checked before reporting publication.

## Limits and remaining engineering work

- Source-date accuracy and semantic relevance still depend on the retrieved material/model. Completed search plus a specific URL does not establish that every claim is correct. If a source update date is unavailable, the instructions require saying so; there is no fabricated date fallback.
- Automatic weather uses the structured research validator. Other ordinary chat topics still use the preserved model/tool flow, with the new runtime policy; they do not all receive the same structured citation validation yet.
- Research retains its request/token/rate bounds; the application still does not implement a strict global monetary budget across all existing chat features. No new keys, billing settings, cron jobs or recurring notifications were introduced.
- Actual Android microphone recognition quality needs a device retest. Automated fixtures cover cumulative hypotheses and reconnections, not the browser speech service itself.

OpenAI citation/status contract checked against official documentation: https://developers.openai.com/api/docs/guides/tools-web-search .
