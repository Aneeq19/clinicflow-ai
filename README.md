# ClinicFlow AI

A reusable business receptionist platform in development. The first demonstration uses **Pearl Dental Care, Karachi**, a fictional dental clinic.

## Current progress

The frontend and backend source are now uploaded to this repository.

The following local flows were tested by the developer during guided development:

- React homepage with fictional sample services and clinic hours.
- Appointment form validation.
- FastAPI health endpoint and Supabase connection check.
- Appointment creation through the API and website, with saved rows verified in Supabase.
- Floating reception widget with quick answers and navigation to the appointment form.

The current widget uses predefined answers. AI-generated chat has not passed its connection test. Gemini tests encountered availability errors. Cloudflare Workers AI integration is the next planned milestone.

## Stack

- React and Vite, with Oxlint. Tailwind integration is pending.
- Python and FastAPI.
- Supabase Postgres. Supabase Auth integration for the owner dashboard is pending.
- Planned Cloudflare Workers AI integration.
- Planned Cloudflare Pages frontend hosting and separate Python backend hosting.

## Remaining milestones

- [x] Upload the application source to GitHub.
- [ ] Pin backend dependencies and verify a clean installation.
- [ ] Connect typed AI chat with bounded timeouts and rule-based fallback.
- [ ] Test English, Urdu and Roman Urdu conversations and unsupported questions.
- [ ] Build authenticated admin access and authorization checks.
- [ ] Add appointment management and editable business configuration.
- [ ] Add statistics based on stored events.
- [ ] Complete responsive design and externally embeddable widget.
- [ ] Test public access restrictions, request limits and failure paths.
- [ ] Deploy and test the public demo.
- [ ] Add sales demo script and customer onboarding documentation.

## Demo boundaries

Use synthetic customer details only. No real clinic address, doctors, certifications, reviews or testimonials are represented. Appointment requests start with `New` status and require reception confirmation. The product must not provide diagnosis or prescriptions.

Business IDs and database access restrictions are an initial foundation. Multi-tenant authorization and isolation have not been completed or tested. Production readiness is pending.

## Secrets

Keep actual credentials in `backend/.env` and server environment settings. Use `backend/.env.example` as the configuration template. Never place private keys in React source or `VITE_` variables. Git ignore rules do not remove previously committed secrets.

## Continue development on Windows

Pull remote changes before editing locally, after committing or otherwise preserving any local changes:

```powershell
git pull --ff-only
```

Cloudflare setup requires an Account ID and a Workers AI API token stored only in the backend environment. The sample settings are prepared, but the integration is not implemented yet.
