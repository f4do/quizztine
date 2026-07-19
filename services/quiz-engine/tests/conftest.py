from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.room_store import store


@pytest.fixture(autouse=True)
def _clear_store():
    store._rooms.clear()
    yield


@pytest.fixture(autouse=True)
def _disable_backend_network(monkeypatch):
    import src.game_flow as game_flow
    import src.routes as routes

    async def _noop(*args, **kwargs):
        pass

    monkeypatch.setattr(game_flow, "notify_backend", _noop)
    monkeypatch.setattr(routes.flow, "_send_results", _noop)
    monkeypatch.setattr(game_flow, "FEEDBACK_DELAY", 0.0)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_room_payload():
    return {
        "questions": [
            {"id": 1, "correct_choices": [0]},
            {"id": 2, "correct_choices": [0]},
            {"id": 3, "correct_choices": [0]},
        ],
        "mode": "solo",
        "timer": 30,
    }


@pytest.fixture
def created_room(client, sample_room_payload):
    resp = client.post("/rooms", json=sample_room_payload)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def multi_room_payload():
    return {
        "questions": [
            {"id": 1, "correct_choices": [0]},
            {"id": 2, "correct_choices": [1]},
        ],
        "mode": "multi_public",
        "timer": 30,
    }
