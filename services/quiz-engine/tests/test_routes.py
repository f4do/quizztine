from __future__ import annotations

import time


class TestHealth:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestCreateRoom:
    def test_create_solo(self, client, sample_room_payload):
        resp = client.post("/rooms", json=sample_room_payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["mode"] == "solo"
        assert data["question_count"] == 3
        assert data["timer"] == 30
        assert len(data["id"]) > 0

    def test_create_multi(self, client, multi_room_payload):
        resp = client.post("/rooms", json=multi_room_payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["mode"] == "multi_public"

    def test_empty_questions(self, client):
        resp = client.post("/rooms", json={"questions": [], "mode": "solo", "timer": 30})
        assert resp.status_code == 422

    def test_invalid_timer(self, client, sample_room_payload):
        payload = {**sample_room_payload, "timer": 1}
        resp = client.post("/rooms", json=payload)
        assert resp.status_code == 422


class TestJoinRoom:
    def test_join_success(self, client, created_room):
        room_id = created_room["id"]
        resp = client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["player_id"] == "p1"
        assert data["nickname"] == "Alice"
        assert data["room_id"] == room_id

    def test_join_unknown_room(self, client):
        resp = client.post("/rooms/unknown/join", json={"player_id": "p1", "nickname": "Alice"})
        assert resp.status_code == 404

    def test_join_duplicate(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        # Rejoining with the same player_id is idempotent (allows reconnect before start)
        resp = client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice2"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["player_id"] == "p1"
        assert data["nickname"] == "Alice"

    def test_join_after_start(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")
        resp = client.post(f"/rooms/{room_id}/join", json={"player_id": "p2", "nickname": "Bob"})
        assert resp.status_code == 400


class TestStartRoom:
    def test_start_success(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        resp = client.post(f"/rooms/{room_id}/start")
        assert resp.status_code == 200
        assert resp.json() == {"status": "started"}

    def test_start_no_players(self, client, created_room):
        room_id = created_room["id"]
        resp = client.post(f"/rooms/{room_id}/start")
        assert resp.status_code == 400

    def test_start_twice(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")
        resp = client.post(f"/rooms/{room_id}/start")
        assert resp.status_code == 400

    def test_start_unknown_room(self, client):
        resp = client.post("/rooms/unknown/start")
        assert resp.status_code == 404


class TestCurrentQuestion:
    def test_get_current_question(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")
        resp = client.get(f"/rooms/{room_id}/current-question/p1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["question_id"] in [1, 2, 3]
        assert data["index"] == 0

    def test_not_started(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        resp = client.get(f"/rooms/{room_id}/current-question/p1")
        assert resp.status_code == 400

    def test_unknown_player(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")
        resp = client.get(f"/rooms/{room_id}/current-question/unknown")
        assert resp.status_code == 404


class TestSubmitAnswer:
    def test_correct_answer_solo(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")

        q = client.get(f"/rooms/{room_id}/current-question/p1").json()
        answer = {
            "question_id": q["question_id"],
            "selected_choices": [0],
            "client_timestamp": time.time(),
        }
        resp = client.post(f"/rooms/{room_id}/answer/p1", json=answer)
        assert resp.status_code == 200
        data = resp.json()
        assert data["points"] >= 10
        assert data["cumulative_time"] > 0

    def test_wrong_answer(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")

        q = client.get(f"/rooms/{room_id}/current-question/p1").json()
        answer = {
            "question_id": q["question_id"],
            "selected_choices": [999],
            "client_timestamp": time.time(),
        }
        resp = client.post(f"/rooms/{room_id}/answer/p1", json=answer)
        assert resp.status_code == 200
        data = resp.json()
        assert data["points"] == 0
        assert data["correct"] is False

    def test_answer_unknown_question(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/start")
        answer = {"question_id": 9999, "selected_choices": [0], "client_timestamp": time.time()}
        resp = client.post(f"/rooms/{room_id}/answer/p1", json=answer)
        assert resp.status_code == 400


class TestScoreboard:
    def test_scoreboard_empty_room(self, client, created_room):
        room_id = created_room["id"]
        resp = client.get(f"/rooms/{room_id}/scoreboard")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_scoreboard_order(self, client, created_room):
        room_id = created_room["id"]
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p2", "nickname": "Bob"})
        client.post(f"/rooms/{room_id}/start")

        # Both answer all 3 questions
        for _ in range(3):
            for pid in ["p1", "p2"]:
                q = client.get(f"/rooms/{room_id}/current-question/{pid}").json()
                ans = {
                    "question_id": q["question_id"],
                    "selected_choices": [0],
                    "client_timestamp": time.time(),
                }
                client.post(f"/rooms/{room_id}/answer/{pid}", json=ans)

        sb = client.get(f"/rooms/{room_id}/scoreboard").json()
        assert len(sb) == 2
        # Sorted by score desc, then cumulative_time asc
        assert sb[0]["score"] >= sb[1]["score"]


class TestSynchronizedRounds:
    def test_multi_players_see_same_question(self, client, multi_room_payload):
        resp = client.post("/rooms", json=multi_room_payload)
        assert resp.status_code == 201
        room_id = resp.json()["id"]

        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p2", "nickname": "Bob"})
        client.post(f"/rooms/{room_id}/start")

        q1 = client.get(f"/rooms/{room_id}/current-question/p1").json()
        q2 = client.get(f"/rooms/{room_id}/current-question/p2").json()
        assert q1["question_id"] == q2["question_id"]
        assert q1["index"] == q2["index"] == 0

    def test_multi_waits_for_all_answers(self, client, monkeypatch):
        import src.game_flow as game_flow
        import src.routes as routes
        async def _noop(*args, **kwargs):
            pass
        monkeypatch.setattr(routes, "_notify_backend", _noop)
        monkeypatch.setattr(routes.flow, "_send_results", _noop)
        monkeypatch.setattr(game_flow, "FEEDBACK_DELAY", 0.1)

        payload = {
            "questions": [{"id": 1, "correct_choices": [0]}],
            "mode": "multi_public",
            "timer": 30,
        }
        resp = client.post("/rooms", json=payload)
        room_id = resp.json()["id"]

        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p2", "nickname": "Bob"})
        client.post(f"/rooms/{room_id}/start")

        q = client.get(f"/rooms/{room_id}/current-question/p1").json()
        client.post(f"/rooms/{room_id}/answer/p1", json={
            "question_id": q["question_id"],
            "selected_choices": [0],
            "client_timestamp": time.time(),
        })

        # Round is not finished until the second player answers.
        room = client.get(f"/rooms/{room_id}").json()
        assert room["current_question_index"] == 0
        assert room["status"] == "playing"

        client.post(f"/rooms/{room_id}/answer/p2", json={
            "question_id": q["question_id"],
            "selected_choices": [0],
            "client_timestamp": time.time(),
        })

        # Feedback delay then game ends (only one question).
        time.sleep(0.3)
        room = client.get(f"/rooms/{room_id}").json()
        assert room["status"] == "finished"

    def test_multi_disconnect_does_not_block(self, client, monkeypatch):
        import src.routes as routes
        async def _noop(*args, **kwargs):
            pass
        monkeypatch.setattr(routes, "_notify_backend", _noop)
        monkeypatch.setattr(routes.flow, "_send_results", _noop)

        payload = {
            "questions": [{"id": 1, "correct_choices": [0]}],
            "mode": "multi_public",
            "timer": 30,
        }
        resp = client.post("/rooms", json=payload)
        room_id = resp.json()["id"]

        client.post(f"/rooms/{room_id}/join", json={"player_id": "p1", "nickname": "Alice"})
        client.post(f"/rooms/{room_id}/join", json={"player_id": "p2", "nickname": "Bob"})
        client.post(f"/rooms/{room_id}/start")

        q = client.get(f"/rooms/{room_id}/current-question/p1").json()
        client.post(f"/rooms/{room_id}/answer/p1", json={
            "question_id": q["question_id"],
            "selected_choices": [0],
            "client_timestamp": time.time(),
        })

        # Bob disconnects; the round should finish and the game should end (single question).
        client.delete(f"/rooms/{room_id}/players/p2")

        time.sleep(0.1)
        room = client.get(f"/rooms/{room_id}").json()
        assert room["status"] == "finished"
