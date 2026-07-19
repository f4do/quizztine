from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any

from src.logger import logger
from src.notifications import notify_backend
from src.room_store import AnswerRecord, GameStatus, RoundAnswer, store
from src.scoring import ScoreCalculator, ScoreResult, ScoringContext, is_answer_correct

FEEDBACK_DELAY = 5.0


def _active_players_count(room) -> int:
    return len([p for p in room.players.values() if not p.disconnected])


class GameFlow(ABC):
    def __init__(self, calculator: ScoreCalculator | None = None) -> None:
        self.calculator = calculator or ScoreCalculator()

    @abstractmethod
    def should_finish_round(self, room) -> bool:
        ...

    @abstractmethod
    def should_eliminate(self, room, player_id: str) -> bool:
        ...

    async def on_answer(
        self, room, room_id: str, player_id: str, background_tasks=None
    ) -> None:
        if self.should_finish_round(room):
            await self.finish_round(room_id, background_tasks)

    async def on_remove_player(
        self, room, room_id: str, background_tasks=None
    ) -> None:
        if (
            room.status == GameStatus.playing
            and room.feedback_until is None
            and self.should_finish_round(room)
        ):
            await self.finish_round(room_id, background_tasks)

    async def finish_round(self, room_id: str, background_tasks=None) -> None:
        room = await store._get_raw(room_id)
        if room is None or room.status != GameStatus.playing:
            return
        if room.feedback_until is not None:
            return
        if room.advance_task is not None:
            task = room.advance_task
            room.advance_task = None
            if task is not asyncio.current_task():
                task.cancel()
        for player in room.active_players:
            if player.player_id not in room.current_round_answers:
                room.current_round_answers[player.player_id] = RoundAnswer(
                    player_id=player.player_id,
                    selected_choices=[],
                    elapsed=room.timer,
                    timeout=True,
                )
                room.answered_players.add(player.player_id)
        results = await self._score_round(room)
        qstate = room.get_question_state(room.current_question_id())
        correct_choices = qstate.correct_choices if qstate else []
        room.feedback_until = time.time() + FEEDBACK_DELAY

        await notify_backend(
            room_id,
            "question-finished",
            {
                "question_id": room.current_question_id(),
                "correct_choices": correct_choices,
                "results": results,
            },
        )
        logger.info(
            "round_finished",
            extra={
                "room_id": room_id,
                "question_id": room.current_question_id(),
                "results": len(results),
            },
        )
        if background_tasks is not None:
            background_tasks.add_task(self._advance_after_feedback, room_id)
        else:
            room.advance_task = asyncio.create_task(
                self._advance_after_feedback(room_id)
            )

    async def _score_round(self, room) -> list[dict[str, Any]]:
        qstate = room.get_question_state(room.current_question_id())
        if qstate is None:
            return []

        correct_players = {
            ra.player_id
            for ra in room.current_round_answers.values()
            if not ra.timeout
            and is_answer_correct(
                qstate.correct_choices,
                ra.selected_choices,
                question_type=qstate.question_type,
            )
        }

        results: list[dict[str, Any]] = []
        ordered_answers = sorted(
            room.current_round_answers.values(), key=lambda ra: ra.elapsed
        )
        for ra in ordered_answers:
            player = room.players.get(ra.player_id)
            if player is None:
                continue
            old_streak = player.streak
            if ra.timeout:
                correct = False
                points = 0
                bonus = 0
                new_streak = 0
                player.streak = 0
                time_spent = float(room.timer)
            else:
                correct = is_answer_correct(
                    qstate.correct_choices,
                    ra.selected_choices,
                    question_type=qstate.question_type,
                )
                time_spent = min(ra.elapsed, room.timer)
                if correct:
                    first_correct = ra.player_id == next(
                        iter(correct_players), None
                    )
                    alone_correct = len(correct_players) == 1
                    ctx = ScoringContext(
                        mode=room.mode,
                        player_count=_active_players_count(room),
                        difficulty=qstate.difficulty,
                        is_correct=True,
                        current_streak=old_streak,
                        first_correct=first_correct,
                        alone_correct=alone_correct,
                    )
                    sr = self.calculator.calculate(ctx)
                    points = sr.total
                    bonus = sr.bonus
                    new_streak = sr.new_streak
                    player.streak = new_streak
                else:
                    points = 0
                    bonus = 0
                    new_streak = old_streak
                    player.streak = 0

            player.score += points
            player.cumulative_time += time_spent

            await store.record_answer(
                room.id,
                AnswerRecord(
                    player_id=ra.player_id,
                    question_id=qstate.id,
                    correct=correct,
                    time_spent=time_spent,
                ),
            )

            results.append(
                {
                    "player_id": ra.player_id,
                    "nickname": player.nickname,
                    "correct": correct,
                    "points": points,
                    "bonus": bonus,
                    "streak": player.streak if correct else 0,
                    "cumulative_time": player.cumulative_time,
                }
            )

        return results

    async def _advance_after_feedback(self, room_id: str) -> None:
        await asyncio.sleep(FEEDBACK_DELAY)
        await self.advance_question(room_id)

    async def advance_question(self, room_id: str) -> None:
        room = await store._get_raw(room_id)
        if room is None or room.status != GameStatus.playing:
            return

        room.current_question_index += 1
        room.answered_players.clear()
        room.current_round_answers.clear()
        room.feedback_until = None
        if room.advance_task is not None:
            task = room.advance_task
            room.advance_task = None
            if task is not asyncio.current_task():
                task.cancel()

        for player in room.players.values():
            player.current_question_index = room.current_question_index

        if room.current_question_index >= len(room.shuffled_question_ids):
            for player in room.players.values():
                player.finished = True
            room.status = GameStatus.finished
            await self._send_results(room_id)

            await notify_backend(room_id, "game-finished", {})
            logger.info("game_finished", extra={"room_id": room_id})
            return

        now = time.time()
        room.question_started_at = now
        room.question_deadline = now + room.timer
        room.advance_task = asyncio.create_task(
            self._deadline_task(room_id, room.question_deadline)
        )
        await notify_backend(
            room_id,
            "next-question",
            {"question_index": room.current_question_index},
        )
        logger.info(
            "next_question",
            extra={"room_id": room_id, "index": room.current_question_index},
        )

    async def _deadline_task(self, room_id: str, deadline: float) -> None:
        sleep_seconds = deadline - time.time()
        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)
        room = await store._get_raw(room_id)
        if room is None or room.status != GameStatus.playing:
            return
        if room.feedback_until is not None:
            return
        await self.finish_round(room_id)

    async def _send_results(self, room_id: str, max_retries: int = 3) -> None:
        room = await store._get_raw(room_id)
        if room is None:
            return

        sorted_players = sorted(
            room.players.values(),
            key=lambda p: (-p.score, p.cumulative_time),
        )

        from src.schemas import PlayerAnswer, ResultsCallback, ScoreboardEntry

        scores = [
            ScoreboardEntry(
                player_id=p.player_id,
                nickname=p.nickname,
                score=p.score,
                streak=p.streak,
                cumulative_time=p.cumulative_time,
            )
            for p in sorted_players
        ]

        answers = [
            PlayerAnswer(
                player_id=a.player_id,
                question_id=a.question_id,
                correct=a.correct,
                time_spent=a.time_spent,
            )
            for a in room.answers
        ]

        payload = ResultsCallback(scores=scores, answers=answers)
        await notify_backend(room_id, "results", payload.model_dump())


class ClassicFlow(GameFlow):
    def should_finish_round(self, room) -> bool:
        return room.all_active_answered()

    def should_eliminate(self, room, player_id: str) -> bool:
        return False
