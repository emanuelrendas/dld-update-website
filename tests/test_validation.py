import pytest

from mission1.validation import Lead, ConsentError, assert_consent, is_valid_email, validate_lead


def make_lead(**overrides) -> Lead:
    base = dict(
        id="test-id", name="Ana Garcia", email="ana@example.com",
        mobile="34600000000", address="Madrid, Spain",
        consent_status="opted_in", status="new",
    )
    base.update(overrides)
    return Lead(**base)


def test_valid_email_accepts_normal_address():
    assert is_valid_email("someone@example.com") is True


def test_valid_email_rejects_missing_at():
    assert is_valid_email("someone.example.com") is False


def test_valid_email_rejects_empty():
    assert is_valid_email("") is False


def test_assert_consent_passes_for_opted_in():
    assert_consent(make_lead(consent_status="opted_in"))  # should not raise


def test_assert_consent_blocks_unknown():
    with pytest.raises(ConsentError):
        assert_consent(make_lead(consent_status="unknown"))


def test_assert_consent_blocks_no_consent():
    with pytest.raises(ConsentError):
        assert_consent(make_lead(consent_status="no_consent"))


def test_assert_consent_blocks_empty_string():
    with pytest.raises(ConsentError):
        assert_consent(make_lead(consent_status=""))


def test_validate_lead_flags_missing_name():
    problems = validate_lead(make_lead(name=""))
    assert any("name" in p for p in problems)


def test_validate_lead_flags_bad_email():
    problems = validate_lead(make_lead(email="not-an-email"))
    assert any("email" in p for p in problems)


def test_validate_lead_clean_record_has_no_problems():
    assert validate_lead(make_lead()) == []
