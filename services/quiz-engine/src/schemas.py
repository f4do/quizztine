from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class RoomMode(StrEnum):
    solo = "solo"
    multi_private = "multi_private"
    multi_public = "multi_public"


class Difficulty(StrEnum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuestionType(StrEnum):
    MCQ = "MCQ"


class QuestionPayload(BaseModel):
    id: int
    correct_choices: list[int] = Field(min_length=0)
    difficulty: Difficulty = Difficulty.medium
    question_type: QuestionType = QuestionType.MCQ


class CreateRoomRequest(BaseModel):
    questions: list[QuestionPayload] = Field(min_length=1)
    mode: RoomMode
    timer: int = Field(default=30, ge=5, le=300)
    id: str | None = None
    code: str | None = None
    creator_player_id: str | None = None


class CreateRoomResponse(BaseModel):
    id: str
    mode: RoomMode
    timer: int
    question_count: int


class JoinRequest(BaseModel):
    player_id: str
    nickname: str = Field(min_length=1, max_length=50)


class JoinResponse(BaseModel):
    room_id: str
    player_id: str
    nickname: str


class CurrentQuestionResponse(BaseModel):
    question_id: int
    index: int


class AnswerRequest(BaseModel):
    model_config = {"populate_by_name": True}

    question_id: int = Field(alias="questionId")
    selected_choices: list[int] = Field(default_factory=list, alias="selectedChoices")
    client_timestamp: float = Field(alias="clientTimestamp")


class AnswerResponse(BaseModel):
    correct: bool
    points: int
    bonus: int
    streak: int
    cumulative_time: float


class ScoreboardEntry(BaseModel):
    player_id: str
    nickname: str
    score: int
    streak: int
    cumulative_time: float


class ResultsCallback(BaseModel):
    scores: list[ScoreboardEntry]
    answers: list[PlayerAnswer]


class PlayerAnswer(BaseModel):
    player_id: str
    question_id: int
    correct: bool
    time_spent: float


class ReplayRequest(BaseModel):
    questions: list[QuestionPayload] | None = None


class GameStatus(BaseModel):
    status: Literal["waiting", "playing", "finished"]
    players: int
    question_count: int
