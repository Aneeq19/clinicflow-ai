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

## Verification

The developer previously verified website appointment saving against Supabase locally.
The new chat route is covered by automated tests using synthetic requests and mocked Cloudflare responses. These cover successful replies, provider errors, timeout handling, protected topics, Urdu fallback, input limits and rate limiting. A mocked provider success is not proof of live account access.

**Live Cloudflare generation and language quality still require verification using the developer's local credentials.**

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
- [ ] Verify live Cloudflare access and English, Urdu and Roman Urdu quality.
- [ ] Move demo facts into editable, business-scoped database settings.
- [ ] Build owner authentication and authorization.
- [ ] Add appointment status management, leads and stored-data statistics.
- [ ] Complete premium responsive styling and externally embeddable widget.
- [ ] Add production rate limits, abuse controls and complete access-control tests.
- [ ] Pin backend dependencies and verify a clean installation.
- [ ] Deploy and test the public demo.
- [ ] Add sales script and first-customer onboarding documentation.

## Demo and security boundaries

Use synthetic details only. No real doctors, addresses, testimonials or certifications are represented. Business settings and chat facts are still demo constants. The chatbot has no database, scheduling or messaging tools. Unknown prices and contact details are unavailable. Appointment requests require reception confirmation.

Language-model answers can be inaccurate and prompts alone cannot guarantee factual or medical safety. Protected-topic rules are an initial guard, not a complete safety classifier. Broader adversarial testing is pending. Chat transcripts are kept in browser memory for the current page session and are not stored by this application. Recent messages are sent to Cloudflare when AI is requested. Basic conversation analytics and human handoff delivery are pending.

Tenant IDs are only an initial foundation. Owner authorization and multi-tenant isolation have not been completed or tested. Rate limiting is in process memory and resets on restart. The public demo is not production ready.

Keep secrets in `backend/.env` and hosting environment settings. Never put tokens in React source, `VITE_` variables or commits. Keep server logs free of customer text and credentials.
