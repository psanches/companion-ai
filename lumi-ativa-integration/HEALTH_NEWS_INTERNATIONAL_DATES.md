# International health news and publication-date verification

Implemented October 16, 2026, in the authorized `lumi-develop` sandbox. Production is excluded.

## How the bulletin now works

1. Discover articles in Portuguese and English using web search with primary-publisher domain filters. Supplement discovery with links actually found on the Michael J. Fox Foundation's current research-news index. Follow only validated public HTTPS redirects; no user-supplied URLs or private-network destinations are accepted.
2. Fetch each original page before accepting it. Read original publication metadata (JSON-LD `datePublished`, explicit publication meta tags, Gov.br `documentPublished`) or a dedicated English publication-date node immediately below its article heading. Ignore modification timestamps and event dates. Conflicting or missing evidence is rejected.
3. Reject future publication days and stories older than seven days. An optional model-supplied date cannot override the page. URLs must have provenance in retrieved search sources or the trusted publisher index. Inaccessible pages and non-HTML documents are not accepted as verified articles.
4. Select up to five verified stories, preferring international sources while retaining Brazilian items when eligible. There is no requirement to fill five slots.
5. Translate/summarize the fetched source text in Portuguese in a separate bounded API request. Explicitly distinguish preliminary research, recruitment and established treatments. Publication dates are returned in a dedicated `publishedAt` field; competing calendar-date claims in titles/summaries are rejected.
6. Store verification evidence and rejection reasons, not article bodies. Cache policy version 2 invalidates the previously unverified edition. Reads also check dates on cached editions; previous editions are marked stale and out-of-window/future/legacy items are not served as verified news.

Research uses the already-configured dedicated Lumi Research key, without creating new keys. At most two AI calls are used per generation (discovery: 6,000 output tokens and six tool calls; translation: 4,000 output tokens). A valid daily cache avoids another research request. Existing routes, personality, live frontend, medical security boundaries and bindings remain preserved.

## Verified discrepancies in the previous edition

- SUS / Goiás UBS article: original publication October 9, not October 14; the previous supplied URL differed from the original.
- UFJF table-tennis research: October 6, ten days old on October 16, not within seven days.
- UFPR deep brain stimulation: October 5, not the future “last week of October.”
- PAHO healthy-ageing report: October 6, beyond the chosen seven-day news window.
- USP symposium: distinguish original article October 9, republication October 14, and event October 15–16.

See `HEALTH_NEWS_QUALITY_REVIEW_20261016.md` for the original-source links and review.

## Live verification

[Runtime verification 38888413620](https://github.com/psanches/companion-ai/actions/runs/38888413620) succeeded. The October 16 legacy edition was replaced by a policy-version-2 edition generated at 10:37:37 UTC:

- 12 candidates examined, one accepted, one international; 11 rejected for publication age or unavailable publication-date evidence.
- Accepted primary article: https://www.michaeljfox.org/news/neurologists-gain-insights-2026-mds-pas-movement-disorders-school
- Original publication: October 14, 2026, verified from the dedicated date below its heading.
- Portuguese title: “Escola MDS-PAS inspira residentes de neurologia e destaca avanços em Parkinson.”
- The source concerns a neurology-resident course and research context, not a newly approved treatment. The Portuguese summary preserves that distinction.
- The temporary verification Worker was removed after the serving-route check succeeded.

Local integration/research validation: 50 tests passed; the existing medical suite (139) and demo suite (18) are also required by the deployment workflow. New tests cover future/stale dates, original versus modified/event dates, conflicting metadata, English dates, disallowed URLs/redirects, cached legacy rejection and translation from verified source text.

An automatic Cron Trigger invocation remains distinct from manually exercising its handler. Schedule remains 06:00 São Paulo (`0 9 * * *`).
