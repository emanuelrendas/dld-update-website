import pytest

from web_intake.contracts import (
    AssessmentSubmitRequest,
    Attribution,
    LeadCaptureRequest,
)
from web_intake.intake import (
    CaptureDependencies,
    SubmissionRejected,
    capture_lead,
    submit_assessment,
)
from web_intake.scoring import score_assessment
from web_intake.validation import ConsentNotGivenError


def test_submit_assessment_persists_answers_and_returns_gated_response():
    persisted = {}

    def fake_insert_responses(session_id, answers):
        persisted[session_id] = answers

    req = AssessmentSubmitRequest(session_id="sess-1", answers={"objective": "golden_visa"})
    resp = submit_assessment(req, insert_responses_fn=fake_insert_responses)

    assert persisted["sess-1"] == {"objective": "golden_visa"}
    assert resp.is_gated is True
    assert resp.score == 5  # only the objective question answered, no completion bonus
    assert resp.tier == "explorer"


def test_submit_assessment_fires_completed_event_when_all_answered():
    events = []

    def fake_insert_responses(session_id, answers):
        pass

    def fake_insert_event(session_id, event_name, props):
        events.append((session_id, event_name, props))

    from web_intake.assessment import QUESTIONS

    full_answers = {q.key: q.options[0].value for q in QUESTIONS}
    req = AssessmentSubmitRequest(session_id="sess-2", answers=full_answers)
    submit_assessment(req, insert_responses_fn=fake_insert_responses, insert_event_fn=fake_insert_event)

    assert events[0][1] == "assessment_completed"


def test_capture_lead_writes_expected_row_and_returns_lead_id():
    inserted_rows = []

    def fake_insert_lead(row):
        inserted_rows.append(row)
        return "lead-123"

    req = LeadCaptureRequest(
        session_id="sess-3",
        name="Test Investor",
        email="investor@example.com",
        consent_given=True,
        budget_band="10m_25m",
        attribution=Attribution(utm_source="linkedin"),
    )
    breakdown = score_assessment({"objective": "golden_visa", "budget_band": "10m_25m"})
    deps = CaptureDependencies(insert_lead_fn=fake_insert_lead)

    resp = capture_lead(req, deps, computed_score=breakdown.result)

    assert resp.lead_id == "lead-123"
    row = inserted_rows[0]
    assert row["consent_status"] == "opted_in"
    assert row["origin"] == "website"
    assert row["utm_source"] == "linkedin"
    assert row["score"] == breakdown.result.score
    assert row["score_tier"] == breakdown.result.tier


def test_capture_lead_refuses_without_explicit_consent():
    def fake_insert_lead(row):
        return "should-not-be-called"

    req = LeadCaptureRequest(
        session_id="sess-4", name="No Consent", email="noconsent@example.com", consent_given=False
    )
    deps = CaptureDependencies(insert_lead_fn=fake_insert_lead)

    with pytest.raises(ConsentNotGivenError):
        capture_lead(req, deps)


def test_capture_lead_rejects_invalid_email_before_touching_db():
    calls = []

    def fake_insert_lead(row):
        calls.append(row)
        return "unused"

    req = LeadCaptureRequest(
        session_id="sess-5", name="Bad Email", email="not-an-email", consent_given=True
    )
    deps = CaptureDependencies(insert_lead_fn=fake_insert_lead)

    with pytest.raises(SubmissionRejected):
        capture_lead(req, deps)
    assert calls == []  # never reached the DB call


def test_capture_lead_calls_backfill_and_notify_when_provided():
    backfilled = []
    notified = []

    deps = CaptureDependencies(
        insert_lead_fn=lambda row: "lead-999",
        backfill_session_fn=lambda session_id, lead_id: backfilled.append((session_id, lead_id)),
        notify_fn=lambda text: notified.append(text),
    )
    req = LeadCaptureRequest(
        session_id="sess-6", name="Notify Me", email="notify@example.com", consent_given=True
    )

    capture_lead(req, deps)

    assert backfilled == [("sess-6", "lead-999")]
    assert len(notified) == 1
    assert "Notify Me" in notified[0]


def test_capture_lead_priority_tier_routes_to_full_report():
    deps = CaptureDependencies(insert_lead_fn=lambda row: "lead-1")
    req = LeadCaptureRequest(session_id="s", name="A", email="a@example.com", consent_given=True)
    breakdown = score_assessment({"budget_band": "50m_plus", "timeline": "ready_now"})
    resp = capture_lead(req, deps, computed_score=breakdown.result)
    assert resp.next_step in ("view_full_report", "whatsapp_consultation")


def test_capture_lead_without_score_awaits_review():
    deps = CaptureDependencies(insert_lead_fn=lambda row: "lead-2")
    req = LeadCaptureRequest(session_id="s2", name="B", email="b@example.com", consent_given=True)
    resp = capture_lead(req, deps)
    assert resp.next_step == "await_review"
    assert resp.score is None
