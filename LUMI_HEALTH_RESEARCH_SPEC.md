# Lumi — Context-aware health research (development specification)

Status: DESIGN ONLY. No personal health information is collected or sent by this document. No production changes.

## Product rule
When a person voluntarily reports a health condition, Lumi may use the *condition name* to understand relevant medical knowledge. Lumi must **not proactively provide personalized health guidance**; offer relevant assistance **only when requested**. The user can also ask general questions without reporting any condition.

## Required behavior
1. Accept natural-language descriptions, multiple conditions and approximate dates without mandatory day/month/year. Do not infer a diagnosis from symptoms.
2. Explain clearly what will be researched. Before sharing personal health information with an external research provider, request specific informed consent. Prefer searching for generic condition terms only, without names, dates, identifiers, chat history, or other personal details.
3. Research reliable medical sources on demand or, where explicitly authorized, prepare generic background knowledge. Provide source links, dates and uncertainty. Separate established guidance from preliminary research.
4. Personalize an answer only in response to a user question and only using health context the user has consented to use. Never independently diagnose, stage a condition, prescribe, or change treatment.
5. If information is missing, ask one short optional question at a time. Do not pressure users to disclose sensitive details.
6. Never persist medical context by default. Medical profile storage remains blocked until consent, authentication step-up, encryption, user isolation, retention/deletion, LGPD review, and testing are complete.
7. Admin beta metrics must be aggregated and protected server-side. With five participants, avoid condition-specific counts, individual records and subgroup breakdowns; fictitious demo metrics are not real measurements.
8. On immediate danger or alarming symptoms, give appropriately urgent safety guidance rather than delaying for research.

## Acceptance tests before any live release
- User reports Parkinson and asks no health question: Lumi does not offer unsolicited advice.
- User asks a Parkinson-related question: Lumi researches and cites trustworthy sources, without transmitting identifiable health details.
- User reports Parkinson and hypertension: Lumi does not assume the conditions have the same manifestations or suggest medication changes.
- User declines research consent: no sensitive information is sent to external research services.
- User gives approximate year or says “não lembro”: onboarding proceeds.
- User requests deletion or correction: personal health information is not retained without consent, and supported deletion/correction mechanisms work when storage is eventually enabled.
- Unauthenticated user requests beta analytics: server rejects access.
- All health-data endpoints remain deny-all until their security gates are independently validated.

Deployment: development planning document only. The existing Cloudflare Worker may differ from repository worker.js; do not deploy repository worker.js over the live Worker.
