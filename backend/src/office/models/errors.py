from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Format standar representasi kesalahan API sesuai OpenAPI v1."""

    error: str
    code: str
    details: dict[str, Any] | None = None
