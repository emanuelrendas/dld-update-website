"""
Unified Web Intake Request Handler for RAIOC.

This is the single source of truth for handling inbound web requests from the frontend
website (Private Brief Form, Investor Readiness Assessment, and Funnel Events).
All validation, consent enforcement, scoring, Supabase persistence, session correlation,
executive notification, and WhatsApp URL generation are executed here.
"""
import urllib.parse
from typing import Any

from mission1.notify import send_executive_report
from web_intake import db
from web_intake.contracts import (
    AssessmentSubmitRequest,
    Attribution,
    EventRequest,
    LeadCaptureRequest,
)
from web_intake.events import validate_event_name
from web_intake.intake import (
    CaptureDependencies,
    SubmissionRejected,
    capture_lead,
    submit_assessment,
)
from web_intake.scoring import score_assessment, tier_label
from web_intake.validation import ConsentNotGivenError

DEFAULT_WA_NUMBER = "971543871702"


def compose_whatsapp_url(
    name: str,
    location: str | None = None,
    objective: str | None = None,
    budget: str | None = None,
    mandate: str | None = None,
    score: int | None = None,
    tier_name: str | None = None,
    wa_number: str = DEFAULT_WA_NUMBER,
) -> str:
    lines = [
        "PRIVATE BRIEF — via website",
        f"Name: {name or '-'}",
        f"Based in: {location or '-'}",
        f"Interest: {objective or '-'}",
        f"Budget: {budget or '-'}",
    ]
    if score is not None and tier_name:
        lines.append(f"Assessment Profile: {tier_name} ({score}/100)")
    lines.append(f"Brief: {mandate or '-'}")
    msg = "\n".join(lines)
    return f"https://wa.me/{wa_number}?text={urllib.parse.quote(msg)}"


def handle_web_intake(payload: dict[str, Any], deps: CaptureDependencies | None = None) -> dict[str, Any]:
    """
    Main entrypoint for web intake requests.

    Supported actions:
      - "lead_capture" (default): validates and writes lead to Supabase, returns WhatsApp deep-link.
      - "assessment_submit": scores and persists assessment answers.
      - "event": logs a funnel tracking event.
    """
    if not isinstance(payload, dict):
        return {"ok": False, "error": "Invalid request body: must be a JSON object", "status": 400}

    action = payload.get("action", "lead_capture")

    try:
        if action == "event":
            session_id = payload.get("session_id")
            event_name = payload.get("event_name")
            if not session_id or not event_name:
                return {"ok": False, "error": "Missing session_id or event_name", "status": 400}

            event_props = payload.get("event_props") or {}
            lead_id = payload.get("lead_id")
            page_url = payload.get("page_url")

            db.insert_event(
                session_id=session_id,
                event_name=event_name,
                event_props=event_props,
                lead_id=lead_id,
                page_url=page_url,
            )
            return {"ok": True, "event": event_name}

        elif action == "assessment_submit":
            session_id = payload.get("session_id")
            answers = payload.get("answers")
            if not session_id or not isinstance(answers, dict):
                return {"ok": False, "error": "Missing session_id or answers dictionary", "status": 400}

            req = AssessmentSubmitRequest(
                session_id=session_id,
                answers=answers,
                attribution=Attribution(**payload.get("attribution", {})),
            )
            resp = submit_assessment(
                request=req,
                insert_responses_fn=db.insert_assessment_responses,
                insert_event_fn=db.insert_event,
            )
            return {
                "ok": True,
                "score": resp.score,
                "tier": resp.tier,
                "tier_label": resp.tier_label,
                "is_gated": resp.is_gated,
            }

        elif action == "lead_capture":
            session_id = payload.get("session_id") or ""
            name = payload.get("name") or ""
            email = payload.get("email") or ""
            consent_given = payload.get("consent_given", False)

            attr_dict = payload.get("attribution") or {}
            attribution = Attribution(
                utm_source=attr_dict.get("utm_source"),
                utm_medium=attr_dict.get("utm_medium"),
                utm_campaign=attr_dict.get("utm_campaign"),
                referrer_url=attr_dict.get("referrer_url"),
                page_url=attr_dict.get("page_url"),
            )

            req = LeadCaptureRequest(
                session_id=session_id,
                name=name,
                email=email,
                consent_given=bool(consent_given),
                mobile=payload.get("mobile"),
                location=payload.get("location") or payload.get("address"),
                investment_objective=payload.get("investment_objective"),
                budget_band=payload.get("budget_band"),
                mandate_description=payload.get("mandate_description") or payload.get("notes"),
                lead_magnet=payload.get("lead_magnet"),
                attribution=attribution,
            )

            # Score assessment if answers are included in payload
            computed_score = None
            tier_name = None
            if payload.get("answers") and isinstance(payload.get("answers"), dict):
                breakdown = score_assessment(payload["answers"])
                computed_score = breakdown.result
                tier_name = tier_label(breakdown.result.tier)

            capture_deps = deps or CaptureDependencies(
                insert_lead_fn=db.insert_lead,
                backfill_session_fn=db.backfill_session_lead_id,
                notify_fn=send_executive_report,
            )

            resp = capture_lead(req, capture_deps, computed_score=computed_score)

            wa_url = compose_whatsapp_url(
                name=req.name,
                location=req.location,
                objective=req.investment_objective,
                budget=req.budget_band,
                mandate=req.mandate_description,
                score=resp.score,
                tier_name=tier_name,
            )

            return {
                "ok": True,
                "lead_id": resp.lead_id,
                "score": resp.score,
                "tier": resp.tier,
                "next_step": resp.next_step,
                "whatsapp_url": wa_url,
            }

        else:
            return {"ok": False, "error": f"Unrecognized action '{action}'", "status": 400}

    except ConsentNotGivenError as e:
        return {"ok": False, "error": str(e), "error_code": "CONSENT_REQUIRED", "status": 400}
    except SubmissionRejected as e:
        return {"ok": False, "error": str(e), "problems": e.problems, "status": 400}
    except ValueError as e:
        return {"ok": False, "error": str(e), "status": 400}
    except Exception as e:
        return {"ok": False, "error": f"Internal server error: {e}", "status": 500}
