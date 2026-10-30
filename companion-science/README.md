# Companion = Ciência

Public, versioned educational knowledge for Lumi Develop. The current edition has 33 topics, including eight exercise/rehabilitation topics. It is a bounded curated collection, not an exhaustive literature review or a clinically certified product.

## Evidence and editorial rules

Prefer clinical guidelines and systematic reviews, then peer-reviewed studies and specialist institutional guidance. Common practice alone does not establish effectiveness. Formal evidence/strength labels are reproduced only for the specific findings in the cited APTA guideline; other records identify the source type without assigning a new GRADE score. Consultation date is separate from source publication year. Historical reviews disclose their evidence cutoff and are not represented as current exhaustive guidance.

Every record needs sources, applicability limits and general practice implications. No personal dosing, automatic treatment selection, individualized exercise prescription, claims of cure or guaranteed safety. Protein redistribution is distinct from reducing total daily protein. Exercise modalities are not interchangeable evidence claims; flexibility has lower evidence than the strong APTA recommendations for aerobic, resistance, balance and gait training.

To update: verify original sources and newer guidelines, edit catalog.mjs, update VERSION and CHECKED, and run the frontend and integration suites. Content is bundled once for all users. There is no background scientific search, subscription service or per-reader model call. Reading/searching the base does not use API credits.

## Shared general knowledge

The catalog is persisted in the versioned repository and bundled into the development Worker as the same read-only scientific content for every user. GET /companion-science/catalog exposes only that public catalog; writes are rejected. No conversation or private personal-memory content can enter the shared catalog.

An explicit chat message `Companion: <topic title or ID>` retrieves the canonical record with sources, without a model call or live search. It requires the same origin and a verified account; only that user’s conversation history is updated. General chat, individual medical questions and new-research requests retain the existing behavior.

## Interface and chat

Lumi and Companion have separate top-level buttons on PC/Android/PWA. Companion uses local accent-insensitive search and category filters. No-match queries do not generate an answer. Opening science preserves chat history and drafts. Taking a topic into Lumi inserts its summary, limits and source URLs into an empty composer, without sending; existing drafts are preserved. Sending that message uses Lumi's existing AI flow and billing. The direct lookup button prepares a canonical Companion message, again without sending automatically. No API credentials or model configuration are introduced or changed.

Science content is Portuguese; the surrounding interface follows PT/EN and explains the content language. Transient search is cleared on sign-out. Browsing the library does not persist search queries. Explicit chat lookups are retained only in the requesting account’s existing conversation history. The shared catalog never stores personal data, private conversations or clinical records.

## Scope

Only the existing development asset build includes this feature. Production files and deploy targets are unchanged. Browser regression scenarios cover desktop, Android 360/393, standalone PWA, 320px and landscape. CI must pass the existing full deployment gates before publishing.

## Brazilian references and explanations

Includes Ativa Parkinson (Unesp/Bauru), national neurology guidelines, and Brazilian trials. Congress papers and descriptions of clinical practice retain their publication type and limitations rather than being presented as established efficacy. Institutions have plain-language descriptions and national origin where verified. Evidence labels and abbreviations are explained in the library and direct chat answers.

## Doctoral research register

The public catalog also contains doctoralResearch: four completed USP theses, Aline Prieto Silveira Ciola’s completed Unesp doctoral thesis, and one MOVI-LAB group record, verified against institutional sources. The group page lists doctoral students but does not verify individual project titles or enrollment status. These academic records are displayed separately from clinical knowledge; no thesis or grant is treated as automatic proof of an effective treatment. Consultation uses no model calls. Source publication/defense dates remain separate from the consultation date.
