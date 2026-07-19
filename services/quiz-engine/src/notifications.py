from __future__ import annotations

import asyncio
from typing import Any

import httpx

from src.config import settings
from src.logger import logger


async def notify_backend(
    room_id: str,
    path: str,
    payload: dict[str, Any] | None = None,
    max_retries: int = 3,
) -> None:
    """Notify the web backend of a game event with exponential backoff retry."""
    url = f"{settings.backend_url}/rooms/{room_id}/{path}"
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload or {}, timeout=5.0)
                resp.raise_for_status()
                logger.info(
                    "backend_notified",
                    extra={
                        "room_id": room_id,
                        "event": path,
                        "status": resp.status_code,
                        "attempt": attempt + 1,
                    },
                )
                return
        except httpx.RequestError as exc:
            last_error = exc
            logger.warning(
                "backend_notify_retry",
                extra={
                    "room_id": room_id,
                    "event": path,
                    "attempt": attempt + 1,
                    "error": str(exc),
                },
            )
        except httpx.HTTPStatusError as exc:
            last_error = exc
            logger.warning(
                "backend_notify_retry",
                extra={
                    "room_id": room_id,
                    "event": path,
                    "attempt": attempt + 1,
                    "status": exc.response.status_code,
                },
            )
        if attempt < max_retries - 1:
            await asyncio.sleep(2**attempt)  # exponential backoff: 1s, 2s, 4s
    logger.error(
        "backend_notify_failed",
        extra={"room_id": room_id, "event": path, "error": str(last_error)},
    )
