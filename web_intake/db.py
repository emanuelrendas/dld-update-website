"""
Supabase PostgREST persistence layer for inbound website leads, events, and assessments.

Supports both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY, as well as
SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL.
"""
from datetime import datetime, timezone
import urllib.parse
import requests

from mission1.config import get_supabase_url, get_supabase_service_key
from web_intake.events import validate_event_name


def _headers() -> dict:
    key = get_supabase_service_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _base_url() -> str:
    return get_supabase_url() + "/rest/v1"


def insert_lead(row: dict) -> str:
    """
    Inserts a newly captured lead into the Supabase `leads` table.
    Returns the generated `lead_id` (UUID string).
    """
    url = f"{_base_url()}/leads"
    payload = dict(row)
    payload.setdefault("created_at", datetime.now(timezone.utc).isoformat())

    resp = requests.post(url, headers=_headers(), json=payload, timeout=15)
    resp.raise_for_status()

    created = resp.json()
    if isinstance(created, list) and len(created) > 0:
        return str(created[0].get("id"))
    elif isinstance(created, dict) and "id" in created:
        return str(created["id"])
    raise RuntimeError(f"Unexpected response inserting lead: {created}")


def insert_assessment_responses(session_id: str, answers: dict[str, str], lead_id: str | None = None) -> None:
    """
    Persists raw assessment question responses linked to an anonymous or identified session.
    """
    url = f"{_base_url()}/lead_assessment_responses"
    payload = {
        "session_id": session_id,
        "responses": answers,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if lead_id:
        payload["lead_id"] = lead_id

    resp = requests.post(url, headers=_headers(), json=payload, timeout=15)
    resp.raise_for_status()


def insert_event(
    session_id: str,
    event_name: str,
    event_props: dict | None = None,
    lead_id: str | None = None,
    page_url: str | None = None,
) -> None:
    """
    Records a funnel / analytics event into `lead_events` after validating the event name.
    """
    validate_event_name(event_name)

    url = f"{_base_url()}/lead_events"
    payload = {
        "session_id": session_id,
        "event_name": event_name,
        "event_props": event_props or {},
        "page_url": page_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if lead_id:
        payload["lead_id"] = lead_id

    resp = requests.post(url, headers=_headers(), json=payload, timeout=15)
    resp.raise_for_status()


def backfill_session_lead_id(session_id: str, lead_id: str) -> None:
    """
    Correlates pre-identification events and assessment responses with the newly captured lead.
    """
    body = {"lead_id": lead_id}
    headers = _headers()
    encoded_sess = urllib.parse.quote(session_id)

    # Backfill assessment responses
    url_responses = f"{_base_url()}/lead_assessment_responses?session_id=eq.{encoded_sess}&lead_id=is.null"
    resp_res = requests.patch(url_responses, headers=headers, json=body, timeout=15)
    resp_res.raise_for_status()

    # Backfill events
    url_events = f"{_base_url()}/lead_events?session_id=eq.{encoded_sess}&lead_id=is.null"
    resp_ev = requests.patch(url_events, headers=headers, json=body, timeout=15)
    resp_ev.raise_for_status()


def update_lead_score(lead_id: str, score: int, score_tier: str) -> None:
    """
    Updates the score and score tier on an existing `leads` row.
    """
    encoded_id = urllib.parse.quote(lead_id)
    url = f"{_base_url()}/leads?id=eq.{encoded_id}"
    body = {
        "score": score,
        "score_tier": score_tier,
        "score_computed_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    resp = requests.patch(url, headers=_headers(), json=body, timeout=15)
    resp.raise_for_status()
