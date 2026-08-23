from mission1.enrichment import enrich_lead
from mission1.validation import Lead


def make_lead(**overrides) -> Lead:
    base = dict(
        id="lead-1", name="Ana Garcia", email="ana@example.com",
        mobile="34600000000", address="Madrid, Spain",
        consent_status="opted_in", status="new",
    )
    base.update(overrides)
    return Lead(**base)


def test_enrichment_is_always_flagged_as_placeholder():
    result = enrich_lead(make_lead())
    assert result.is_placeholder is True


def test_enrichment_score_never_claims_high_confidence():
    result = enrich_lead(make_lead())
    assert result.tier in ("low", "medium")  # never "high" -- v0 has no real intelligence
    assert result.score <= 70


def test_missing_mobile_and_address_lowers_score():
    full = enrich_lead(make_lead(mobile="34600000000", address="Madrid, Spain"))
    minimal = enrich_lead(make_lead(mobile=None, address=None))
    assert minimal.score < full.score


def test_signals_are_honest_about_missing_data():
    result = enrich_lead(make_lead(mobile=None))
    assert any("no mobile" in s for s in result.signals)
