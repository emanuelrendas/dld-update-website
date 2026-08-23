import pytest
from unittest.mock import patch, MagicMock

from web_intake.handler import handle_web_intake, compose_whatsapp_url
from web_intake.intake import CaptureDependencies


def test_compose_whatsapp_url_encodes_parameters():
    url = compose_whatsapp_url(
        name="Carlos Silva",
        location="Lisbon",
        objective="Capital appreciation",
        budget="AED 5M - 15M",
        mandate="Looking for prime beachfront",
        score=90,
        tier_name="Strategic Partner Profile",
    )
    assert "https://wa.me/971543871702?text=" in url
    assert "Carlos%20Silva" in url or "Carlos+Silva" in url or "Carlos Silva" in urllib_unquote(url)


def urllib_unquote(url):
    import urllib.parse
    return urllib.parse.unquote(url)


def test_handle_web_intake_lead_capture_success():
    inserted = []
    deps = CaptureDependencies(
        insert_lead_fn=lambda row: inserted.append(row) or "lead-test-1",
        backfill_session_fn=lambda s, l: None,
        notify_fn=lambda t: None,
    )

    payload = {
        "action": "lead_capture",
        "session_id": "sess-test-1",
        "name": "Jane Investor",
        "email": "jane@example.com",
        "consent_given": True,
        "location": "Madrid, Spain",
        "investment_objective": "rental_income",
        "budget_band": "10m_25m",
        "mandate_description": "Seeking high net yield",
    }

    res = handle_web_intake(payload, deps=deps)
    assert res["ok"] is True
    assert res["lead_id"] == "lead-test-1"
    assert "whatsapp_url" in res
    assert "wa.me/971543871702" in res["whatsapp_url"]
    assert len(inserted) == 1
    assert inserted[0]["name"] == "Jane Investor"
    assert inserted[0]["address"] == "Madrid, Spain"
    assert inserted[0]["consent_status"] == "opted_in"


def test_handle_web_intake_refuses_without_consent():
    deps = CaptureDependencies(
        insert_lead_fn=lambda row: "fail",
    )
    payload = {
        "action": "lead_capture",
        "session_id": "sess-test-2",
        "name": "No Consent",
        "email": "noconsent@example.com",
        "consent_given": False,
    }
    res = handle_web_intake(payload, deps=deps)
    assert res["ok"] is False
    assert res.get("error_code") == "CONSENT_REQUIRED" or "consent" in res.get("error", "").lower()


def test_handle_web_intake_assessment_submit():
    with patch("web_intake.db.insert_assessment_responses") as mock_resp, patch("web_intake.db.insert_event") as mock_ev:
        payload = {
            "action": "assessment_submit",
            "session_id": "sess-assess-1",
            "answers": {
                "objective": "golden_visa",
                "budget_band": "50m_plus",
            }
        }
        res = handle_web_intake(payload)
        assert res["ok"] is True
        assert res["score"] == 30
        assert res["is_gated"] is True
        assert mock_resp.called
        assert mock_ev.called


def test_handle_web_intake_event_logging():
    with patch("web_intake.db.insert_event") as mock_ev:
        payload = {
            "action": "event",
            "session_id": "sess-event-1",
            "event_name": "whatsapp_clicked",
            "page_url": "https://emanuelrendas.com/contact",
        }
        res = handle_web_intake(payload)
        assert res["ok"] is True
        assert res["event"] == "whatsapp_clicked"
        assert mock_ev.called
