from __future__ import annotations

import os
from typing import Any

from fastapi import Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

# Secret key untuk sesi founder dari environment atau fallback default
SESSION_COOKIE_NAME = "office_session"
DEFAULT_SESSION_SECRET = "office-v2-founder-secret-key-change-in-production"
SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # 7 hari


def get_session_serializer() -> URLSafeTimedSerializer:
    secret = os.environ.get("OFFICE_SESSION_SECRET", DEFAULT_SESSION_SECRET)
    return URLSafeTimedSerializer(secret_key=secret, salt="founder-session")


def is_founder_authenticated(request: Request) -> bool:
    """Memeriksa apakah request memiliki cookie sesi Founder yang sah dan belum kedaluwarsa."""
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie:
        return False

    serializer = get_session_serializer()
    try:
        data: dict[str, Any] = serializer.loads(cookie, max_age=SESSION_MAX_AGE_SECONDS)
        return bool(data.get("role") == "founder" or data.get("authenticated") is True)
    except (BadSignature, SignatureExpired):
        return False
