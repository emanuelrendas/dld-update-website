"""
The Dubai Investor Readiness Assessment -- question set and scoring weights.

This is the flagship lead magnet approved 2026-08-19 ("Architecture Decision
Approved"): a 10-question, sub-5-minute interactive assessment that replaces
"give us your email for a PDF" with something an investor actually wants to
finish -- a personalized readiness score and tier.

Design grounded in 2026 conversion research (see docs/LEAD_CAPTURE_ARCHITECTURE.md
Appendix for sources), not guessed:
- Keep it under 5 minutes / ~10 questions for a cold-traffic funnel (higher question
  counts belong to warmer, higher-trust funnels than a first-touch website visitor).
- Show partial signal early ("your profile is shaping up as...") before any gate --
  gate at the moment of highest perceived value (after they've invested time and
  seen a preview), not before.
- Ask only name + email at the gate. Everything else (phone, mandate description)
  is progressive profiling, collected later in the existing Private Investment Brief
  form once trust is established -- do not ask for it twice.

Rubric totals exactly 100: 85 points spread across the ten questions (weighted by
how strongly each one actually predicts mandate viability, not evenly), plus a
15-point completion bonus (see COMPLETION_BONUS_FULL below).

Question order is deliberate: objective and budget first (cheap, non-threatening,
and among the highest-weight scoring signals), obstacle/blocker last (the most
personal question, asked once the visitor is already invested in finishing).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class AssessmentOption:
    value: str
    label: str
    points: int


@dataclass(frozen=True)
class AssessmentQuestion:
    key: str
    prompt: str
    kind: str  # "single_select" | "slider"
    options: tuple[AssessmentOption, ...]
    weight_note: str


QUESTIONS: tuple[AssessmentQuestion, ...] = (
    AssessmentQuestion(
        key="objective",
        prompt="What's the primary goal for this investment?",
        kind="single_select",
        options=(
            AssessmentOption("capital_preservation", "Capital preservation", 3),
            AssessmentOption("rental_income", "Rental income allocation", 3),
            AssessmentOption("capital_appreciation", "Capital appreciation", 3),
            AssessmentOption("portfolio_construction", "Portfolio diversification", 3),
            AssessmentOption("golden_visa", "Residency via investment (Golden Visa)", 5),
        ),
        weight_note="Max 5. All real objectives score similarly; residency intent "
        "scores highest because it signals a harder deadline (visa timelines).",
    ),
    AssessmentQuestion(
        key="budget_band",
        prompt="What's the investable capital range for this mandate?",
        kind="single_select",
        options=(
            AssessmentOption("2m_5m", "AED 2M - 5M", 8),
            AssessmentOption("5m_10m", "AED 5M - 10M", 15),
            AssessmentOption("10m_25m", "AED 10M - 25M", 20),
            AssessmentOption("25m_50m", "AED 25M - 50M", 23),
            AssessmentOption("50m_plus", "AED 50M+", 25),
        ),
        weight_note="Max 25 -- the single highest weight in the rubric. Budget is "
        "the strongest real predictor of mandate viability.",
    ),
    AssessmentQuestion(
        key="timeline",
        prompt="How soon are you looking to deploy capital?",
        kind="single_select",
        options=(
            AssessmentOption("ready_now", "Ready now", 18),
            AssessmentOption("1_3_months", "1-3 months", 14),
            AssessmentOption("3_6_months", "3-6 months", 9),
            AssessmentOption("6_12_months", "6-12 months", 4),
            AssessmentOption("exploring", "Exploring only, no timeline yet", 1),
        ),
        weight_note="Max 18 -- second-highest weight. Timeline is the strongest "
        "predictor of near-term conversion, independent of budget.",
    ),
    AssessmentQuestion(
        key="decision_authority",
        prompt="Who makes the final call on this investment?",
        kind="single_select",
        options=(
            AssessmentOption("sole", "I decide alone", 12),
            AssessmentOption("joint", "Joint decision with spouse/partner", 8),
            AssessmentOption("family_office", "Family office / board approval required", 6),
        ),
        weight_note="Max 12. Lower points for longer decision chains reflects cycle "
        "length, not lead quality -- a family-office mandate can be the highest-value "
        "lead on the list even with a lower raw score. Surface this distinction in "
        "the dossier, never just the number.",
    ),
    AssessmentQuestion(
        key="portfolio_experience",
        prompt="Which best describes your current real estate portfolio?",
        kind="single_select",
        options=(
            AssessmentOption("first_international", "This would be my first international property", 2),
            AssessmentOption("some_experience", "I own 1-2 properties outside my home country", 4),
            AssessmentOption("established", "I have an established multi-market portfolio", 7),
        ),
        weight_note="Max 7. Experience correlates with faster decisions, but "
        "first-time buyers are not penalized heavily -- they're a different advisory "
        "motion (more education), not a weaker one.",
    ),
    AssessmentQuestion(
        key="residency_status",
        prompt="What's your residency situation relative to the UAE?",
        kind="single_select",
        options=(
            AssessmentOption("uae_resident", "Already a UAE resident", 4),
            AssessmentOption("golden_visa_holder", "Already hold a Golden Visa", 5),
            AssessmentOption("exploring_residency", "Actively exploring residency via investment", 8),
            AssessmentOption("not_seeking", "Not seeking UAE residency", 2),
        ),
        weight_note="Max 8. 'Actively exploring residency' scores highest -- the "
        "strongest intent signal in this question, often paired with a hard "
        "visa-driven deadline.",
    ),
    AssessmentQuestion(
        key="risk_tolerance",
        prompt="Where do you sit between capital preservation and growth?",
        kind="slider",
        options=(
            AssessmentOption("1", "Strongly preservation-focused", 1),
            AssessmentOption("2", "Preservation-leaning", 1),
            AssessmentOption("3", "Balanced", 2),
            AssessmentOption("4", "Growth-leaning", 1),
            AssessmentOption("5", "Strongly growth-focused", 1),
        ),
        weight_note="Max 2 -- deliberately low weight. This is a fit/segmentation "
        "signal for which mandate type to recommend, not a quality signal.",
    ),
    AssessmentQuestion(
        key="market_familiarity",
        prompt="How familiar are you with the Dubai market today?",
        kind="single_select",
        options=(
            AssessmentOption("new", "New to Dubai entirely", 1),
            AssessmentOption("researched", "I've visited or researched it", 2),
            AssessmentOption("own_property", "I already own property here", 3),
            AssessmentOption("deep", "Deep familiarity, multiple visits/transactions", 4),
        ),
        weight_note="Max 4. Familiarity speeds the advisory cycle but low "
        "familiarity is an education opportunity, not a disqualifier.",
    ),
    AssessmentQuestion(
        key="engagement_style",
        prompt="How do you prefer to work with an advisor?",
        kind="single_select",
        options=(
            AssessmentOption("data_driven", "Data-driven analysis, I'll decide", 1),
            AssessmentOption("curated_shortlist", "A curated shortlist of options", 1),
            AssessmentOption("full_service", "Full-service, managed mandate", 2),
        ),
        weight_note="Max 2. Preference signal for how Emanuel should engage, not a "
        "quality signal -- kept low-weight on purpose.",
    ),
    AssessmentQuestion(
        key="biggest_obstacle",
        prompt="What's the biggest thing holding you back today?",
        kind="single_select",
        options=(
            AssessmentOption("trust_verification", "Trusting the right advisor from abroad", 1),
            AssessmentOption("market_timing", "Uncertainty about market timing", 1),
            AssessmentOption("legal_tax", "Legal/tax/residency complexity", 1),
            AssessmentOption("finding_property", "Finding the right property", 1),
            AssessmentOption("ready_to_proceed", "Nothing -- I'm ready to proceed", 2),
        ),
        weight_note="Max 2. Asked last, deliberately -- it's the most personal "
        "question and works best once the visitor is already invested in finishing. "
        "The answer itself is gold for the first outreach message regardless of "
        "point value.",
    ),
)

# Completion is itself a signal: a visitor who answers all 10 questions has invested
# real time and self-selected as a serious prospect, independent of their answers.
COMPLETION_BONUS_FULL = 15  # awarded only when every question is answered.
# Partial completions get zero bonus, not a fraction -- a half-finished assessment is
# a different, weaker signal than a completed one, and should not be scored as if it
# were proportionally as good.

MAX_POSSIBLE_SCORE = sum(max(o.points for o in q.options) for q in QUESTIONS) + COMPLETION_BONUS_FULL
assert MAX_POSSIBLE_SCORE == 100, f"Rubric must sum to 100, got {MAX_POSSIBLE_SCORE}"


def question_by_key(key: str) -> AssessmentQuestion | None:
    for q in QUESTIONS:
        if q.key == key:
            return q
    return None
