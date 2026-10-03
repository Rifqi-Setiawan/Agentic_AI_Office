from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgentBio(BaseModel):
    """Data profil persona, peran, dan preferensi kerja seorang agen."""

    id: str
    name: str
    alias: str | None = None
    role: str
    department: str
    personality: str
    specialties: list[str] = Field(default_factory=list)
    primary_color: str
    desk_zone: str


class AgentProfile(BaseModel):
    """Profil terpadu agen menggabungkan bio, konfigurasi, dan status runtime."""

    bio: AgentBio
    model: str | None = None
    provider: str | None = None
    status: str = "configured"
    responsibilities: list[str] = Field(default_factory=list)
    extra_config: dict[str, Any] = Field(default_factory=dict)
