"""
Executive Brief & Dossier Generator for RAIOC.

A dossier is the internal one-page executive brief of an investor, used by Emanuel
to personalize advisory discussions and prioritize mandates.
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any

from mission1.enrichment import EnrichmentResult
from mission1.validation import Lead


@dataclass
class Dossier:
    lead_id: str
    headline: str
    summary: str
    data_confidence: str
    signals: list[str] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    recommended_angle: str = "Private Consultation"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_dossier(lead: Lead, enrichment: EnrichmentResult) -> Dossier:
    loc_display = lead.address or "Location Unspecified"
    headline = f"{lead.name} — {loc_display}"

    known_signals = list(enrichment.signals)
    confidence_note = (
        "Placeholder data-completeness scoring — treat as an exploratory conversation."
        if enrichment.is_placeholder
        else "Intelligence enriched via verified assessment / market data."
    )

    summary = f"Investor {lead.name} ({lead.email}) from {loc_display}. {confidence_note}"

    open_questions = []
    if not lead.mobile:
        open_questions.append("No phone number on file — confirm reachability before WhatsApp/call outreach.")
    if enrichment.is_placeholder:
        open_questions.append("Wealth indicators and property portfolio pending intelligence enrichment.")

    if enrichment.tier in ("strategic_partner", "priority", "high"):
        recommended_angle = "Immediate Direct Advisory / Partner Mandate Consultation"
    elif enrichment.tier in ("qualified", "medium"):
        recommended_angle = "Tailored Yield / Golden Visa Brief Presentation"
    else:
        recommended_angle = "Educational Market Brief & Nurture"

    return Dossier(
        lead_id=lead.id,
        headline=headline,
        summary=summary,
        data_confidence=enrichment.tier,
        signals=known_signals,
        open_questions=open_questions,
        recommended_angle=recommended_angle,
    )


def format_executive_brief_markdown(dossier: Dossier) -> str:
    """Formats a single investor dossier as Markdown for executive review."""
    lines = [
        f"### Executive Brief: {dossier.headline}",
        f"**Profile Tier:** {dossier.data_confidence.upper()}",
        f"**Recommended Strategy:** {dossier.recommended_angle}",
        f"**Summary:** {dossier.summary}",
    ]
    if dossier.signals:
        lines.append("**Known Signals:**")
        for s in dossier.signals:
            lines.append(f"- {s}")
    if dossier.open_questions:
        lines.append("**Discovery Questions for Call:**")
        for q in dossier.open_questions:
            lines.append(f"- {q}")
    return "\n".join(lines)


def format_executive_digest(dossiers: list[Dossier]) -> str:
    """Formats multiple dossiers into an executive daily briefing."""
    if not dossiers:
        return "No new investor dossiers generated for this cycle."
    return "\n\n---\n\n".join(format_executive_brief_markdown(d) for d in dossiers)
