# Health news: static demo and technical follow-up

Decision (18 October 2026): no Worker code deployment before the official beta launch in Develop. Keep production untouched. Prepare static demo code and pause the existing news cron only.

## Prepared, not deployed
- Frozen public edition of 17 October 2026 (five existing stories, original publication dates and source links preserved).
- Visible static demonstration notice and no automatic refresh or generation.
- Static endpoint reads bundled data, without KV or AI calls.
- News scheduled handler becomes a no-op; unrelated schedules are preserved.
- Live generation smoke workflow disabled. Deployment code no longer automatically re-adds the news cron.

## Technical evidence
- Cloudflare token revalidated successfully after secret update.
- Existing daily cron ran on 18 October at 09:00 UTC (06:00 Sao Paulo). Analytics report scriptThrewException, CPU p50/p99 99,898 ms, 30 subrequests.
- Publication metadata attribute parsing used an unanchored regex with quadratic behavior on malformed attribute names. A synthetic 100 KB name took about 11.25 seconds locally.
- Prepared replacement scans each attribute once. A 500 KB malformed name plus valid publication metadata passes in about 40 ms locally; date-conflict and source-verification checks remain covered.
- This reproduces and fixes a CPU-exhaustion defect, but the available Cloudflare analytics do not establish that this specific input caused the observed cron exception. Do not report full incident closure yet.

## Launch gate
Before enabling automatic news: validate the prepared fix with representative publisher HTML and the actual Worker runtime in an approved prelaunch window; confirm the exact exception and CPU headroom, generation/storage behavior, cost limits and failure recovery. Re-enable scheduled generation only after explicit launch approval. No live AI calls or temporary Worker deployments were performed during this static-demo preparation.
