from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class AnswerValidator(ABC):
    """Protocol for validating answers based on question type."""

    @abstractmethod
    def is_correct(self, correct_data: Any, selected: Any) -> bool:
        """Return True if the answer is correct."""
        ...


class MCQValidator(AnswerValidator):
    """Validates MCQ answers: all correct choices must be selected, no extras."""

    def is_correct(self, correct_data: list[int], selected: list[int]) -> bool:
        if not isinstance(correct_data, list) or not isinstance(selected, list):
            return False
        return set(selected) == set(correct_data)


# Registry for future question types
VALIDATORS: dict[str, AnswerValidator] = {
    "MCQ": MCQValidator(),
}


def get_validator(question_type: str) -> AnswerValidator:
    validator = VALIDATORS.get(question_type)
    if validator is None:
        raise ValueError(f"Unknown question type: {question_type}")
    return validator
