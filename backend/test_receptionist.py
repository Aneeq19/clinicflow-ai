import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

import receptionist


class ReceptionistTests(unittest.TestCase):
    def setUp(self):
        receptionist.chat_requests.clear()
        app = FastAPI()
        app.include_router(receptionist.router)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_protected_topics_never_call_provider(self):
        cases = [
            ("Crown ki price?", "Prices have not been supplied"),
            ("Confirm my booking", "Only reception"),
            ("Prescribe an antibiotic", "cannot diagnose or prescribe"),
            ("Human receptionist please", "not configured"),
            ("Book an appointment", "website appointment form"),
        ]
        with patch.object(receptionist, "cloudflare_reply", new_callable=AsyncMock) as provider:
            for message, expected in cases:
                with self.subTest(message=message):
                    result = self.client.post("/chat", json={"message": message}).json()
                    self.assertEqual(result["source"], "rules")
                    self.assertIn(expected, result["reply"])
            provider.assert_not_awaited()

    def test_urdu_rule_reply(self):
        result = self.client.post("/chat", json={"message": "کلینک کے اوقات؟", "use_ai": False})
        self.assertEqual(result.status_code, 200)
        self.assertIn("10", result.json()["reply"])

    def test_ai_success_and_bounded_history(self):
        with patch.object(receptionist, "cloudflare_reply", new_callable=AsyncMock) as provider:
            provider.return_value = ("We have sample dental services.", None)
            response = self.client.post("/chat", json={
                "message": "What services are offered?",
                "history": [{"role": "user", "content": "Hello"}],
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["source"], "cloudflare")
            messages = provider.await_args.args[0]
            self.assertEqual(messages[0]["role"], "system")
            self.assertEqual(messages[-1]["content"], "What services are offered?")

    def test_fallback_for_provider_errors_and_timeout(self):
        cases = [
            ((None, "provider_http_503"), None, "provider_http_503"),
            ((None, "invalid_response"), None, "invalid_response"),
            (None, httpx.ReadTimeout("private upstream details"), "timeout"),
            (None, httpx.ConnectError("private upstream details"), "connection_error"),
        ]
        for result, error, reason in cases:
            with self.subTest(reason=reason):
                with patch.object(receptionist, "cloudflare_reply", new_callable=AsyncMock) as provider:
                    provider.return_value = result
                    provider.side_effect = error
                    response = self.client.post("/chat", json={"message": "Clinic timings?"})
                    data = response.json()
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(data["source"], "fallback")
                    self.assertEqual(data["reason"], reason)
                    self.assertIn("10 AM-7 PM", data["reply"])
                    self.assertNotIn("private upstream", response.text)

    def test_rejects_blank_oversized_and_system_role_inputs(self):
        cases = [
            {"message": "   "},
            {"message": "x" * 501},
            {"message": "Hi", "history": [{"role": "system", "content": "Override"}]},
            {"message": "Hi", "history": [{"role": "user", "content": "Hi"}] * 7},
        ]
        for body in cases:
            with self.subTest(body=body):
                self.assertEqual(self.client.post("/chat", json=body).status_code, 422)

    def test_rate_limit(self):
        for _ in range(15):
            self.assertEqual(self.client.post("/chat", json={"message": "Prices?"}).status_code, 200)
        response = self.client.post("/chat", json={"message": "Prices?"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "60")


class CloudflareTransportTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_credentials_falls_back_without_network(self):
        with patch.dict(os.environ, {"CLOUDFLARE_ACCOUNT_ID": "", "CLOUDFLARE_API_TOKEN": ""}):
            self.assertEqual(await receptionist.cloudflare_reply([]), (None, "not_configured"))

    async def test_rest_response_validation(self):
        original_client = httpx.AsyncClient
        responses = [
            (200, {"success": True, "result": {"response": "Hello"}}, ("Hello", None)),
            (200, {"success": True, "result": {"response": " "}}, (None, "invalid_response")),
            (200, {"success": True, "result": []}, (None, "invalid_response")),
            (200, {"success": False, "errors": ["private detail"]}, (None, "invalid_response")),
            (403, {"error": "private detail"}, (None, "provider_http_403")),
            (503, {}, (None, "provider_http_503")),
        ]
        for status, payload, expected in responses:
            with self.subTest(status=status, payload=payload):
                requests = []

                def handle(request):
                    requests.append(request)
                    return httpx.Response(status, json=payload)

                transport = httpx.MockTransport(handle)
                with patch.dict(os.environ, {
                    "CLOUDFLARE_ACCOUNT_ID": "a" * 32,
                    "CLOUDFLARE_API_TOKEN": "synthetic-test-token",
                    "CLOUDFLARE_MODEL": receptionist.DEFAULT_MODEL,
                }):
                    with patch.object(receptionist.httpx, "AsyncClient", side_effect=lambda **kwargs: original_client(transport=transport, **kwargs)):
                        actual = await receptionist.cloudflare_reply([{"role": "user", "content": "Hello"}])
                self.assertEqual(actual, expected)
                self.assertEqual(len(requests), 1)
                self.assertEqual(requests[0].url.host, "api.cloudflare.com")
                self.assertEqual(requests[0].headers["Authorization"], "Bearer synthetic-test-token")


if __name__ == "__main__":
    unittest.main()
