# Lumi Parkinson Beta — release gate (draft)
Target: five invited adults with Parkinson's at varied functional levels.
Status: NOT READY FOR REAL HEALTH DATA. No production deployment authorized.

## Mandatory before enrollment or medical-data entry
- [ ] Identify controller/operator, lawful basis and sensitive-data LGPD safeguards; legal/privacy review.
- [ ] Determine whether CEP/CONEP ethics review is required for the intended activities before recruitment.
- [ ] Plain-language consent and privacy notice reviewed; optional medical-data sharing separately authorized.
- [ ] Verify deployed Worker source matches reviewed code and preserve rollback backup.
- [ ] Server verifies passkey challenge, RP ID, origin, user verification, signature, counter and single-use challenge.
- [ ] Strongly consistent credential/challenge store configured; session- and action-scoped grants with short expiry.
- [ ] Medical endpoints fail closed without valid step-up; verify GET, PUT, DELETE and export.
- [ ] AES-GCM encrypted medical records; encryption keys are server-only; verify key handling and backup.
- [ ] User isolation tests across two accounts; unauthorized, expired, replayed, and revoked grants denied.
- [ ] Consent enforcement before medical context is sent to any model; document processors and retention.
- [ ] Medical data review/correction/export/delete tested end-to-end; no sensitive values in logs.
- [ ] Safety checks for urgent symptoms, hallucinations, medication changes, and clear limits.
- [ ] Accessibility testing on Android, iPhone Safari, desktop, including passkey recovery.
- [ ] Explicit go/no-go signoff before any participant enters real health data.


## Welcome/onboarding — Draft 1 approved for usability review (2026-10-12)
- [x] Universal introduction: Lumi is an AI-powered personal companion for everyday assistance, understanding health information, organization, and companionship. Do not name any specific condition in the introduction.
- [x] Approved sentence (pt-BR): “Seja para cuidar de você, ajudar alguém de quem gosta ou simplesmente ter companhia para conversar, estou aqui para ouvir e ajudar.”
- [x] First question: “Um médico já diagnosticou alguma condição de saúde em você?” with SIM / NÃO only.
- [x] SIM path: ask which condition was diagnosed; ask whether other conditions were diagnosed; then gently ask who diagnosed it, when, and what led to seeking care.
- [x] NÃO path: “O que trouxe você aqui hoje?” with options for caring for someone, learning about health, companionship, everyday help, or exploring Lumi.
- [x] One question at a time; simple large controls; no diagnosis or prescription by Lumi; avoid the term “doença” in user-facing onboarding.
- [x] First in-app demonstration committed to GitHub develop branch, not production; no response persistence.
- [ ] Verify live development deployment, accessibility and comprehension with test users before beta distribution.
- [ ] Finalize reviewed consent and medical security controls before collecting or storing real health information.

## Operational features to test
- [ ] Google sign-in and logout
- [ ] Chat, history, personal memory, privacy controls
- [ ] Calendar and web research only if reliable and cost-limited
- [ ] Clear support and incident reporting process

## Go/no-go rule
No real medical data and no medical beta launch while any mandatory gate is incomplete.
Five-person pilot is exploratory usability testing, not evidence of clinical effectiveness.
