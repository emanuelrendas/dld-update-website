import json
import pytest
from unittest.mock import patch, MagicMock

from mission1.config import get_supabase_url, get_supabase_service_key, ConfigError
from web_intake.handler import handle_web_intake


def test_get_supabase_url_resolves_standard_and_fallbacks(monkeypatch):
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('NEXT_PUBLIC_SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_REST_URL', raising=False)

    with pytest.raises(ConfigError):
        get_supabase_url()

    monkeypatch.setenv('NEXT_PUBLIC_SUPABASE_URL', 'https://preview.supabase.co/')
    assert get_supabase_url() == 'https://preview.supabase.co'

    monkeypatch.setenv('SUPABASE_URL', 'https://prod.supabase.co/')
    assert get_supabase_url() == 'https://prod.supabase.co'


def test_get_supabase_service_key_resolves_standard_and_fallbacks(monkeypatch):
    monkeypatch.delenv('SUPABASE_SERVICE_ROLE_KEY', raising=False)
    monkeypatch.delenv('SUPABASE_SERVICE_KEY', raising=False)
    monkeypatch.delenv('SUPABASE_SECRET_KEY', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)

    with pytest.raises(ConfigError):
        get_supabase_service_key()

    monkeypatch.setenv('SUPABASE_SECRET_KEY', 'secret_key_123')
    assert get_supabase_service_key() == 'secret_key_123'

    monkeypatch.setenv('SUPABASE_SERVICE_KEY', 'service_key_456')
    assert get_supabase_service_key() == 'service_key_456'

    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service_role_key_789')
    assert get_supabase_service_key() == 'service_role_key_789'


def test_handle_web_intake_lead_capture_with_service_role_key(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://mock.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key')
    monkeypatch.delenv('SUPABASE_SERVICE_KEY', raising=False)

    with patch('requests.post') as mock_post, patch('requests.patch') as mock_patch:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = [{'id': 'lead-srv-role-uuid'}]
        mock_post.return_value = mock_resp
        mock_patch.return_value = mock_resp

        res = handle_web_intake({
            'action': 'lead_capture',
            'session_id': 'sess-role-test',
            'name': 'Maria Silva',
            'email': 'maria@example.com',
            'consent_given': True,
            'location': 'Madrid, Spain',
            'investment_objective': 'Rental yield',
            'budget_band': '5m_10m',
            'mandate_description': 'Looking for prime prime assets',
        })

        assert res['ok'] is True
        assert res['lead_id'] == 'lead-srv-role-uuid'
        assert 'whatsapp_url' in res
        assert mock_post.called

        headers = mock_post.call_args[1]['headers']
        assert headers['apikey'] == 'service-role-test-key'
        assert headers['Authorization'] == 'Bearer service-role-test-key'
