# Official WhatsApp integration plan

WhatsApp is not implemented in this MVP. The widget's handoff setting displays contact information and sends no messages.

## Before implementation

- The business needs a Meta business portfolio and WhatsApp Business Account, a suitable business phone number and the required Meta onboarding/verification steps.
- Start with Meta's test setup. Review production permissions, token management and phone-number requirements for the intended business.
- Obtain appropriate customer messaging permission and review current WhatsApp business messaging policies.

## Webhook design

- Expose an HTTPS endpoint.
- For the verification GET, compare the provided verification token and return Meta's challenge only when valid.
- Validate incoming POST signatures against the raw request bytes using the Meta app secret.
- Process event IDs idempotently, acknowledge promptly, and use a queue/retry policy for downstream work.
- Map the receiving phone-number ID to an explicitly authorized business. Never take a business ID supplied by a chat message as authorization.
- Keep tokens, app secret and verification token on the server. Avoid customer text in logs.

## Messaging rules and cost

The customer-service window governs when free-form replies may be sent. Messages outside the permitted window generally require approved templates. Template eligibility, category rules and rates must be rechecked before launch. Billable messages, AI inference, backend hosting and optional provider fees can all contribute to operating cost. There is no unlimited-free WhatsApp promise or fixed cost estimate in this version.

At implementation time, obtain the current Meta rate card for the recipient markets and intended message categories, estimate expected volume, and agree a budget with the owner before enabling paid traffic.

Official starting points

- [Meta webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
- [WhatsApp Cloud API getting started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/)
- [WhatsApp platform pricing](https://business.whatsapp.com/products/platform-pricing)

Only official WhatsApp Business Cloud API integration is planned. No browser automation, scraping or unofficial account sessions are used.
