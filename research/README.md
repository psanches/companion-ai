# Lumi Research — development integration

This is an isolated development feature branch, **not deployed**.

## Architecture
- Authenticated `POST /research` using a Supabase access token verified server-side.
- OpenAI Responses API with `web_search`; return cited sources.
- Cloudflare D1 `RESEARCH_DB` for atomic request quotas.
- Browser must never receive the OpenAI secret.
- Use restrictive CORS for the development frontend.
- Preserve existing Lumi chat, memory, calendar, and production.

## Deployment gate
**Do not deploy** until the currently deployed `lumi-develop` Worker source is compared with this repository. The checked-in `worker.js` appears to differ from the deployed modular Worker; overwriting it may break features.

A validated offline patch was prepared separately; live tests are still required. Before deployment: configure a development-only D1 binding and OpenAI secret, verify Supabase JWT, test real web citations and limits, then review the diff. No production changes are authorized.
