import importlib
import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from business_settings import BusinessSettings, load_business
from receptionist import record_chat_event, rule_reply
import test_owner_admin as owner_tests
from test_owner_admin import BUSINESS


class SettingsTests(unittest.TestCase):
    setUp = owner_tests.OwnerTests.setUp
    tearDown = owner_tests.OwnerTests.tearDown

    def test_editor_round_trip_and_stale_save(self):
        original = self.client.get('/admin/settings', headers=self.headers).json()
        original['settings']['name'] = 'Sample Care Studio'
        original['settings']['services'][0]['price'] = 'PKR 2,000'
        original['settings']['hours'][0]['opens'] = '11:00'
        original['settings']['greeting'] = 'Welcome to our sample business.'
        original['settings']['faqs'] = [{'question': 'Parking?', 'answer': 'Parking details are not supplied.'}]
        response = self.client.put('/admin/settings', headers=self.headers, json=original)
        self.assertEqual(response.status_code, 200)
        current = self.client.get('/admin/settings', headers=self.headers).json()
        self.assertEqual(current['version'], 1)
        self.assertEqual(current['settings'], original['settings'])
        self.assertEqual(self.client.put('/admin/settings', headers=self.headers, json=original).status_code, 409)
        self.assertEqual(rule_reply('Dental checkup price?', BusinessSettings(**current['settings']))[0].split(';')[0], 'Dental checkup: PKR 2,000 Only explicitly listed service prices are available.')

    def test_settings_requires_owner_and_rejects_unsafe_values(self):
        self.assertEqual(self.client.get('/admin/settings').status_code, 401)
        for field, value in [('logo_url', 'javascript:alert(1)'), ('timezone', 'Not/AZone'), ('brand_color', 'red;display:none')]:
            body = self.client.get('/admin/settings', headers=self.headers).json()
            body['settings'][field] = value
            self.assertEqual(self.client.put('/admin/settings', headers=self.headers, json=body).status_code, 422)

    def test_duplicate_services_and_invalid_hours_rejected(self):
        body = self.client.get('/admin/settings', headers=self.headers).json()
        body['settings']['services'].append(body['settings']['services'][0])
        self.assertEqual(self.client.put('/admin/settings', headers=self.headers, json=body).status_code, 422)
        body = self.client.get('/admin/settings', headers=self.headers).json()
        body['settings']['hours'][0]['opens'] = '23:00'
        self.assertEqual(self.client.put('/admin/settings', headers=self.headers, json=body).status_code, 422)

    def test_stored_facts_power_fallback_and_do_not_create_actions(self):
        settings = BusinessSettings(handoff_contact='Sample reception contact')
        reply, action, _ = rule_reply('Contact reception', settings)
        self.assertIn('Sample reception contact', reply)
        self.assertIn('No message has been sent', reply)
        self.assertIsNone(action)
        self.assertIn('10 AM-7 PM', rule_reply('kitne baje open?', settings)[0])

    def test_analytics_are_scoped_and_contain_no_customer_content(self):
        database = MagicMock()
        conversation_id = uuid4()
        record_chat_event(database, BUSINESS, conversation_id, 'cloudflare')
        row = database.table.return_value.insert.call_args.args[0]
        self.assertEqual(set(row), {'business_id', 'conversation_id', 'source'})
        self.assertEqual(row['business_id'], BUSINESS)
        self.database.rpc = MagicMock()
        self.database.rpc.return_value.execute.return_value.data = [{'messages': 4, 'conversations': 2, 'fallback_messages': 1}]
        result = self.client.get('/admin/chat-stats', headers=self.headers)
        self.assertEqual(result.json(), {'messages': 4, 'conversations': 2, 'fallback_messages': 1})
        self.database.rpc.assert_called_once_with('business_chat_stats', {'p_business_id': BUSINESS})

    def test_public_response_and_request_retry(self):
        with patch('supabase.create_client', return_value=self.database):
            module = importlib.import_module('main')
        with patch.object(module, 'supabase', self.database), patch.object(module.app.state, 'database', self.database):
            with TestClient(module.app) as client:
                public = client.get('/business')
                self.assertEqual(public.status_code, 200)
                self.assertEqual(set(public.json()), {'settings', 'version', 'is_demo'})
                when = datetime.now(ZoneInfo('Asia/Karachi')) + timedelta(days=3)
                payload = {'customer_name': 'Synthetic Retry', 'phone': '00000000000', 'service': 'Dental checkup',
                    'preferred_date': str(when.date()), 'preferred_time': '15:00', 'message': 'Synthetic only', 'request_key': str(uuid4())}
                first = client.post('/appointments', json=payload)
                second = client.post('/appointments', json=payload)
                self.assertEqual(first.status_code, 201, first.text)
                self.assertEqual(second.status_code, 201, second.text)
                self.assertEqual(first.json()['request_id'], second.json()['request_id'])
                self.assertEqual(len([row for row in self.database.rows['appointments'] if row.get('request_key') == payload['request_key']]), 1)
                payload['message'] = 'Changed request'
                self.assertEqual(client.post('/appointments', json=payload).status_code, 409)
                private = client.get('/admin/appointments')
                self.assertEqual(private.status_code, 401)
                self.assertEqual(private.headers['cache-control'], 'no-store')


if __name__ == '__main__':
    unittest.main()
