from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.logger import logger
from src.room_store import store
from src.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("engine_started")

    async def _cleanup_loop() -> None:
        """Periodically remove expired finished rooms every 5 minutes."""
        while True:
            try:
                await asyncio.sleep(300)  # 5 minutes
                removed = await store.cleanup_expired()
                if removed:
                    logger.info(
                        "cleanup_cycle", extra={"rooms_removed": removed}
                    )
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("cleanup_cycle_error")

    cleanup_task = asyncio.create_task(_cleanup_loop())

    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

        active = await store.cleanup_on_shutdown()
        if active:
            logger.info(
                "shutdown_active_rooms",
                extra={"count": len(active), "rooms": active},
            )
        logger.info("engine_stopped")


app = FastAPI(title="Quizztine Quiz Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
