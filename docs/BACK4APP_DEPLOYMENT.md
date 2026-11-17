# Card-free demo backend: Back4app Containers

Checked 17 November 2026: Back4app advertises a Free Containers tier with no credit card required, 0.25 CPU and 256 MB RAM. It is intended for testing/learning. This is a demo deployment path, not a production uptime commitment. Account verification or product availability may still vary.

Official references:

- https://www.back4app.com/pricing/container-as-a-service
- https://www.back4app.com/docs-containers
- https://www.back4app.com/docs-containers/prepare-your-deployment

## Create the container app

1. Open https://www.back4app.com/signup-containers and sign in with GitHub.
2. Choose Containers / Web Deployment, not a new Parse backend/database. We retain Supabase.
3. Authorize the Back4app GitHub integration for `Aneeq19/clinicflow-ai` only, then select the repository.
4. Name the app `clinicflow-api`, choose branch `main`, and use the repository root (`/` or the default blank root). The Dockerfile is at the repository root and copies only the Python backend runtime files. Do not set the root to `backend` for this Dockerfile.
5. Select the **Free $0** container plan. If the account requires payment details, stop and review that requirement rather than entering a card.
6. Set the public container port to **8080**. If a health-check path is configurable, use `/health`.
7. Add runtime environment variables privately, using the table below. Do not put secret values in GitHub, Dockerfile, screenshots or chat.

| Key | Value |
|---|---|
| `SUPABASE_URL` | Your existing Supabase HTTPS project URL, without `/rest/v1/` |
| `SUPABASE_SECRET_KEY` | Your private server secret key |
| `BUSINESS_SLUG` | `pearl-dental-care` |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Your Workers AI token |
| `CLOUDFLARE_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `ALLOWED_ORIGINS` | Initially `http://localhost:5173,http://127.0.0.1:5173`; update to the exact Pages origin after frontend deployment |
| `PORT` | `8080` |

Python is selected by the Docker base image, so `PYTHON_VERSION` is not needed here. Build/start commands are already in Dockerfile. The image runs one Uvicorn worker as a non-root user, without reload.

8. Create/deploy the app. If build or startup fails, inspect the logs. The Docker image has not been built in the local editing environment because a container engine is unavailable; the host build and smoke tests remain necessary.
9. Copy the actual HTTPS backend URL after deployment. Check `/health` for `status: ok`, `/health/db` for a connected database and `/business` for intended public information. Anonymous `/admin/appointments` must return HTTP 401 without customer data.
10. If a provider token was exposed in a screenshot/PDF, replace it and revoke the exposed token. Update Render's unused configuration and the home PC's `.env` if those copies still exist. Do not reuse exposed credentials for the public deployment.

## Connect Cloudflare Pages

Follow the frontend section of [DEPLOYMENT.md](DEPLOYMENT.md), using the actual Back4app backend URL instead of a Render URL for `VITE_API_BASE_URL`. Update backend `ALLOWED_ORIGINS` to the exact public frontend origin and restart/redeploy the backend.

Test owner login, public settings, synthetic booking/status changes, chat and the external widget at the public URLs. A successful container build alone does not prove database, provider, CORS or owner access works.

## Limits

Free resources are limited and may sleep or be restricted; do not promise permanent availability. Application memory usage and latency must be checked under this plan. If the service exceeds its 256 MB allowance, inspect logs/metrics and review hosting options without silently upgrading to a paid plan. Data persists in Supabase, not the container filesystem. Full shared-tenant security and production operations remain unfinished; see SECURITY.md.
