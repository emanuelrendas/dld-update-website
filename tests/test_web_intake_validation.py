import pytest

from web_intake.contracts import LeadCaptureRequest
from web_intake.validation import (
    ConsentNotGivenError,
    assert_consent_given,
    validate_lead_capture,
)


def _valid_request(**overrides) -> LeadCaptureRequest:
    defaults = dict(session_id="sess-1", name="Jane Investor", email="jane@example.com", consent_given=True)
    defaults.update(overrides)
    return LeadCaptureRequest(**defaults)


def test_valid_request_has_no_problems():
    assert validate_lead_capture(_valid_request()) == []


def test_missing_name_is_a_problem():
    problems = validate_lead_capture(_valid_request(name=""))
    assert any("name" in p for p in problems)


def test_invalid_email_is_a_problem():
    problems = validate_lead_capture(_valid_request(email="not-an-email"))
    assert any("email" in p for p in problems)


def test_missing_session_id_is_a_problem():
    problems = validate_lead_capture(_valid_request(session_id=""))
    assert any("session_id" in p for p in problems)


def test_unrecognized_budget_band_is_a_problem():
    problems = validate_lead_capture(_valid_request(budget_band="a_million_bucks"))
    assert any("budget_band" in p for p in problems)


def test_none_budget_band_is_fine():
    assert validate_lead_capture(_valid_request(budget_band=None)) == []


def test_assert_consent_given_passes_when_true():
    assert_consent_given(_valid_request(consent_given=True))  # does not raise


def test_assert_consent_given_raises_when_false():
    with pytest.raises(ConsentNotGivenError):
        assert_consent_given(_valid_request(consent_given=False))


def test_assert_consent_given_has_no_bypass_for_falsy_values():
    # guards against a future refactor accidentally treating None/0/"" as "skip the check"
    for falsy in (False, None, 0, ""):
        req = _valid_request(consent_given=falsy)
        with pytest.raises(ConsentNotGivenError):
            assert_consent_given(req)
