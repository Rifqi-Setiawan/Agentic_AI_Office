from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Payload permintaan autentikasi Founder."""

    password: str = Field(..., description="Kata sandi Founder.")


class LoginResponse(BaseModel):
    """Respons keberhasilan autentikasi Founder."""

    success: bool = True
    role: str = "founder"
    expires_at: int = Field(
        ..., description="Unix timestamp detik berakhirnya masa aktif cookie sesi."
    )


class LogoutResponse(BaseModel):
    """Respons pengakhiran sesi Founder."""

    success: bool = True


class TriggerCollectiveRequest(BaseModel):
    """Parameter permintaan untuk memicu event interaksi kolektif kantor."""

    kind: Literal["rapat", "break", "sholat", "pool_party", "fire_drill", "town_hall"] = Field(
        ..., description="Jenis kegiatan kolektif (rapat, break, sholat)."
    )
    duration_seconds: int | None = Field(
        default=None,
        ge=1,
        le=3600,
        description="Durasi kegiatan dalam detik (default sesuai jenis event jika kosong).",
    )
    participants: list[str] | None = Field(
        default=None,
        description="Daftar ID agen yang diundang. Jika kosong, mengikutsertakan semua agen idle.",
    )
    title: str | None = Field(
        default=None,
        description="Judul kustom untuk kegiatan kolektif.",
    )
