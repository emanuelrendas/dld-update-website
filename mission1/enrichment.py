"""
Lead enrichment and scoring -- PLACEHOLDER IMPLEMENTATION, v0.

Ownership note (read this before touching this file): per the RAIOC Operating
Directive, enrichment and scoring are Gemini's domain as Chief Intelligence Officer.
This module exists because Mission 1's Definition of Done requires an enriched,
scored lead to move through the pipeline, and blocking the entire pipeline on
Gemini's output schema being finalized would leave a "complete" system that can't
actually run end to end.

So: this is a deliberately simple, rule-based stand-in, not real intelligence. It
scores on data completeness only -- nothing about the lead's actual wealth, company,
or investment fit, because we don't have that data without Gemini's enrichment.

Replacing this: implement `enrich_lead` with a real call to whatever Gemini produces
(ideally a Supabase table Gemini's pipeline writes to, which this function reads from
instead of computing rules locally) and keep the same return shape so
mission1/pipeline.py and mission1/dossier.py don't need to change.

This tradeoff is logged in the Notion Decision Log (2026-08-19) as something Claude
decided unilaterally to unblock Mission 1's Definition of Done -- flagged for
Emanuel to confirm or override.
"""
from dataclasses import dataclass

from mission1.validation import Lead


@dataclass
class EnrichmentResult:
    score: int  # 0-100, completeness-based only in v0 -- NOT a wealth/fit score
    tier: str  # "low" | "medium" | "high" -- data-completeness tier, not investor tier
    signals: list[str]  # what we actually know, plainly stated
    is_placeholder: bool = True  # always True until Gemini's real enrichment lands


def enrich_lead(lead: Lead) -> EnrichmentResult:
    """
    v0 rule-based placeholder. Scores 0-100 based purely on which fields are present
    -- this is a data-quality score, not an investor-quality score. Do not present
    this to a lead or in a dossier as if it reflects their actual net worth or
    investment potential; it doesn't, and claiming it does would be dishonest.
    """
    signals = []
    score = 20  # base: we at least have a valid name+email to have reached this point

    if lead.mobile:
        score += 25
        signals.append("mobile number on file")
    else:
        signals.append("no mobile number on file")

    if lead.address:
        score += 25
        signals.append(f"location known: {lead.address}")
    else:
        signals.append("no location on file")

    # Placeholder company/role signal -- real version comes from Gemini's enrichment.
    signals.append("company/role/net-worth data: not yet available (pending Gemini enrichment)")

    score = min(score, 70)  # cap below "high" -- v0 can never claim high confidence,
    # by design, since it has no real intelligence behind it.

    tier = "low" if score < 40 else "medium"
    return EnrichmentResult(score=score, tier=tier, signals=signals, is_placeholder=True)
