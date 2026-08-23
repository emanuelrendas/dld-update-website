from mission1.dossier import (
    build_dossier,
    format_executive_brief_markdown,
    format_executive_digest,
)
from mission1.enrichment import enrich_lead
from mission1.validation import Lead


def make_lead(**overrides) -> Lead:
    base = dict(
        id="lead-1",
        name="Ana Garcia",
        email="ana@example.com",
        mobile="34600000000",
        address="Madrid, Spain",
        consent_status="opted_in",
        status="new",
    )
    base.update(overrides)
    return Lead(**base)


def test_dossier_flags_placeholder_confidence_in_summary():
    lead = make_lead()
    dossier = build_dossier(lead, enrich_lead(lead))
    assert "placeholder" in dossier.summary.lower()


def test_dossier_flags_missing_phone_as_open_question():
    lead = make_lead(mobile=None)
    dossier = build_dossier(lead, enrich_lead(lead))
    assert any("phone" in q.lower() for q in dossier.open_questions)


def test_dossier_headline_includes_name():
    lead = make_lead(name="Jose Perez")
    dossier = build_dossier(lead, enrich_lead(lead))
    assert "Jose Perez" in dossier.headline


def test_format_executive_brief_markdown():
    lead = make_lead(name="Carlos Silva", address="Lisbon, Portugal")
    dossier = build_dossier(lead, enrich_lead(lead))
    md = format_executive_brief_markdown(dossier)
    assert "### Executive Brief: Carlos Silva" in md
    assert "Recommended Strategy:" in md


def test_format_executive_digest():
    d1 = build_dossier(make_lead(name="Investor A"), enrich_lead(make_lead()))
    d2 = build_dossier(make_lead(name="Investor B"), enrich_lead(make_lead()))
    digest = format_executive_digest([d1, d2])
    assert "Investor A" in digest
    assert "Investor B" in digest
