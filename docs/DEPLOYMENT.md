# Publish the demo

## Backend on Render

The root `render.yaml` defines a Python web service with a Free plan, `backend` root directory, `/health` health check and Uvicorn start command. No hosting resource has been created automatically.

1. Sign in to Render and create a Blueprint from `Aneeq19/clinicflow-ai`, using `render.yaml`.
2. Review the service and Free plan before creating it. Render may require account verification. If Free is unavailable, stop and review the cost before proceeding.
3. Supply these values privately in Render environment settings.

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your existing project URL without `/rest/v1/` |
| `SUPABASE_SECRET_KEY` | Your server-only secret key |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Your Workers AI token |
| `BUSINESS_SLUG` | `pearl-dental-care` |
| `ALLOWED_ORIGINS` | Your exact frontend HTTPS origin, later set to the actual Pages URL |

The model defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Recheck provider availability if its lifecycle changes.

4. Deploy and copy the actual `https://...onrender.com` URL.
5. Check `/health`, `/health/db` and `/business`. Check `/admin/appointments` without a token and confirm HTTP 401 with no customer data.

Free Render services sleep after inactivity. An initial request can take longer than the frontend timeout. Open the backend health URL before a planned sales demo and refresh after the service starts. Always-on hosting is a separate operating decision.

Official references, checked during implementation

- [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Free services and limitations](https://render.com/docs/free)

## Frontend on Cloudflare Pages

1. Connect the same GitHub repository to a Pages project.
2. Set **Root directory** to `frontend`.
3. Set **Build command** to `npm run build` and **Build output directory** to `dist`.
4. Set Node.js to a supported LTS version satisfying Vite's requirement. The build was checked with Node 24.
5. Add public build variable `VITE_API_BASE_URL` with the actual Render HTTPS URL, without a trailing slash.
6. Build and deploy. Copy the actual Pages HTTPS origin.
7. Set backend `ALLOWED_ORIGINS` to that exact origin and restart/redeploy the backend. Add explicit preview origins only if needed. Use comma-separated origins, with no wildcard.
8. Rebuild the frontend when changing its `VITE_` variables. The backend's `.env` never goes into the frontend.

The included `_redirects` supports `/admin` and `/widget` on Pages. The admin route denies framing through `_headers`; the widget route remains embeddable.

[Official Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)

## Public smoke test

- Public `/business` returns only intended public settings.
- Appointment requests persist and the unauthenticated admin API returns 401.
- Owner login and status management work on HTTPS.
- A settings edit survives a fresh login and appears on the refreshed website and chatbot.
- Fallback still responds when the AI provider is unavailable.
- The external script loads from the frontend's public HTTPS address.
- Browser devtools show no API secrets in frontend source or responses.
- Check the site at narrow mobile widths, including keyboard-open chat and booking flows.

## Install the external widget

Copy the snippet shown in Owner dashboard → Business settings, using the deployed frontend origin.

```html
<script src="https://YOUR-FRONTEND.pages.dev/embed.js" defer></script>
```

Place it before the host site's closing `</body>` tag. This snippet targets the business configured for that frontend/backend deployment. It does not select arbitrary tenants or expose private keys. Host sites with a Content Security Policy must explicitly allow this script origin and iframe origin.

## Reuse and multi-business migration

The current application serves one configured `BUSINESS_SLUG` per deployment. Reuse the code and settings model for a separate business deployment. Owner memberships and business IDs exist, but self-service tenant provisioning, tenant URL routing and complete multi-tenant isolation tests remain future work. Do not market this version as a fully isolated shared SaaS.
