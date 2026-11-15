# ClinicFlow AI

An AI receptionist demo for **Pearl Dental Care, Karachi**, a fictional business. Built with React + Vite, FastAPI, Supabase and Cloudflare Workers AI. Use synthetic customer details only.

**Status:** application code and automated checks are prepared. The existing local website, appointment collection, AI responses and owner dashboard were tested by the builder. The new settings/embedding release still needs migration 003 in the builder's Supabase project, local visual checks and public deployment. No public demo URL is claimed here.

## Continue on Windows

Start with **[tomorrow's exact checklist](docs/START_HERE.md)**. Pull the repository, run `backend/sql/003_business_settings.sql` in Supabase, install requirements and restart both servers. Keep your existing private `backend/.env`.

## Included

- Responsive fictional-clinic website with editable introduction, services, supplied prices, hours, FAQs, branding and contact details.
- English, Urdu and Roman Urdu reception chat through Cloudflare Workers AI, with a rule-based fallback and explicit response-source labels.
- No medical diagnosis/prescriptions, unsupported prices or automatic booking confirmations. Protected intents use deterministic responses; general AI replies remain probabilistic.
- Validated appointment requests stored in Supabase. UI retry keys prevent duplicate inserts when the same unchanged request is retried.
- Supabase Auth owner login, membership checks on every owner API call and server-scoped private appointment access.
- Owner appointment list, pagination, stored counts and status edits: New, Contacted, Confirmed, Completed, Cancelled.
- Business settings editor with stale-edit conflict detection. Saved settings power the public website, form and receptionist.
- Anonymous conversation event counts; events store no chat text or phone numbers. Analytics writes are best effort.
- External `/embed.js` launcher and `/widget` iframe with chat and appointment request form.
- SQL migrations, pinned Python runtime dependencies, GitHub checks and a Render deployment blueprint.

## Architecture

The public React app calls the FastAPI backend. The backend loads public business settings, validates requests and performs database operations with a private Supabase service key. Owner calls additionally verify a Supabase Auth token and business-owner membership. Only the backend calls the AI provider.

This release serves **one configured business per deployment**. Business IDs scope requests, but shared multi-tenant SaaS security and self-service onboarding are not complete. Reuse the code with separate deployments until tenant routing, authorization and isolation are implemented and independently tested.

```text
frontend/src/          Website, owner dashboard, settings and embedded reception
frontend/public/      External embed script and Cloudflare Pages routing/headers
backend/main.py       Public API, appointment validation and retry protection
backend/owner_admin.py  Authenticated owner routes
backend/business_settings.py  Validated public settings model
backend/receptionist.py  AI provider, safety rules, fallback and event recording
backend/sql/          Ordered database migrations
backend/test_*.py     Synthetic backend tests
render.yaml          Backend deployment blueprint
```

## Environment

`backend/.env.example` documents private server variables. Copy values privately into `backend/.env` on your PC or into the backend host's environment settings. Never commit that file.

`frontend/.env.example` contains only `VITE_API_BASE_URL`, a public backend address. No Supabase secret, AI token or password belongs in any `VITE_` variable.

The provider defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Gemini is not required for this release. Provider access, quotas and billing belong to your own account.

## Verify on Windows

Run one command at a time. Backend checks use synthetic in-memory database/auth doubles and no live credentials.

```powershell
cd "$env:USERPROFILE\Projects\clinicflow-ai\backend"
```

```powershell
.\.venv\Scripts\python.exe -m unittest test_receptionist test_owner_admin test_business_settings -v
```

In a separate terminal:

```powershell
cd "$env:USERPROFILE\Projects\clinicflow-ai\frontend"
```

```powershell
npm.cmd run lint
```

```powershell
npm.cmd run build
```

Current local verification: **24 backend tests**, frontend lint and production build pass. See [QA evidence and remaining checks](docs/QA.md). Passing automated checks does not establish a live deployment or complete production security.

## Guides

- [Windows handoff](docs/START_HERE.md)
- [Render + Cloudflare Pages deployment](docs/DEPLOYMENT.md)
- [Security boundaries and remaining production work](docs/SECURITY.md)
- [Sales demo and first customer onboarding](docs/SALES_AND_ONBOARDING.md)
- [Future official WhatsApp integration](docs/WHATSAPP_PLAN.md)

## Deferred

Public deployment and live smoke tests, production privacy/retention and backup operations, distributed abuse protection, full tenant isolation, self-service subscriptions, external scheduling confirmation and WhatsApp. Human handoff currently displays a supplied contact; it does not send messages or notify reception automatically.
