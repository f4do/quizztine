from __future__ import annotations

import pytest

from src.scoring import ScoreCalculator, ScoreResult, ScoringContext, is_answer_correct


@pytest.fixture
def calc():
    return ScoreCalculator()


class TestIsAnswerCorrect:
    def test_exact_match(self):
        assert is_answer_correct([0, 2], [0, 2]) is True

    def test_wrong_order(self):
        assert is_answer_correct([0, 2], [2, 0]) is True

    def test_partial(self):
        assert is_answer_correct([0, 2], [0]) is False

    def test_extra(self):
        assert is_answer_correct([0, 2], [0, 2, 3]) is False

    def test_empty(self):
        assert is_answer_correct([0, 2], []) is False

    def test_single_correct(self):
        assert is_answer_correct([1], [1]) is True


class TestScoringWrongAnswer:
    def test_wrong_gets_zero(self, calc):
        ctx = ScoringContext(
            mode="solo",
            player_count=1,
            difficulty="easy",
            is_correct=False,
            current_streak=3,
            first_correct=False,
            alone_correct=False,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == 0
        assert bonus == 0
        assert streak == 0  # reset on wrong answer


class TestScoringBasePoints:
    @pytest.mark.parametrize(
        "difficulty,expected_base", [("easy", 10), ("medium", 15), ("hard", 20)]
    )
    def test_solo_no_streak(self, calc, difficulty, expected_base):
        ctx = ScoringContext(
            mode="solo",
            player_count=1,
            difficulty=difficulty,
            is_correct=True,
            current_streak=0,
            first_correct=False,
            alone_correct=False,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == expected_base  # no streak bonus at streak=0
        assert bonus == 0
        assert streak == 1

    def test_solo_with_streak(self, calc):
        ctx = ScoringContext(
            mode="solo",
            player_count=1,
            difficulty="medium",
            is_correct=True,
            current_streak=5,
            first_correct=False,
            alone_correct=False,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == 15 + 5  # medium base + streak bonus (5 * 1)
        assert bonus == 0
        assert streak == 6


class TestScoringMulti2:
    def test_no_bonus_for_two_players(self, calc):
        ctx = ScoringContext(
            mode="multi_public",
            player_count=2,
            difficulty="hard",
            is_correct=True,
            current_streak=0,
            first_correct=True,
            alone_correct=True,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == 20  # hard base only, no bonuses for 2 players
        assert bonus == 0


class TestScoringMulti3:
    def test_first_correct_bonus(self, calc):
        ctx = ScoringContext(
            mode="multi_public",
            player_count=3,
            difficulty="easy",
            is_correct=True,
            current_streak=0,
            first_correct=True,
            alone_correct=False,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == 10 + 5  # base + first correct
        assert bonus == 5

    def test_alone_correct_bonus(self, calc):
        ctx = ScoringContext(
            mode="multi_public",
            player_count=3,
            difficulty="easy",
            is_correct=True,
            current_streak=0,
            first_correct=True,
            alone_correct=True,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == 10 + 5 + 3  # base + first + alone
        assert bonus == 8

    def test_correct_but_not_first(self, calc):
        ctx = ScoringContext(
            mode="multi_public",
            player_count=3,
            difficulty="easy",
            is_correct=True,
            current_streak=0,
            first_correct=False,
            alone_correct=False,
        )
        result = calc.calculate(ctx)
        total, bonus, streak = result.total, result.bonus, result.new_streak
        assert total == 10  # base only
        assert bonus == 0
