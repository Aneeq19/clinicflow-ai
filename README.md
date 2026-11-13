# ClinicFlow AI

A business receptionist demo for **Pearl Dental Care, Karachi**, a fictional clinic.

## Implemented

- React website, sample services and sample business hours.
- Appointment requests saved through FastAPI to Supabase, starting with `New` status.
- Floating receptionist with quick answers, typed chat and short conversation context.
- Cloudflare Workers AI integration with a 12-second overall provider deadline and no application retries.
- Rule-based fallback on missing credentials, provider errors, timeouts and malformed responses.
- Deterministic replies for pricing, confirmation, medical advice and handoff questions.
- Input limits and process-local chat rate limiting (15 valid requests per IP per minute).
- Source labels distinguish Cloudflare replies, rule replies and fallback replies.
- Owner login at `/admin`, verified Supabase tokens and explicit business membership checks.
- Business-scoped appointment lists, stored-data counts, pagination and status updates.
- Manual approval prompts before confirming or cancelling requests and stale-update conflict checks.

## Verification

The developer previously verified website appointment saving against Supabase locally.
The new chat route is covered by automated tests using synthetic requests and mocked Cloudflare responses. These cover successful replies, provider errors, timeout handling, protected topics, Urdu fallback, input limits and rate limiting. A mocked provider success is not proof of live account access.

**The developer has verified live Cloudflare service and Roman Urdu replies, plus the initial safety checks. Owner login against the live Supabase account is the next local verification step.**

The owner API has 10 automated tests using synthetic users and an in-memory database stand-in. Cases include missing/expired tokens, non-owners, cross-business access denial, revoked membership, login limits, scoped counts and stale status conflicts. These tests do not certify full multi-tenant security or replace live Supabase authorization checks.

## Run locally on Windows

From the project root, install backend dependencies:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

On a new machine, create the environment first with `py -m venv backend/.venv`.
Copy `backend/.env.example` to `backend/.env` and fill in real settings locally. An existing `.env` should be preserved.

Required settings:

- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BUSINESS_SLUG`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- Optional `CLOUDFLARE_MODEL`, defaulting to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

Start the backend in one PowerShell terminal:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Start the frontend in another terminal from the project root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the Vite local URL, normally `http://localhost:5173`. Local CORS currently permits port 5173. Chat defaults to `http://127.0.0.1:8000`; an optional `VITE_API_BASE_URL` can configure the chat backend. The appointment form still uses its existing local URL. Deployment configuration is pending.

## Test chat

From the project root:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend -p test_receptionist.py -v
```

Open `/docs` on the backend and try `POST /chat`:

```json
{"message": "What services do you offer?", "history": [], "use_ai": true}
```

A live success has `source: "cloudflare"`. A provider failure gives `source: "fallback"`, a safe reply and a non-sensitive reason code. `use_ai: false` exercises rules without calling Cloudflare. Rule replies for protected topics intentionally skip the model even when AI is enabled.

The quick buttons remain available if the backend is down. Chat cannot create, confirm or change appointments. Use the appointment form to request a visit.

## Remaining milestones

- [x] Upload source to GitHub.
- [x] Implement Cloudflare chat, fallback and typed widget.
- [x] Verify live Cloudflare access and initial English / Roman Urdu replies.
- [ ] Complete broader Urdu and adversarial conversation testing.
- [ ] Move demo facts into editable, business-scoped database settings.
- [x] Implement owner authentication and business-membership authorization.
- [ ] Verify live owner login and status management on the developer's Supabase project.
- [x] Implement appointment status management and stored appointment counts.
- [ ] Add lead and conversation analytics based on stored events.
- [ ] Complete premium responsive styling and externally embeddable widget.
- [ ] Add production rate limits, abuse controls and complete access-control tests.
- [ ] Pin backend dependencies and verify a clean installation.
- [ ] Deploy and test the public demo.
- [ ] Add sales script and first-customer onboarding documentation.

## Demo and security boundaries

Use synthetic details only. No real doctors, addresses, testimonials or certifications are represented. Business settings and chat facts are still demo constants. The chatbot has no database, scheduling or messaging tools. Unknown prices and contact details are unavailable. Appointment requests require reception confirmation.

Language-model answers can be inaccurate and prompts alone cannot guarantee factual or medical safety. Protected-topic rules are an initial guard, not a complete safety classifier. Broader adversarial testing is pending. Chat transcripts are kept in browser memory for the current page session and are not stored by this application. Recent messages are sent to Cloudflare when AI is requested. Basic conversation analytics and human handoff delivery are pending.

Owner routes verify the Supabase user token on every request and check membership for the configured business before accessing appointment data. The service key bypasses RLS, so these backend filters are required. Cross-business denial is covered by synthetic API tests, but complete multi-tenant isolation and live end-to-end security verification are still pending. Rate limiting is in process memory and resets on restart. The public demo is not production ready.

Keep secrets in `backend/.env` and hosting environment settings. Never put tokens in React source, `VITE_` variables or commits. Keep server logs free of customer text and credentials.

## Owner dashboard

1. Create an owner account in Supabase Authentication → Users. Keep the password private.
2. Run `backend/sql/002_business_owner.sql` in the Supabase SQL Editor after replacing `YOUR_OWNER_EMAIL` in both places. Confirm the result shows the intended business and `owner` role.
3. Restart the backend after pulling the code. No additional frontend credentials are needed.
4. Visit `http://localhost:5173/admin` and use the created Auth email/password.
5. Verify total, New and Confirmed counts against the stored appointment rows. Change a synthetic request to Contacted, save and refresh to verify persistence. Confirmed and Cancelled require an approval prompt.
6. Sign out and verify that the list disappears. A new browser page or refresh requires signing in again.

Tokens stay in React memory. The demo does not implement refresh-token persistence. Sign out clears this page's token and data, while an already copied JWT can remain valid until expiry. Server-side logout/session revocation, MFA and further production session hardening are pending. Membership removal is checked on the next API request. Production traffic must use HTTPS.

Run owner tests from the project root:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend -p test_owner_admin.py -v
```

Admin routes send `Cache-Control: no-store`. Appointment counts are fetched live, not fabricated. Dashboard cards currently count appointment requests, not chat inquiries. Business settings editors and lead/conversation dashboards remain pending.
