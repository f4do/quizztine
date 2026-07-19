from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, status

from src.errors import engine_error
from src.game_flow import ClassicFlow, GameFlow
from src.logger import logger
from src.room_store import GameStatus, RoundAnswer, store
from src.schemas import (
    AnswerRequest,
    AnswerResponse,
    CreateRoomRequest,
    CreateRoomResponse,
    CurrentQuestionResponse,
    JoinRequest,
    JoinResponse,
    ReplayRequest,
    RoomMode,
    ScoreboardEntry,
)
from src.scoring import ScoringContext, is_answer_correct

router = APIRouter()
flow: GameFlow = ClassicFlow()


def _active_players_count(room) -> int:
    return len([p for p in room.players.values() if not p.disconnected])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str) -> dict[str, Any]:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")
    return {
        "id": room.id,
        "code": room.code,
        "mode": room.mode,
        "timer": room.timer,
        "status": room.status,
        "player_count": room.player_count,
        "current_question_index": room.current_question_index,
        "total_questions": len(room.shuffled_question_ids),
        "players": [
            {
                "id": p.player_id,
                "nickname": p.nickname,
                "score": p.score,
                "streak": p.streak,
                "cumulative_time": p.cumulative_time,
                "finished": p.finished,
                "disconnected": p.disconnected,
                "answered": p.player_id in room.answered_players,
            }
            for p in room.players.values()
        ],
    }


@router.post("/rooms", response_model=CreateRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(body: CreateRoomRequest) -> CreateRoomResponse:
    room_id = body.id or str(uuid.uuid4())

    room = await store.create(
        room_id,
        body.questions,
        body.mode,
        body.timer,
        code=body.code or "",
        creator_player_id=body.creator_player_id or "",
    )

    logger.info(
        "room_created",
        extra={
            "room_id": room_id,
            "mode": body.mode,
            "questions": len(body.questions),
        },
    )

    return CreateRoomResponse(
        id=room_id,
        mode=room.mode,
        timer=room.timer,
        question_count=len(room.questions),
    )


@router.delete("/rooms/{room_id}/players/{player_id}", status_code=status.HTTP_200_OK)
async def remove_player(
    room_id: str, player_id: str, background_tasks: BackgroundTasks
) -> dict[str, str]:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    if player_id not in room.players:
        raise engine_error(404, "PLAYER_NOT_FOUND", f"Player {player_id} not in room")

    if room.status == GameStatus.waiting:
        updated = await store.update_room(
            room_id, lambda r: r.players.pop(player_id, None)
        )
        logger.info("player_removed", extra={"room_id": room_id, "player_id": player_id})
        if updated is not None and updated.player_count == 0:
            if not room.creator_player_id or player_id == room.creator_player_id:
                await store.remove(room_id)
                logger.info("room_deleted_empty", extra={"room_id": room_id})
    else:
        updated = await store.update_room(
            room_id, lambda r: r.players[player_id].__setattr__("disconnected", True)
        )
        logger.info("player_disconnected", extra={"room_id": room_id, "player_id": player_id})
        # A disconnected player should not block the round.
        # Use the updated room copy so that on_remove_player sees the disconnect
        await flow.on_remove_player(updated or room, room_id, background_tasks)

    return {"status": "removed"}


@router.post("/rooms/{room_id}/join", response_model=JoinResponse, status_code=status.HTTP_200_OK)
async def join_room(room_id: str, body: JoinRequest) -> JoinResponse:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    if room.status == GameStatus.finished:
        raise engine_error(400, "ROOM_NOT_JOINABLE", "Game already finished")

    existing_nick = next((p for p in room.players.values() if p.nickname == body.nickname), None)
    if existing_nick and existing_nick.player_id != body.player_id:
        if room.status == GameStatus.playing and existing_nick.disconnected:
            await store.update_room(
                room_id,
                lambda r: r.players[existing_nick.player_id].__setattr__(
                    "disconnected", False
                ),
            )
            logger.info(
                "player_reconnected_by_nick",
                extra={"room_id": room_id, "nickname": body.nickname},
            )
            return JoinResponse(
                room_id=room_id,
                player_id=existing_nick.player_id,
                nickname=existing_nick.nickname,
            )
        raise engine_error(409, "NICKNAME_TAKEN", f"Nickname {body.nickname} already in room")

    if body.player_id in room.players:
        if room.status == GameStatus.finished:
            raise engine_error(400, "ROOM_NOT_JOINABLE", "Game already finished")
        await store.update_room(
            room_id,
            lambda r: r.players[body.player_id].__setattr__("disconnected", False),
        )
        logger.info(
            "player_reconnected",
            extra={"room_id": room_id, "player_id": body.player_id},
        )
        return JoinResponse(
            room_id=room_id,
            player_id=body.player_id,
            nickname=room.players[body.player_id].nickname,
        )

    if room.status != GameStatus.waiting:
        raise engine_error(400, "ROOM_NOT_JOINABLE", "Game already started")

    player = await store.add_player(room_id, body.player_id, body.nickname)

    logger.info("player_joined", extra={"room_id": room_id, "player_id": body.player_id})

    return JoinResponse(room_id=room_id, player_id=player.player_id, nickname=player.nickname)


@router.post("/rooms/{room_id}/start", status_code=status.HTTP_200_OK)
async def start_room(room_id: str, player_id: str = "") -> dict[str, str]:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    if room.status != GameStatus.waiting:
        raise engine_error(400, "ALREADY_STARTED", "Game already started or finished")

    if room.creator_player_id and player_id != room.creator_player_id:
        raise engine_error(403, "NOT_CREATOR", "Only the room creator can start the game")

    if room.player_count == 0:
        raise engine_error(400, "NO_PLAYERS", "Cannot start a room with no players")

    if room.mode != RoomMode.solo and room.player_count < 2:
        raise engine_error(400, "NOT_ENOUGH_PLAYERS", "Multiplayer rooms need at least 2 players")

    def _init_game(r) -> None:
        r.shuffle_questions()
        r.status = GameStatus.playing
        now = time.time()
        r.start_time = now
        r.current_question_index = 0
        r.answered_players.clear()
        r.current_round_answers.clear()
        r.feedback_until = None
        r.question_started_at = now
        r.question_deadline = now + r.timer
        for player in r.players.values():
            player.question_started_at = now
            player.current_question_index = 0
        r.advance_task = asyncio.create_task(
            flow._deadline_task(room_id, r.question_deadline)
        )

    await store.update_room(room_id, _init_game)

    logger.info("room_started", extra={"room_id": room_id, "players": room.player_count})

    return {"status": "started"}


@router.get(
    "/rooms/{room_id}/current-question/{player_id}",
    response_model=CurrentQuestionResponse,
)
async def current_question(room_id: str, player_id: str) -> CurrentQuestionResponse:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    if room.status != GameStatus.playing:
        raise engine_error(400, "GAME_NOT_PLAYING", "Game is not in progress")

    player = await store.get_player(room_id, player_id)
    if player is None:
        raise engine_error(404, "PLAYER_NOT_FOUND", f"Player {player_id} not in room")

    if player.finished:
        raise engine_error(400, "PLAYER_FINISHED", "Player has already answered all questions")

    qid = room.current_question_id()
    if qid is None:
        player.finished = True
        raise engine_error(400, "PLAYER_FINISHED", "Player has already answered all questions")

    return CurrentQuestionResponse(question_id=qid, index=room.current_question_index)


@router.post("/rooms/{room_id}/answer/{player_id}", response_model=AnswerResponse)
async def submit_answer(
    room_id: str,
    player_id: str,
    body: AnswerRequest,
    background_tasks: BackgroundTasks,
) -> AnswerResponse:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    if room.status != GameStatus.playing:
        raise engine_error(400, "GAME_NOT_PLAYING", "Game is not in progress")

    player = await store.get_player(room_id, player_id)
    if player is None:
        raise engine_error(404, "PLAYER_NOT_FOUND", f"Player {player_id} not in room")

    if room.feedback_until is not None:
        # Race condition: deadline_task a déjà fini le round avant que
        # la réponse frontend n'arrive. Retourner un résultat timeout
        # au lieu d'une erreur.
        if player.player_id in room.answered_players:
            return AnswerResponse(
                correct=False,
                points=0,
                bonus=0,
                streak=0,
                cumulative_time=player.cumulative_time,
            )
        # Cas rare : le joueur n'a pas encore été enregistré
        def _register_late_answer(r) -> None:
            r.answered_players.add(player_id)
            r.current_round_answers[player_id] = RoundAnswer(
                player_id=player_id,
                selected_choices=body.selected_choices,
                elapsed=r.timer,
                timeout=True,
            )
        await store.update_room(room_id, _register_late_answer)
        return AnswerResponse(
            correct=False,
            points=0,
            bonus=0,
            streak=0,
            cumulative_time=room.timer,
        )

    if player.finished:
        raise engine_error(400, "PLAYER_FINISHED", "Player already answered all questions")

    current_qid = room.current_question_id()
    if current_qid is None:
        raise engine_error(400, "GAME_NOT_PLAYING", "No current question")

    if body.question_id != current_qid:
        raise engine_error(400, "WRONG_QUESTION", "Answer does not match the current question")

    if player.player_id in room.answered_players:
        raise engine_error(400, "ALREADY_ANSWERED", "Player already answered this round")

    elapsed = time.time() - room.question_started_at
    timeout = elapsed > room.timer

    def _register_answer(r) -> None:
        r.answered_players.add(player_id)
        r.current_round_answers[player_id] = RoundAnswer(
            player_id=player_id,
            selected_choices=body.selected_choices,
            elapsed=elapsed,
            timeout=timeout,
        )
    updated = await store.update_room(room_id, _register_answer)

    # Provisional scoring for the HTTP response. Final scoring (with multi
    # bonuses) happens once the whole round has finished.
    qstate = room.get_question_state(current_qid)
    if timeout:
        response_correct = False
        response_points = 0
        response_bonus = 0
        response_streak = 0
    else:
        response_correct = is_answer_correct(
            qstate.correct_choices,
            body.selected_choices,
            question_type=qstate.question_type,
        )
        ctx = ScoringContext(
            mode=room.mode,
            player_count=_active_players_count(room),
            difficulty=qstate.difficulty,
            is_correct=response_correct,
            current_streak=player.streak,
            first_correct=False,
            alone_correct=False,
        )
        score_result = flow.calculator.calculate(ctx)
        response_points = score_result.total
        response_bonus = score_result.bonus
        response_streak = score_result.new_streak if response_correct else 0

    logger.info(
        "answer_recorded",
        extra={
            "room_id": room_id,
            "player_id": player_id,
            "question_id": body.question_id,
            "timeout": timeout,
        },
    )

    # Use the updated room copy to check if all active players have answered
    if updated is not None and updated.all_active_answered():
        await flow.on_answer(updated, room_id, player_id, background_tasks)

    response_time = min(elapsed, room.timer) if not timeout else room.timer
    return AnswerResponse(
        correct=response_correct,
        points=response_points,
        bonus=response_bonus,
        streak=response_streak,
        cumulative_time=player.cumulative_time + response_time,
    )


@router.post("/rooms/{room_id}/replay", status_code=status.HTTP_200_OK)
async def replay_room(room_id: str, body: ReplayRequest) -> dict[str, str]:
    try:
        await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    try:
        await store.replay_room(room_id, new_questions=body.questions)
    except ValueError as exc:
        raise engine_error(400, "NOT_FINISHED", str(exc))

    logger.info("room_replayed", extra={"room_id": room_id})

    return {"status": "replayed"}


@router.get("/rooms/{room_id}/scoreboard")
async def get_scoreboard(room_id: str) -> list[dict[str, Any]]:
    try:
        room = await store.get_or_raise(room_id)
    except KeyError:
        raise engine_error(404, "ROOM_NOT_FOUND", f"Room {room_id} not found")

    sorted_players = sorted(
        room.players.values(),
        key=lambda p: (-p.score, p.cumulative_time),
    )

    return [
        ScoreboardEntry(
            player_id=p.player_id,
            nickname=p.nickname,
            score=p.score,
            streak=p.streak,
            cumulative_time=p.cumulative_time,
        ).model_dump()
        for p in sorted_players
    ]
