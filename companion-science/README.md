# Companion = Ciência

Public, versioned educational knowledge for Lumi Develop. The initial edition has 21 topics, including eight exercise/reabilitation topics. It is a bounded curated collection, not an exhaustive literature review or a clinically certified product.

## Evidence and editorial rules

Prefer clinical guidelines and systematic reviews, then peer-reviewed studies and specialist institutional guidance. Common practice alone does not establish effectiveness. Formal evidence/strength labels are reproduced only for the specific findings in the cited APTA guideline; other records identify the source type without assigning a new GRADE score. Consultation date is separate from source publication year. Historical reviews disclose their evidence cutoff and are not represented as current exhaustive guidance.

Every record needs sources, applicability limits and general practice implications. No personal dosing, automatic treatment selection, individualized exercise prescription, claims of cure or guaranteed safety. Protein redistribution is distinct from reducing total daily protein. Exercise modalities are not interchangeable evidence claims; flexibility has lower evidence than the strong APTA recommendations for aerobic, resistance, balance and gait training.

To update: verify original sources and newer guidelines, edit catalog.mjs, update VERSION and CHECKED, and run the frontend and integration suites. Content is bundled once for all users. There is no background scientific search, subscription service or per-reader model call. Reading/searching the base does not use API credits.

## Interface and chat

Lumi and Companion have separate top-level buttons on PC/Android/PWA. Companion uses local accent-insensitive search and category filters. No-match queries do not generate an answer. Opening science preserves chat history and drafts. Taking a topic into Lumi inserts its summary, limits and source URLs into an empty composer, without sending; existing drafts are preserved. Sending that message uses Lumi's existing AI flow and billing. No API credentials or model configuration are introduced or changed.

Science content is Portuguese; the surrounding interface follows PT/EN and explains the content language. Transient search is cleared on sign-out. No personal data, query history or clinical records are stored by this feature.

## Scope

Only the existing development asset build includes this feature. Production files and deploy targets are unchanged. Browser regression scenarios cover desktop, Android 360/393, standalone PWA, 320px and landscape. CI must pass the existing full deployment gates before publishing.
