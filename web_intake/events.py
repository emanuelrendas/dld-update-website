"""
Event taxonomy for funnel/analytics tracking (lead_events table).

A fixed, closed vocabulary on purpose -- an open-ended event_name field turns into
inconsistent naming within a month (e.g. "form_submit" vs "formSubmitted" vs
"FORM_SUBMITTED") and breaks every dashboard query built on top of it. Adding a new
event type is a one-line change here plus a migration comment update, not a free-text
field anywhere in the frontend.
"""

# Anonymous, pre-identification events (session_id only, lead_id null).
PAGE_VIEW = "page_view"
CALCULATOR_USED = "calculator_used"  # event_props: {"calculator": "quick_yield" | "investment_lab" | "golden_visa" | "currency"}
ASSESSMENT_STARTED = "assessment_started"
ASSESSMENT_QUESTION_ANSWERED = "assessment_question_answered"  # event_props: {"question_key": ..., "answer_value": ...}
ASSESSMENT_ABANDONED = "assessment_abandoned"  # event_props: {"last_question_key": ...}
ASSESSMENT_COMPLETED = "assessment_completed"
LEAD_MAGNET_GATED_VIEW = "lead_magnet_gated_view"  # the teaser/gate screen was shown

# Identification event -- this is the moment session_id gets a lead_id.
LEAD_CAPTURED = "lead_captured"  # event_props: {"source": "assessment_gate" | "private_brief_form"}

# Post-identification events (lead_id set).
FULL_REPORT_VIEWED = "full_report_viewed"
WHATSAPP_CLICKED = "whatsapp_clicked"
CONSULTATION_REQUESTED = "consultation_requested"

ALL_EVENTS = frozenset(
    {
        PAGE_VIEW,
        CALCULATOR_USED,
        ASSESSMENT_STARTED,
        ASSESSMENT_QUESTION_ANSWERED,
        ASSESSMENT_ABANDONED,
        ASSESSMENT_COMPLETED,
        LEAD_MAGNET_GATED_VIEW,
        LEAD_CAPTURED,
        FULL_REPORT_VIEWED,
        WHATSAPP_CLICKED,
        CONSULTATION_REQUESTED,
    }
)


class UnknownEventError(ValueError):
    """Raised when an event_name isn't in the closed vocabulary above."""


def validate_event_name(event_name: str) -> None:
    if event_name not in ALL_EVENTS:
        raise UnknownEventError(
            f"'{event_name}' is not a recognized event. Add it to web_intake/events.py "
            "and the lead_events table comment before using it -- don't send ad hoc "
            "event names, they silently fragment every funnel report."
        )
