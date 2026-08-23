"""
Orchestration for the website lead capture flow.

Follows dependency-injection pattern (ADR-0003): all external calls (DB writes,
executive notification) are injected callables.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from mission1.enrichment import EnrichmentResult
from web_intake.contracts import (
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    LeadCaptureRequest,
    LeadCaptureResponse,
)
from web_intake.scoring import score_assessment, tier_label
from web_intake.validation import assert_consent_given, validate_lead_capture


class SubmissionRejected(RuntimeError):
    """Raised when a lead capture request fails validation."""

    def __init__(self, problems: list[str]):
        super().__init__(f"Lead capture request rejected: {problems}")
        self.problems = problems


def submit_assessment(
    request: AssessmentSubmitRequest,
    insert_responses_fn: Callable[[str, dict[str, str]], None],
    insert_event_fn: Callable[[str, str, dict | None], None] | None = None,
) -> AssessmentSubmitResponse:
    """
    Scores a completed (or partial) assessment and persists raw answers.
    """
    breakdown = score_assessment(request.answers)

    insert_responses_fn(request.session_id, request.answers)

    if insert_event_fn:
        event_name = (
            "assessment_completed"
            if breakdown.answered_count == breakdown.total_questions
            else "assessment_abandoned"
        )
        insert_event_fn(request.session_id, event_name, {"answered_count": breakdown.answered_count})

    return AssessmentSubmitResponse(
        score=breakdown.result.score,
        tier=breakdown.result.tier,
        tier_label=tier_label(breakdown.result.tier),
        is_gated=True,
    )


@dataclass
class CaptureDependencies:
    insert_lead_fn: Callable[[dict], str]
    backfill_session_fn: Callable[[str, str], None] | None = None
    notify_fn: Callable[[str], None] | None = None


def capture_lead(
    request: LeadCaptureRequest,
    deps: CaptureDependencies,
    computed_score: EnrichmentResult | None = None,
) -> LeadCaptureResponse:
    """
    Turns an identified visitor into a real `leads` row in Supabase.
    """
    problems = validate_lead_capture(request)
    if problems:
        raise SubmissionRejected(problems)

    assert_consent_given(request)

    row = {
        "name": request.name,
        "email": request.email,
        "mobile": request.mobile,
        "address": request.location,
        "consent_status": "opted_in",
        "status": "new",
        "origin": "website",
        "utm_source": request.attribution.utm_source,
        "utm_medium": request.attribution.utm_medium,
        "utm_campaign": request.attribution.utm_campaign,
        "referrer_url": request.attribution.referrer_url,
        "lead_magnet": request.lead_magnet,
        "investment_objective": request.investment_objective,
        "budget_band": request.budget_band,
        "notes": request.mandate_description,
    }
    if computed_score is not None:
        row["score"] = computed_score.score
        row["score_tier"] = computed_score.tier
        row["score_computed_at"] = datetime.now(timezone.utc).isoformat()

    lead_id = deps.insert_lead_fn(row)

    if deps.backfill_session_fn:
        deps.backfill_session_fn(request.session_id, lead_id)

    if deps.notify_fn:
        tier_note = (
            f" ({tier_label(computed_score.tier)}, {computed_score.score}/100)"
            if computed_score
            else ""
        )
        try:
            deps.notify_fn(f"New website lead: {request.name} <{request.email}>{tier_note}")
        except Exception:  # noqa: BLE001
            pass

    if computed_score and computed_score.tier in ("priority", "strategic_partner"):
        next_step = "whatsapp_consultation"
    elif computed_score:
        next_step = "view_full_report"
    else:
        next_step = "await_review"

    return LeadCaptureResponse(
        lead_id=lead_id,
        score=computed_score.score if computed_score else None,
        tier=computed_score.tier if computed_score else None,
        next_step=next_step,
    )
