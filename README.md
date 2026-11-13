# ClinicFlow AI

A reusable business receptionist platform in development. The first demonstration uses **Pearl Dental Care, Karachi**, a fictional dental clinic.

## Current repository status

This repository currently contains setup documentation, ignore rules and an environment template. The application source is on the developer's Windows PC and has **not yet been uploaded**. The project cannot be run from this repository alone yet.

## Development progress

The following local flows were tested by the developer during guided development:

- React homepage with fictional demo services and working hours.
- Appointment form validation.
- FastAPI health endpoint and Supabase connection check.
- Appointment creation through the API and the website, with saved rows verified in Supabase.
- Floating reception widget with quick-answer buttons and navigation to the appointment form.

The current widget uses predefined answers. AI-generated chat has not passed its connection test yet.

## Planned stack

- React, Vite and Tailwind CSS. Tailwind integration is pending.
- Python and FastAPI.
- Supabase Postgres and planned Supabase Auth for the admin dashboard.
- Cloudflare Workers AI integration planned after Gemini availability errors during testing.
- Cloudflare Pages frontend hosting and a separate Python backend host.

## Remaining milestones

- [ ] Upload and inspect the actual frontend and backend source.
- [ ] Pin dependencies and verify installation from a clean checkout.
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

Use synthetic customer details only. No real clinic address, doctors, certifications, reviews or testimonials are represented. An appointment request starts with `New` status and requires reception confirmation. The product must not provide diagnosis or prescriptions.

Business IDs and database access restrictions are an initial foundation. Multi-tenant authorization and isolation have not been completed or tested. Production readiness is pending.

## Secrets

Keep actual credentials in `backend/.env` and server environment settings. Use `backend/.env.example` as the configuration template. Never place private keys in React source or `VITE_` variables. Git ignore rules do not remove secrets that were already committed.

## Next session

Upload the existing Windows project after reviewing the files staged for commit. This remote repository already has initial commits, so incorporate those commits before pushing the local project. Verify the source against the locally tested application before continuing implementation.
