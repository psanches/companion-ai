# Lumi + Ativa — coordinator introduction and beta readiness

**Status:** Planning only. No volunteer recruitment or health-data collection is authorized by this document.

## Short introduction (Português)
A Lumi é uma companheira com inteligência artificial para ajudar no dia a dia, conversar, organizar rotinas e explicar informações de saúde quando solicitadas. Não é exclusiva para pessoas com Parkinson e não substitui profissionais de saúde.

Estamos preparando uma avaliação exploratória com até cinco voluntários da Ativa para entender se a Lumi é fácil e útil de usar. O foco é avaliar **a Lumi**, não identificar ou avaliar clinicamente as pessoas.

## What can be demonstrated now
- Universal welcome and optional, one-question-at-a-time guided flow
- Approximate timing of reported health condition, without exact date requirement
- Two optional emotional well-being questions in a fictional, non-persistent demonstration
- A fictional aggregate usability dashboard, **not real beta data**

**Do not ask attendees to enter real medical or mental-health information into the demonstration.**

## What is NOT ready
- Authorized admin access for the coordinator and psychologist (accounts not yet created)
- Real beta metrics collection and privacy-safe aggregation
- Medical profile storage and health research using real personal information
- Consent materials, security validation and any applicable ethics/legal review
- Verified complete production deployment

## Discussion with the coordinator
1. Would the Ativa team be interested in discussing a small exploratory usability pilot?
2. Who would coordinate practical arrangements?
3. Would the supporting psychologist be willing to review the optional emotional well-being questions and participant safeguards?
4. Which accessibility needs should we consider (large buttons, voice, fatigue, mobility, cognition)?
5. What process should be followed for institutional approval and any applicable research ethics review?

No names, diagnoses, contact information, or individual participant answers need to be collected during this initial conversation.

## Technical release blockers
- Compare the **actually deployed** Cloudflare Workers (dev and production) with GitHub source; repository worker.js is not a safe replacement for the running Worker.
- Server-side allowlist of three admin accounts using stable authenticated user IDs; deny by default; no dashboard data to non-admins.
- Consent, medical security step-up, encryption, access separation, retention/deletion, LGPD and applicable ethics review before real health-data processing.
- Small-group disclosure controls: with five volunteers, avoid condition-specific frequencies, individual rows, cross-tabulations and week-to-week differencing that may identify someone.
- End-to-end desktop/Android tests and rollback plan before a coordinated release.

## Definition of done for this planning phase
- The introduction is approved for discussion.
- The optional questions are present only in the fictional demonstration.
- The remaining security and research dependencies are explicitly recorded.
- Production remains unchanged.
