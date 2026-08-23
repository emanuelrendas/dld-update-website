import pytest
from unittest.mock import patch, MagicMock

from web_intake.db import (
    insert_lead,
    insert_assessment_responses,
    insert_event,
    backfill_session_lead_id,
    update_lead_score,
)
from web_intake.events import UnknownEventError


def test_insert_lead_returns_id(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "mock-key")

    mock_resp = MagicMock()
    mock_resp.json.return_value = [{"id": "lead-uuid-456"}]
    mock_resp.raise_for_status.return_value = None

    with patch("requests.post", return_value=mock_resp) as mock_post:
        lead_id = insert_lead({"name": "Test User", "email": "test@example.com"})
        assert lead_id == "lead-uuid-456"
        assert mock_post.called
        assert "/leads" in mock_post.call_args[0][0]


def test_insert_assessment_responses_posts_payload(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "mock-key")

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("requests.post", return_value=mock_resp) as mock_post:
        insert_assessment_responses("sess-1", {"q1": "val1"}, lead_id="lead-1")
        assert mock_post.called
        assert "/lead_assessment_responses" in mock_post.call_args[0][0]
        assert mock_post.call_args[1]["json"]["session_id"] == "sess-1"
        assert mock_post.call_args[1]["json"]["lead_id"] == "lead-1"


def test_insert_event_validates_and_posts(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "mock-key")

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("requests.post", return_value=mock_resp) as mock_post:
        insert_event("sess-2", "page_view", {"page": "/contact"})
        assert mock_post.called
        assert "/lead_events" in mock_post.call_args[0][0]

    with pytest.raises(UnknownEventError):
        insert_event("sess-2", "invalid_custom_event")


def test_backfill_session_patches_both_tables(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "mock-key")

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("requests.patch", return_value=mock_resp) as mock_patch:
        backfill_session_lead_id("sess-3", "lead-789")
        assert mock_patch.call_count == 2


def test_update_lead_score_patches_leads(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "mock-key")

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("requests.patch", return_value=mock_resp) as mock_patch:
        update_lead_score("lead-1", 85, "strategic_partner")
        assert mock_patch.called
        assert "/leads?id=eq.lead-1" in mock_patch.call_args[0][0]
        assert mock_patch.call_args[1]["json"]["score"] == 85
