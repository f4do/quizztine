from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.schemas import QuestionPayload

from src.schemas import RoomMode


class GameStatus(StrEnum):
    waiting = "waiting"
    playing = "playing"
    finished = "finished"


@dataclass
class Player:
    player_id: str
    nickname: str
    score: int = 0
    streak: int = 0
    cumulative_time: float = 0.0
    current_question_index: int = 0
    finished: bool = False
    question_started_at: float = 0.0
    disconnected: bool = False


@dataclass
class AnswerRecord:
    player_id: str
    question_id: int
    correct: bool
    time_spent: float


@dataclass
class RoundAnswer:
    player_id: str
    selected_choices: list[int]
    elapsed: float
    timeout: bool = False


@dataclass
class QuestionState:
    id: int
    correct_choices: list[int]
    difficulty: str = "medium"
    question_type: str = "MCQ"


@dataclass
class Room:
    id: str
    questions: list[QuestionState]
    mode: RoomMode
    timer: int
    code: str = ""
    creator_player_id: str = ""
    status: GameStatus = GameStatus.waiting
    players: dict[str, Player] = field(default_factory=dict)
    shuffled_question_ids: list[int] = field(default_factory=list)
    answers: list[AnswerRecord] = field(default_factory=list)
    start_time: float = 0.0

    # Synchronized round state
    current_question_index: int = 0
    question_started_at: float = 0.0
    question_deadline: float = 0.0
    answered_players: set[str] = field(default_factory=set)
    current_round_answers: dict[str, RoundAnswer] = field(default_factory=dict)
    feedback_until: float | None = None
    advance_task: object | None = field(default=None, repr=False)

    @property
    def player_count(self) -> int:
        return len(self.players)

    @property
    def active_players(self) -> list[Player]:
        return [p for p in self.players.values() if not p.disconnected]

    @property
    def all_finished(self) -> bool:
        active = self.active_players
        if not active:
            return False
        return self.status == GameStatus.playing and all(p.finished for p in active)

    def shuffle_questions(self) -> None:
        ids = [q.id for q in self.questions]
        random.shuffle(ids)
        self.shuffled_question_ids = ids

    def get_question_id_at(self, index: int) -> int | None:
        if 0 <= index < len(self.shuffled_question_ids):
            return self.shuffled_question_ids[index]
        return None

    def current_question_id(self) -> int | None:
        return self.get_question_id_at(self.current_question_index)

    def get_question_state(self, qid: int) -> QuestionState | None:
        for q in self.questions:
            if q.id == qid:
                return q
        return None

    def all_active_answered(self) -> bool:
        active = self.active_players
        if not active:
            return False
        return all(p.player_id in self.answered_players for p in active)


class RoomStore:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        room_id: str,
        questions: list[QuestionPayload],
        mode: RoomMode,
        timer: int,
        code: str = "",
    ) -> Room:
        qs = [
            QuestionState(
                id=q.id,
                correct_choices=q.correct_choices,
                difficulty=q.difficulty,
                question_type=q.question_type,
            )
            for q in questions
        ]
        room = Room(id=room_id, questions=qs, mode=mode, timer=timer, code=code)
        async with self._lock:
            self._rooms[room_id] = room
        return room

    async def get(self, room_id: str) -> Room | None:
        async with self._lock:
            return self._rooms.get(room_id)

    async def get_or_raise(self, room_id: str) -> Room:
        room = await self.get(room_id)
        if room is None:
            raise KeyError(f"Room {room_id} not found")
        return room

    async def add_player(self, room_id: str, player_id: str, nickname: str) -> Player:
        room = await self.get_or_raise(room_id)
        player = Player(player_id=player_id, nickname=nickname)
        async with self._lock:
            room.players[player_id] = player
        return player

    async def get_player(self, room_id: str, player_id: str) -> Player | None:
        room = await self.get(room_id)
        if room is None:
            return None
        return room.players.get(player_id)

    async def record_answer(self, room_id: str, record: AnswerRecord) -> None:
        room = await self.get_or_raise(room_id)
        async with self._lock:
            room.answers.append(record)

    async def replay_room(
        self,
        room_id: str,
        new_questions: list[QuestionPayload] | None = None,
    ) -> Room:
        """Reset a finished room to waiting state so it can be replayed.
        If new_questions is provided, replace the question pool.
        """
        room = await self.get_or_raise(room_id)
        if room.status != GameStatus.finished:
            raise ValueError(f"Room {room_id} is not finished (status={room.status})")

        async with self._lock:
            if new_questions is not None:
                room.questions = [
                    QuestionState(
                        id=q.id,
                        correct_choices=q.correct_choices,
                        difficulty=q.difficulty,
                        question_type=q.question_type,
                    )
                    for q in new_questions
                ]
            room.status = GameStatus.waiting
            room.answers.clear()
            room.shuffled_question_ids.clear()
            room.start_time = 0.0
            room.current_question_index = 0
            room.question_started_at = 0.0
            room.question_deadline = 0.0
            room.answered_players.clear()
            room.current_round_answers.clear()
            room.feedback_until = None
            room.advance_task = None

            for player in room.players.values():
                player.score = 0
                player.streak = 0
                player.cumulative_time = 0.0
                player.current_question_index = 0
                player.finished = False
                player.question_started_at = 0.0
                player.disconnected = False

        return room

    async def remove(self, room_id: str) -> None:
        async with self._lock:
            self._rooms.pop(room_id, None)

    async def room_count(self) -> int:
        async with self._lock:
            return len(self._rooms)


store = RoomStore()
