from __future__ import annotations

import json
import logging
import sys

from src.config import settings


def setup_logger() -> logging.Logger:
    logger = logging.getLogger("quiz-engine")
    logger.setLevel(settings.log_level.upper())

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    logger.handlers.clear()
    logger.addHandler(handler)
    return logger


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
        )


logger = setup_logger()
