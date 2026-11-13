import copy
import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError

import owner_admin


BUSINESS = "10000000-0000-0000-0000-000000000001"
OTHER_BUSINESS = "20000000-0000-0000-0000-000000000002"
OWNER = "30000000-0000-0000-0000-000000000003"
ROW = "40000000-0000-0000-0000-000000000004"
OTHER_ROW = "50000000-0000-0000-0000-000000000005"


class Query:
    """Small in-memory stand-in for the filtered PostgREST calls under test."""
    def __init__(self, database, table):
        self.database = database
        self.table = table
        self.filters = []
        self.bounds = None
        self.update_values = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, name, value):
        self.filters.append((name, value))
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, value):
        self.bounds = (0, value - 1)
        return self

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    def update(self, values):
        self.update_values = values
        return self

    def execute(self):
        rows = [row for row in self.database.rows[self.table]
                if all(row.get(name) == value for name, value in self.filters)]
        count = len(rows)
        if self.bounds:
            rows = rows[self.bounds[0]:self.bounds[1] + 1]
        if self.update_values:
            for row in rows:
                row.update(self.update_values)
        return SimpleNamespace(data=copy.deepcopy(rows), count=count)


class OwnerTests(unittest.TestCase):
    def setUp(self):
        owner_admin.attempts.clear()
        self.environment = patch.dict(os.environ, {
            "BUSINESS_SLUG": "pearl-dental-care",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "synthetic-secret",
        })
        self.environment.start()
        self.transport = patch.object(owner_admin.httpx, "Client")
        self.transport.start()
        self.database = SimpleNamespace(auth=MagicMock())
        appointment = {
            "id": ROW, "business_id": BUSINESS, "customer_name": "Synthetic Customer",
            "phone": "00000000000", "service": "Dental checkup",
            "preferred_date": "2026-11-20", "preferred_time": "15:00:00",
            "message": "Synthetic demo", "status": "New", "created_at": "2026-11-14T00:00:00Z",
        }
        other = {**appointment, "id": OTHER_ROW, "business_id": OTHER_BUSINESS, "customer_name": "Other Business"}
        self.database.rows = {
            "businesses": [{"id": BUSINESS, "name": "Pearl Dental Care, Karachi", "slug": "pearl-dental-care"}],
            "business_members": [{"business_id": BUSINESS, "user_id": OWNER, "role": "owner"}],
            "appointments": [appointment, other],
        }
        self.database.table = lambda name: Query(self.database, name)
        self.database.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(id=OWNER))
        app = FastAPI()
        app.state.database = self.database
        app.include_router(owner_admin.router)
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer synthetic-user-token"}

    def tearDown(self):
        self.client.close()
        self.transport.stop()
        self.environment.stop()

    def test_missing_and_invalid_tokens_are_denied(self):
        self.assertEqual(self.client.get("/admin/appointments").status_code, 401)
        self.database.auth.get_user.side_effect = AuthApiError("Expired", 401, None)
        self.assertEqual(self.client.get("/admin/appointments", headers=self.headers).status_code, 401)

    def test_non_owner_and_foreign_membership_are_denied(self):
        for memberships in [[], [{"business_id": OTHER_BUSINESS, "user_id": OWNER, "role": "owner"}]]:
            with self.subTest(memberships=memberships):
                self.database.rows["business_members"] = memberships
                self.assertEqual(self.client.get("/admin/appointments", headers=self.headers).status_code, 403)

    def test_membership_is_rechecked_after_revocation(self):
        self.assertEqual(self.client.get("/admin/appointments", headers=self.headers).status_code, 200)
        self.database.rows["business_members"].clear()
        self.assertEqual(self.client.get("/admin/appointments", headers=self.headers).status_code, 403)

    def test_list_and_counts_are_business_scoped(self):
        response = self.client.get("/admin/appointments", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual((data["total"], data["new"], data["confirmed"]), (1, 1, 0))
        self.assertEqual([row["id"] for row in data["appointments"]], [ROW])
        self.assertNotIn("Other Business", response.text)
        self.assertNotIn("business_id", data["appointments"][0])

    def test_status_update_and_stale_update_conflict(self):
        body = {"status": "Confirmed", "expected_status": "New"}
        response = self.client.patch(f"/admin/appointments/{ROW}/status", headers=self.headers, json=body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "Confirmed")
        self.assertEqual(self.client.patch(f"/admin/appointments/{ROW}/status", headers=self.headers, json=body).status_code, 409)
        counts = self.client.get("/admin/appointments", headers=self.headers).json()
        self.assertEqual((counts["new"], counts["confirmed"]), (0, 1))

    def test_foreign_appointment_cannot_be_updated(self):
        response = self.client.patch(f"/admin/appointments/{OTHER_ROW}/status", headers=self.headers,
            json={"status": "Cancelled", "expected_status": "New"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.database.rows["appointments"][1]["status"], "New")

    def test_invalid_status_and_page_are_rejected(self):
        self.assertEqual(self.client.patch(f"/admin/appointments/{ROW}/status", headers=self.headers,
            json={"status": "Paid", "expected_status": "New"}).status_code, 422)
        self.assertEqual(self.client.get("/admin/appointments?page=0", headers=self.headers).status_code, 422)

    def test_login_returns_only_access_token_and_uses_separate_client(self):
        auth_client = MagicMock()
        auth_client.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id=OWNER), session=SimpleNamespace(access_token="synthetic-access", expires_in=3600))
        with patch.object(owner_admin, "create_client", return_value=auth_client):
            result = self.client.post("/admin/login", json={"email": "owner@example.com", "password": "synthetic-password"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(set(result.json()), {"access_token", "expires_in", "business_name"})
        self.database.auth.sign_in_with_password.assert_not_called()
        self.assertNotIn("synthetic-password", result.text)

    def test_login_rejects_valid_user_without_membership(self):
        self.database.rows["business_members"].clear()
        auth_client = MagicMock()
        auth_client.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id=OWNER), session=SimpleNamespace(access_token="synthetic-access", expires_in=3600))
        with patch.object(owner_admin, "create_client", return_value=auth_client):
            result = self.client.post("/admin/login", json={"email": "owner@example.com", "password": "synthetic-password"})
        self.assertEqual(result.status_code, 403)
        self.assertNotIn("synthetic-access", result.text)

    def test_failed_login_is_limited_and_generic(self):
        with patch.object(owner_admin, "create_client", side_effect=AuthApiError("Private upstream error", 400, None)):
            for _ in range(5):
                response = self.client.post("/admin/login", json={"email": "owner@example.com", "password": "wrong"})
                self.assertEqual(response.status_code, 401)
                self.assertNotIn("Private upstream", response.text)
            self.assertEqual(self.client.post("/admin/login", json={"email": "owner@example.com", "password": "wrong"}).status_code, 429)


if __name__ == "__main__":
    unittest.main()
