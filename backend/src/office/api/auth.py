from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from office.models.auth import LoginRequest, LoginResponse, LogoutResponse
from office.models.errors import ErrorResponse

logger = logging.getLogger(__name__)

# Router untuk autentikasi Founder
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

# Konstanta Sesi Founder sesuai Dokumen 01 dan ADR-003
SESSION_COOKIE_NAME = "office_session"
DEFAULT_SESSION_SECRET = "office-v2-founder-secret-key-change-in-production"
SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # 7 hari (604.800 detik)

# Pengaturan Rate Limiter Login: 5 percobaan per 15 menit per IP
LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60  # 15 menit (900 detik)


def get_session_serializer() -> URLSafeTimedSerializer:
    """Mengembalikan serializer itsdangerous bertanda tangan untuk sesi Founder."""
    secret = os.environ.get("OFFICE_SESSION_SECRET", DEFAULT_SESSION_SECRET)
    return URLSafeTimedSerializer(secret_key=secret, salt="founder-session")


def extract_client_ip(request: Request) -> str:
    """Mengekstrak alamat IP klien dengan mempertimbangkan header reverse-proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def is_request_secure(request: Request) -> bool:
    """Menentukan apakah cookie harus ditandai Secure.

    Secara default:
    - True jika request berjalan lewat HTTPS (langsung atau via header X-Forwarded-Proto dari Caddy)
    - True jika environment OFFICE_COOKIE_SECURE disetel '1' atau 'true'
    - False jika dijalankan di lingkungan pengujian HTTP / localhost tanpa TLS
    """
    env_override = os.environ.get("OFFICE_COOKIE_SECURE")
    if env_override is not None:
        return env_override.strip().lower() in ("1", "true", "yes", "on")

    forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
    if "https" in forwarded_proto:
        return True

    return request.url.scheme == "https"


def verify_office_intent(request: Request) -> bool:
    """Memeriksa apakah request membawa header mitigasi CSRF X-Office-Intent: 1."""
    return request.headers.get("x-office-intent") == "1"


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


def create_founder_session_token(current_time: int | None = None) -> tuple[str, int]:
    """Membuat token sesi bertanda tangan dan timestamp kedaluwarsanya."""
    now_ts = int(time.time()) if current_time is None else current_time
    expires_at = now_ts + SESSION_MAX_AGE_SECONDS

    serializer = get_session_serializer()
    payload = {
        "role": "founder",
        "authenticated": True,
        "created_at": now_ts,
        "expires_at": expires_at,
    }
    token = serializer.dumps(payload)
    return token, expires_at


def verify_founder_password(password: str) -> bool:
    """Memverifikasi kecocokan password dengan hash Argon2 dari environment OFFICE_FOUNDER_HASH."""
    founder_hash = os.environ.get("OFFICE_FOUNDER_HASH")
    if not founder_hash or not founder_hash.strip():
        logger.error("OFFICE_FOUNDER_HASH environment variable belum dikonfigurasi.")
        return False

    ph = PasswordHasher()
    try:
        ph.verify(founder_hash.strip(), password)
        return True
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False
    except Exception as exc:
        logger.error("Kesalahan tak terduga saat memverifikasi Argon2 hash: %s", exc)
        return False


class LoginRateLimiter:
    """Rate limiter geser per IP untuk endpoint login (5 percobaan / 15 menit)."""

    def __init__(
        self,
        max_attempts: int = LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
        window_seconds: int = LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check_and_record(self, ip: str, now: float | None = None) -> tuple[bool, int]:
        """Memeriksa apakah IP diizinkan melakukan percobaan login dan mencatatnya.

        Mengembalikan (allowed, retry_after_seconds):
        - allowed: True jika percobaan < max_attempts, False jika melebihi batas.
        - retry_after_seconds: Detik tersisa sampai slot percobaan kembali tersedia.
        """
        now_ts = time.time() if now is None else now
        cutoff = now_ts - self.window_seconds

        with self._lock:
            history = [t for t in self._attempts.get(ip, []) if t > cutoff]

            if len(history) >= self.max_attempts:
                oldest = history[0]
                retry_after = max(1, int(oldest + self.window_seconds - now_ts))
                self._attempts[ip] = history
                return False, retry_after

            history.append(now_ts)
            self._attempts[ip] = history
            return True, 0

    def reset_ip(self, ip: str) -> None:
        """Mereset riwayat percobaan login untuk satu IP tertentu."""
        with self._lock:
            self._attempts.pop(ip, None)

    def reset_all(self) -> None:
        """Mereset seluruh riwayat IP (biasa digunakan pada pengujian unit)."""
        with self._lock:
            self._attempts.clear()


# Instance singleton pelacak rate limiter login
login_rate_limiter = LoginRateLimiter()


@router.post(
    "/login",
    summary="Login Founder",
    description=(
        "Mengautentikasi Founder via hash Argon2 dan menerbitkan cookie sesi office_session."
    ),
    response_model=None,
    responses={
        200: {"model": LoginResponse, "description": "Login berhasil, cookie sesi diterbitkan."},
        400: {"model": ErrorResponse, "description": "Format payload tidak valid."},
        401: {"model": ErrorResponse, "description": "Password Founder salah."},
        403: {
            "model": ErrorResponse,
            "description": "Header X-Office-Intent: 1 tidak ada atau tidak valid.",
        },
        429: {
            "model": ErrorResponse,
            "description": "Terlalu banyak percobaan login (maksimal 5 per 15 menit).",
        },
        500: {
            "model": ErrorResponse,
            "description": "Konfigurasi server belum lengkap (OFFICE_FOUNDER_HASH belum disetel).",
        },
    },
)
async def login_founder(request: Request, payload: LoginRequest) -> JSONResponse:
    # 1. Validasi proteksi CSRF X-Office-Intent
    if not verify_office_intent(request):
        return JSONResponse(
            status_code=403,
            content={
                "error": "Header X-Office-Intent: 1 wajib disertakan untuk proteksi CSRF",
                "code": "FORBIDDEN",
            },
        )

    # 2. Penegakan batas laju percobaan login (Rate Limiting)
    client_ip = extract_client_ip(request)
    allowed, retry_after = login_rate_limiter.check_and_record(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={
                "error": "Terlalu banyak percobaan login. Maksimal 5 percobaan per 15 menit.",
                "code": "TOO_MANY_ATTEMPTS",
            },
        )

    # 3. Periksa ketersediaan konfigurasi hash
    if not os.environ.get("OFFICE_FOUNDER_HASH"):
        logger.error("OFFICE_FOUNDER_HASH tidak ditemukan di environment.")
        return JSONResponse(
            status_code=500,
            content={
                "error": "Konfigurasi server belum lengkap (OFFICE_FOUNDER_HASH belum disetel)",
                "code": "CONFIG_ERROR",
            },
        )

    # 4. Verifikasi kata sandi via Argon2
    if not verify_founder_password(payload.password):
        return JSONResponse(
            status_code=401,
            content={
                "error": "Password Founder salah",
                "code": "INVALID_CREDENTIALS",
            },
        )

    # 5. Terbitkan token sesi dan pasang cookie HttpOnly; SameSite=Strict
    token, expires_at = create_founder_session_token()
    is_secure = is_request_secure(request)

    resp = JSONResponse(
        status_code=200,
        content=LoginResponse(success=True, role="founder", expires_at=expires_at).model_dump(
            mode="json"
        ),
    )
    resp.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=is_secure,
        samesite="strict",
        path="/",
    )
    return resp


@router.post(
    "/logout",
    summary="Logout Founder",
    description="Menghapus cookie sesi Founder dan mengakhiri sesi administratif.",
    response_model=None,
    responses={
        200: {"model": LogoutResponse, "description": "Logout berhasil, cookie sesi direset."},
        401: {"model": ErrorResponse, "description": "Sesi tidak valid atau telah berakhir."},
        403: {
            "model": ErrorResponse,
            "description": "Header X-Office-Intent: 1 tidak ada atau tidak valid.",
        },
    },
)
async def logout_founder(request: Request) -> JSONResponse:
    # 1. Validasi proteksi CSRF X-Office-Intent
    if not verify_office_intent(request):
        return JSONResponse(
            status_code=403,
            content={
                "error": "Header X-Office-Intent: 1 wajib disertakan untuk proteksi CSRF",
                "code": "FORBIDDEN",
            },
        )

    # 2. Validasi autentikasi Founder
    if not is_founder_authenticated(request):
        return JSONResponse(
            status_code=401,
            content={
                "error": "Sesi tidak valid atau telah berakhir",
                "code": "UNAUTHORIZED",
            },
        )

    # 3. Bersihkan cookie sesi
    resp = JSONResponse(
        status_code=200,
        content=LogoutResponse(success=True).model_dump(mode="json"),
    )
    resp.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="strict",
    )
    return resp
