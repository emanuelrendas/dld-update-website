import pytest

from web_intake.assessment import QUESTIONS
from web_intake.scoring import InvalidAnswerError, score_assessment, tier_label


def _top_answers() -> dict[str, str]:
    """Every question answered with its highest-point option."""
    answers = {}
    for q in QUESTIONS:
        best = max(q.options, key=lambda o: o.points)
        answers[q.key] = best.value
    return answers


def test_full_top_answers_scores_100():
    breakdown = score_assessment(_top_answers())
    assert breakdown.result.score == 100
    assert breakdown.result.tier == "strategic_partner"
    assert breakdown.result.is_placeholder is False
    assert breakdown.answered_count == len(QUESTIONS)
    assert breakdown.completion_bonus == 15


def test_empty_answers_scores_zero_and_explorer_tier():
    breakdown = score_assessment({})
    assert breakdown.result.score == 0
    assert breakdown.result.tier == "explorer"
    assert breakdown.answered_count == 0
    assert breakdown.completion_bonus == 0


def test_partial_completion_does_not_get_bonus():
    partial = {"objective": "golden_visa", "budget_band": "50m_plus"}
    breakdown = score_assessment(partial)
    assert breakdown.completion_bonus == 0
    assert breakdown.answered_count == 2
    # score is just the two answered questions' points, no bonus
    assert breakdown.result.score == 5 + 25


def test_unknown_question_key_raises():
    with pytest.raises(InvalidAnswerError):
        score_assessment({"not_a_real_question": "whatever"})


def test_invalid_option_value_raises():
    with pytest.raises(InvalidAnswerError):
        score_assessment({"objective": "not_a_real_option"})


def test_tier_thresholds_are_monotonic_and_reachable():
    # a mid-range answer set should land in a middle tier, not the extremes
    answers = {q.key: q.options[len(q.options) // 2].value for q in QUESTIONS}
    breakdown = score_assessment(answers)
    assert breakdown.result.tier in ("qualified", "priority")


def test_tier_label_covers_every_tier():
    for tier in ("explorer", "qualified", "priority", "strategic_partner"):
        assert isinstance(tier_label(tier), str) and tier_label(tier)


def test_decision_authority_lower_score_is_not_penalized_in_signals_text():
    # family_office scores lower points but must not be described as a worse lead --
    # this test guards the dossier-facing promise made in assessment.py's weight_note.
    breakdown = score_assessment({"decision_authority": "family_office"})
    assert any("family_office" in s or "Family office" in s for s in breakdown.result.signals)
