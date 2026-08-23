"""
Supabase PostgREST access layer for Mission 1 outreach pipeline.

Supports SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY, as well as
SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL.
"""
from datetime import datetime, timezone
import json
import urllib.parse
import requests

from mission1.config import get_supabase_url, get_supabase_service_key
from mission1.validation import Lead


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


def dict_to_lead(row: dict) -> Lead:
    """Safely converts a Supabase leads row dictionary to a Lead dataclass."""
    return Lead(
        id=str(row.get("id", "")),
        name=row.get("name") or "",
        email=row.get("email") or "",
        mobile=row.get("mobile"),
        address=row.get("address") or row.get("location"),
        consent_status=row.get("consent_status", "unknown"),
        status=row.get("status", "new"),
    )


def fetch_consented_new_leads(limit: int = 10) -> list[dict]:
    """Leads that are opted_in AND still status=new."""
    url = (
        f"{_base_url()}/leads"
        f"?consent_status=eq.opted_in&status=eq.new&select=*&limit={limit}"
    )
    resp = requests.get(url, headers=_headers(), timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_consented_leads_as_models(limit: int = 10) -> list[Lead]:
    """Fetches consented new leads and returns them as Lead dataclass objects for pipeline.py."""
    raw_leads = fetch_consented_new_leads(limit=limit)
    return [dict_to_lead(r) for r in raw_leads]


def update_lead_status(lead_id: str, status: str, notes: str | None = None) -> None:
    encoded_id = urllib.parse.quote(lead_id)
    url = f"{_base_url()}/leads?id=eq.{encoded_id}"
    body = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if notes is not None:
        body["notes"] = notes
    resp = requests.patch(url, headers=_headers(), json=body, timeout=15)
    resp.raise_for_status()


def save_lead_dossier(lead_id: str, dossier_data: dict) -> None:
    """Stores executive brief dossier JSON in Supabase leads record."""
    encoded_id = urllib.parse.quote(lead_id)
    url = f"{_base_url()}/leads?id=eq.{encoded_id}"
    body = {
        "dossier": json.dumps(dossier_data, ensure_ascii=False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = requests.patch(url, headers=_headers(), json=body, timeout=15)
        resp.raise_for_status()
    except Exception:
        pass
