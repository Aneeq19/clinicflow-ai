# Security boundaries

This is a fictional-business demo for synthetic data. It is not a certification, medical system or production readiness claim.

## Implemented

- Private Supabase and AI keys stay on the backend, sourced from environment variables.
- Owner tokens are verified with Supabase Auth on each owner request, then checked against the configured business's owner membership. Login uses a separate client so it cannot replace the shared service client's identity.
- Owner appointments, edits, settings and statistics use the server-authorized business ID. Public endpoints never list appointment/customer records.
- Owner responses use `Cache-Control: no-store`. The frontend holds the token in memory, requires a fresh sign-in after reload and clears private state on sign-out/session expiry.
- Database tables enable RLS and revoke direct access from anonymous/authenticated clients. The service role bypasses RLS: server authorization is essential. Migration 003 restricts business updates to the intended settings columns.
- Pydantic bounds and types validate appointment/settings inputs. Settings reject unsafe logo URL schemes, duplicate services and invalid timezones/hours. React renders owner/customer text as text, not raw HTML.
- Owner data is treated as untrusted context in AI prompts. The model has no tool permissions to edit data, confirm appointments or send messages. Deterministic rules cover medical advice, booking confirmation and supplied-price queries. This reduces risk; it is not proof that all AI hallucinations or prompt injection are eliminated.
- Basic in-process/IP rate limits protect login, owner requests, appointment submissions and chat. Explicit CORS origins protect browser access; CORS is not authentication.
- Settings and status edits require explicit owner save actions with stale-value checks. Customer bookings remain requests until a human changes their status.
- Same-form retry UUIDs plus a per-business unique index and payload fingerprint protect appointment retries. Changing form fields creates a new request reference.
- Application code does not log customer payloads, tokens or secrets. Chat event analytics store only business ID, random conversation ID, source and timestamp.

## Limits before a paying production rollout

1. Implement and test distributed rate limiting, trusted proxy/IP handling, edge abuse protection and appropriate host limits. In-memory limits reset on restart and are not coordinated across workers. Application public-body limits and provider/database timeouts do not replace edge request-size/connection limits.
2. Review live Supabase grants/RLS and test denied access from actual anonymous, authenticated and unrelated owner accounts. Local mocked API tests and embedded PostgreSQL tests cannot replace these live checks.
3. Set up owner account recovery/MFA, access revocation and session expiry policy. UI sign-out discards its token; it does not centrally revoke a copied token before that token expires.
4. Establish privacy notices, a lawful basis for data processing, retention/deletion, backups and restoration drills. Select hosting regions and appropriate provider agreements before handling real customer or health data. Avoid medical details in chat and booking notes.
5. Perform mobile/accessibility review, keyboard testing, dependency monitoring and independent application security review. A user-supplied brand color or logo can affect readability and layout.
6. Add request IDs and operational alerts that exclude PII, secret rotation and outage monitoring. Anonymous analytics writes are best effort and can undercount when storage fails. Random conversation IDs are estimates of chat sessions, not verified unique people.
7. Implement public tenant routing, membership lifecycle, cross-tenant API/database tests, provisioning and billing before offering a shared multi-tenant service. Current deployments select one server-side business slug.
8. Scheduling integrations, notifications and WhatsApp require their own authorization, delivery verification and failure/idempotency handling. The current chat does not claim these actions occurred.

## Public information

Everything entered in Business settings is intended for public display, including FAQs, contact, rules and greeting. Never put API keys, passwords, private notes or patient information there. A logo URL is fetched by the visitor's browser from a third party; use only an approved public asset.

## If a key is exposed

Rotate it in its provider dashboard, update the backend environment and redeploy. Removing it from the latest Git commit alone is insufficient. Review access logs privately and purge exposed history where necessary. Do not paste secrets into chat, screenshots or GitHub issues.
