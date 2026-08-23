"""
Validation for inbound website submissions.
"""
from mission1.validation import is_valid_email
from web_intake.contracts import LeadCaptureRequest


class ConsentNotGivenError(RuntimeError):
    """Raised when a lead capture request arrives without explicit, affirmative consent."""


VALID_BUDGET_BANDS = {
    "2m_5m", "5m_10m", "10m_25m", "25m_50m", "50m_plus",
    "under_2m", "2m_15m", "15m_50m", "prefer_to_discuss"
}


def normalize_budget_band(band: str | None) -> str | None:
    if not band:
        return None
    b = band.lower().strip().replace("—", "-").replace("–", "-")
    if "under" in b or "< 2" in b:
        return "2m_5m"
    if "2" in b and "5" in b and "15" not in b and "25" not in b:
        return "2m_5m"
    if "5" in b and "10" in b:
        return "5m_10m"
    if "10" in b and "25" in b:
        return "10m_25m"
    if "25" in b and "50" in b:
        return "25m_50m"
    if "50" in b:
        return "50m_plus"
    if "prefer" in b or "discuss" in b:
        return "prefer_to_discuss"
    if b in VALID_BUDGET_BANDS:
        return b
    return band


def validate_lead_capture(request: LeadCaptureRequest) -> list[str]:
    problems: list[str] = []

    if not request.name or not request.name.strip():
        problems.append("missing name")

    if not is_valid_email(request.email):
        problems.append(f"invalid email format: {request.email!r}")

    if not request.session_id or not request.session_id.strip():
        problems.append("missing session_id -- cannot correlate to prior assessment/events")

    if request.budget_band is not None:
        normalized = normalize_budget_band(request.budget_band)
        if normalized not in VALID_BUDGET_BANDS and request.budget_band not in VALID_BUDGET_BANDS:
            problems.append(f"unrecognized budget_band: {request.budget_band!r}")

    return problems


def assert_consent_given(request: LeadCaptureRequest) -> None:
    if request.consent_given is not True:
        raise ConsentNotGivenError(
            f"Refusing to insert lead for session {request.session_id}: "
            "consent_given was not explicitly True."
        )
