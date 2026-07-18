from __future__ import annotations

from fastapi import HTTPException
from starlette.responses import JSONResponse


def engine_error(status: int, code: str, error: str, details: object = None) -> HTTPException:
    body: dict[str, object] = {"error": error, "code": code, "status": status}
    if details is not None:
        body["details"] = details
    return HTTPException(status_code=status, detail=body)


def error_response(status: int, code: str, error: str, details: object = None) -> JSONResponse:
    body: dict[str, object] = {"error": error, "code": code, "status": status}
    if details is not None:
        body["details"] = details
    return JSONResponse(status_code=status, content=body)
