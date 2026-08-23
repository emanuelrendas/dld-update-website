"""
Scoring for website-originated leads.

Unlike mission1/enrichment.py's placeholder (which scores CSV-sourced leads purely
on data completeness because that's all we have), this module scores leads who
completed the Dubai Investor Readiness Assessment -- real, investor-supplied signal
about objective, budget, timeline, and intent.

This deliberately reuses mission1.enrichment.EnrichmentResult as its return type
rather than inventing a parallel shape. That's the point: it partially resolves
ADR-0002's technical debt for the website channel specifically. CSV-sourced leads
still get the honest data-completeness placeholder (is_placeholder=True) until
Gemini's real enrichment lands; website leads get is_placeholder=False today,
because a completed assessment genuinely is real signal, not a stand-in for it.
See ADR-0006.
"""
from dataclasses import dataclass

from mission1.enrichment import EnrichmentResult
from web_intake.assessment import COMPLETION_BONUS_FULL, QUESTIONS

TIER_THRESHOLDS = (
    # (minimum score inclusive, tier)  -- ordered highest to lowest, first match wins
    (85, "strategic_partner"),
    (65, "priority"),
    (40, "qualified"),
    (0, "explorer"),
)


@dataclass
class AssessmentScoreBreakdown:
    result: EnrichmentResult
    per_question_points: dict[str, int]
    completion_bonus: int
    answered_count: int
    total_questions: int


class InvalidAnswerError(ValueError):
    """Raised when an answer references a question key or option value that doesn't exist.

    Deliberately strict: a typo'd question key silently scoring as zero would hide a
    frontend/backend contract bug behind a plausible-looking low score. Fail loud.
    """


def score_assessment(answers: dict[str, str]) -> AssessmentScoreBreakdown:
    """
    answers: {question_key: option_value}. Missing keys are treated as unanswered
    (contributes 0 points, and disqualifies the completion bonus) -- they are NOT
    an error, since a visitor may legitimately abandon partway through.

    Raises InvalidAnswerError if a provided key or value doesn't match the current
    question set -- that's always a bug (frontend/backend contract drift), never a
    legitimate user state.
    """
    per_question_points: dict[str, int] = {}
    signals: list[str] = []
    answered_count = 0

    for question in QUESTIONS:
        raw_value = answers.get(question.key)
        if raw_value is None:
            per_question_points[question.key] = 0
            continue

        matching_option = next((o for o in question.options if o.value == raw_value), None)
        if matching_option is None:
            raise InvalidAnswerError(
                f"'{raw_value}' is not a valid option for question '{question.key}'"
            )

        per_question_points[question.key] = matching_option.points
        answered_count += 1
        signals.append(f"{question.key}: {matching_option.label}")

    unknown_keys = set(answers) - {q.key for q in QUESTIONS}
    if unknown_keys:
        raise InvalidAnswerError(f"Unknown question key(s): {sorted(unknown_keys)}")

    total_questions = len(QUESTIONS)
    completed_fully = answered_count == total_questions
    completion_bonus = COMPLETION_BONUS_FULL if completed_fully else 0

    total_score = sum(per_question_points.values()) + completion_bonus
    tier = next(t for minimum, t in TIER_THRESHOLDS if total_score >= minimum)

    if not completed_fully:
        signals.append(
            f"assessment partially completed ({answered_count}/{total_questions} questions) "
            "-- completion bonus not awarded"
        )

    result = EnrichmentResult(score=total_score, tier=tier, signals=signals, is_placeholder=False)
    return AssessmentScoreBreakdown(
        result=result,
        per_question_points=per_question_points,
        completion_bonus=completion_bonus,
        answered_count=answered_count,
        total_questions=total_questions,
    )


def tier_label(tier: str) -> str:
    """Investor-facing label -- never expose the raw tier slug ('priority') to a lead."""
    return {
        "explorer": "Explorer",
        "qualified": "Qualified Investor",
        "priority": "Priority Mandate Candidate",
        "strategic_partner": "Strategic Partner Profile",
    }[tier]
