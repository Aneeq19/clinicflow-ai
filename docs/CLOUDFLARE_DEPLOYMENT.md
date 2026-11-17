# Deploy the demo entirely on Cloudflare

## Architecture and limits

The React frontend runs on Pages. The new `cloudflare-worker/` JavaScript backend implements the same API paths/response fields with native fetch, Web Crypto, rate-limit bindings and Workers AI. It reuses Supabase tables, owner membership and saved settings. No migration beyond existing 001/002/003 is needed.

The original FastAPI backend remains for local use and other hosts. Its Python SDK/threading code cannot be copied unchanged into a Worker. This separate adapter simplifies Cloudflare deployment; changes to either backend must also be checked in the other implementation.

Use Workers **Free**. Cloudflare advertises signup without a card. Free Workers request/CPU limits and separate Workers AI quotas apply; no unlimited uptime/inference promise. This setup does not enable paid containers, domains, subscriptions or AI Gateway credits. Live checks below are still required.

Official references checked 17 November 2026:

- https://www.cloudflare.com/products/workers/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/configuration/secrets/

## 1. Backend Worker from GitHub

1. Open https://dash.cloudflare.com/ and choose your existing account with Workers AI access.
2. Workers & Pages → Create application → Import a repository / GitHub. Use **Workers**, not Pages for the backend.
3. Authorize GitHub access for `Aneeq19/clinicflow-ai` and select it.
4. **Worker name:** `clinicflow-api` (must match Wrangler config). **Branch:** `main`.
5. Under advanced build settings set **Root directory:** `cloudflare-worker`.
6. Leave **Build command** empty. **Deploy command:** `npx wrangler deploy`. If an install command field appears, use `npm ci`; dependencies are in the lockfile.
7. Save and deploy. Repo configuration declares the AI binding and rate-limit bindings. No AI REST token/account ID is copied into this Worker.

The first deployment can succeed before Supabase credentials are added. `/health` is credential-free; database routes return 503 until runtime settings are complete. Build success does not prove a live integration works.

## 2. Runtime configuration

Deployed Worker → Settings → Variables and Secrets → Add. These are runtime values, not frontend/build secrets.

| Type | Name | Value |
|---|---|---|
| Text | `SUPABASE_URL` | Existing project HTTPS URL without `/rest/v1/` |
| Secret | `SUPABASE_SECRET_KEY` | Private server secret for the same Supabase project |
| Text | `ALLOWED_ORIGINS` | Initially `http://localhost:5173,http://127.0.0.1:5173`; later add/replace with the exact Pages origin |

Save/deploy settings. Business slug and model are already configured. Unlisted dashboard text variables above are retained on later Wrangler deployments (`keep_vars: true`); secrets remain secrets. Do not add secrets to GitHub or `VITE_` variables.

Replace/revoke any key or token exposed in screenshots/PDFs before public deployment. This Worker does not need `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID`; revoke exposed old Cloudflare tokens and update other apps/home `.env` that used them. Never send secret values to chat.

Check Bindings for `AI` and five rate-limit bindings. Missing rate-limit bindings fail closed with 503. Namespace IDs `21011`–`21015` must not be reused for unrelated Workers without reviewing shared counters; allocate different IDs for separate deployments.

## 3. Backend checks

Copy the actual Worker HTTPS URL (usually `https://clinicflow-api.YOUR-SUBDOMAIN.workers.dev`). Check:

- `/health` → status ok
- `/health/db` → database connected
- `/business` → approved public settings only
- Anonymous `/admin/appointments` → HTTP 401, no customer data

Direct navigation normally has no Origin header. Browser fetches require an exact allowed origin, no wildcard/path/trailing slash. Complete any official Workers AI activation/terms step required by your account while retaining Free, then verify AI replies.

## 4. Frontend on Pages

1. Workers & Pages → Create application → **Pages** / Pages link → Connect to Git.
2. Select `Aneeq19/clinicflow-ai`, branch `main`.
3. **Root:** `frontend`; **Framework:** Vite; **Build:** `npm run build`; **Output:** `dist`.
4. Set public build variable `VITE_API_BASE_URL` to the actual Worker HTTPS origin, no trailing slash. Set `NODE_VERSION=24` if needed.
5. Deploy and copy the actual Pages HTTPS origin.
6. Update the Worker's runtime `ALLOWED_ORIGINS` to exactly that Pages origin. Keep localhost entries comma-separated only if needed. Save/deploy runtime settings.
7. A changed `VITE_` value requires rebuilding Pages. Changed Worker runtime variables require save/deploy of Worker settings.

## 5. Live acceptance checks

- Inspect homepage and narrow mobile layouts.
- Existing owner login must work and show only the configured clinic's records.
- Save a public settings change; refresh homepage and verify the supplied price in chat.
- Submit a synthetic appointment; verify its row, change status to Contacted and refresh.
- Ask a general reception question to exercise AI. AI failure must produce a safe labeled fallback.
- Check chat counts after a typed reply. Quick-answer buttons do not send messages and are not counted.
- Test `/embed-example.html`, including iframe chat and appointment requests.
- Sign out and confirm private UI data disappears.
- Test public links from a second device/network with the home PC off.

Only after these checks call it a verified live demo.

## Verification boundaries

Synthetic Node tests cover auth denial, business scoping, conflicts, validation, Python-compatible request fingerprints, sequential/concurrent retries, protected chat topics, AI fallback, anonymous analytics, CORS, rate-limit failure and streamed body bounds. Wrangler dry-run checks bundle/configuration without publishing or calling AI. Neither replaces live tests or measures deployed Free CPU budgets.

Rate limits are approximate per Cloudflare location, not strict worldwide counters. Requests to Supabase time out after 8 seconds. AI waits are bounded to 12 seconds; already-started inference can still use quota after an application timeout. Best-effort anonymous events use `waitUntil`; they store no chat text or phone. Platform request metadata may still exist; full observability is disabled in the config.

One business per deployment remains the boundary. Full shared-tenant isolation and production privacy/retention/operations are unfinished; see SECURITY.md. No WhatsApp, live-calendar confirmation or messaging integration was added.
