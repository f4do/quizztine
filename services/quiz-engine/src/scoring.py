from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from src.answer_validator import get_validator
from src.schemas import Difficulty


@dataclass
class ScoreResult:
    total: int
    bonus: int
    new_streak: int

BASE_POINTS: dict[str, int] = {
    Difficulty.easy: 10,
    Difficulty.medium: 15,
    Difficulty.hard: 20,
}

STREAK_BONUS_PER_STEP = 1
MAX_STREAK_BONUS = 10


class ScoringContext:
    def __init__(
        self,
        *,
        mode: str,
        player_count: int,
        difficulty: str,
        is_correct: bool,
        current_streak: int,
        first_correct: bool,
        alone_correct: bool,
    ) -> None:
        self.mode = mode
        self.player_count = player_count
        self.difficulty = difficulty
        self.is_correct = is_correct
        self.current_streak = current_streak
        self.first_correct = first_correct
        self.alone_correct = alone_correct


class BonusCalculator(Protocol):
    def calculate(self, ctx: ScoringContext) -> int: ...


class NoopBonus:
    def calculate(self, ctx: ScoringContext) -> int:
        return 0


class MultiBonus:
    def calculate(self, ctx: ScoringContext) -> int:
        if ctx.player_count < 3:
            return 0
        bonus = 0
        if ctx.first_correct:
            bonus += 5
        if ctx.alone_correct:
            bonus += 3
        return bonus


class SoloBonus:
    def calculate(self, ctx: ScoringContext) -> int:
        if ctx.mode != "solo":
            return 0
        return 0


class StreakCalculator(Protocol):
    def calculate(self, ctx: ScoringContext) -> int: ...


class StreakBonus:
    def calculate(self, ctx: ScoringContext) -> int:
        if not ctx.is_correct:
            return 0
        bonus = ctx.current_streak * STREAK_BONUS_PER_STEP
        return min(bonus, MAX_STREAK_BONUS)


class ScoreCalculator:
    def __init__(
        self,
        bonus: BonusCalculator | None = None,
        streak: StreakCalculator | None = None,
    ) -> None:
        self._bonus = bonus or MultiBonus()
        self._streak = streak or StreakBonus()

    def calculate(self, ctx: ScoringContext) -> ScoreResult:
        if not ctx.is_correct:
            return ScoreResult(total=0, bonus=0, new_streak=0)

        base = BASE_POINTS.get(ctx.difficulty, 15)
        bonus = self._bonus.calculate(ctx)
        streak = self._streak.calculate(ctx) if ctx.mode == "solo" else 0
        new_streak = ctx.current_streak + 1
        return ScoreResult(total=base + bonus + streak, bonus=bonus, new_streak=new_streak)


def is_answer_correct(
    correct_choices: list[int],
    selected_choices: list[int],
    question_type: str = "MCQ",
) -> bool:
    validator = get_validator(question_type)
    return validator.is_correct(correct_choices, selected_choices)
