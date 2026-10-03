from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_PUBLIC_BOARDS: list[str] = ["office-v2"]

DEFAULT_TASK_CATEGORIES_BY_AGENT: dict[str, str] = {
    "forge": "Pengembangan modul backend dan database",
    "prism": "Pembaruan antarmuka pengguna",
    "steward": "Optimasi pipeline grafis dan rendering",
    "sentinel": "Verifikasi kualitas dan validasi sistem",
    "bastion": "Hardening infrastruktur dan keamanan",
    "relay": "Automasi CI/CD dan rilis",
    "daedalus": "Perancangan arsitektur dan spesifikasi data",
    "muse": "Desain visual dan tinjauan gaya",
    "jarvis": "Orkestrasi alur kerja agen",
    "oracle": "Riset literatur dan eksperimen ilmiah",
    "vector": "Rekayasa pipeline data dan analitik",
    "merlin": "Mentoring teknis dan edukasi rekayasa",
    "warden": "Pemeliharaan fasilitas dan operasi kantor",
    "scribe": "Penyusunan dokumentasi teknis dan arsip",
    "nova": "Eksplorasi sistem dan navigasi spasial",
    "rifqi": "Pengawasan strategis dan visi produk",
    "default": "Operasi sistem dan komputasi rutin",
}

DEFAULT_TASK_CATEGORIES_BY_ROLE: dict[str, str] = {
    "Backend Specialist": "Pengembangan modul backend dan database",
    "Frontend Specialist": "Pembaruan antarmuka pengguna",
    "Graphics Lab Lead": "Optimasi pipeline grafis dan rendering",
    "QA Lead & Verifier": "Verifikasi kualitas dan validasi sistem",
    "Systems & Security Architect": "Hardening infrastruktur dan keamanan",
    "Release Engineer & Delivery": "Automasi CI/CD dan rilis",
    "Principal Systems & Data Architect": "Perancangan arsitektur dan spesifikasi data",
    "Design Engineer & UI/UX Lead": "Desain visual dan tinjauan gaya",
    "Chief Orchestrator": "Orkestrasi alur kerja agen",
    "Research Lead & Scientist": "Riset literatur dan eksperimen ilmiah",
    "Data Engineer": "Rekayasa pipeline data dan analitik",
    "Tech Mentor & Pedagogis": "Mentoring teknis dan edukasi rekayasa",
    "Operations & Facilities Lead": "Pemeliharaan fasilitas dan operasi kantor",
    "Technical Writer & Documentarian": "Penyusunan dokumentasi teknis dan arsip",
    "Junior Systems Engineer": "Eksplorasi sistem dan navigasi spasial",
    "Founder & Human Lead": "Pengawasan strategis dan visi produk",
}


class OfficeConfig(BaseModel):
    """Konfigurasi operasional Office v2, termasuk allowlist publik dan redaksi peran."""

    public_boards: list[str] = Field(default_factory=lambda: list(DEFAULT_PUBLIC_BOARDS))
    task_categories_by_agent: dict[str, str] = Field(
        default_factory=lambda: dict(DEFAULT_TASK_CATEGORIES_BY_AGENT)
    )
    task_categories_by_role: dict[str, str] = Field(
        default_factory=lambda: dict(DEFAULT_TASK_CATEGORIES_BY_ROLE)
    )
    default_task_category: str = "Operasi sistem dan komputasi rutin"

    def is_board_public(self, board_name: str | None) -> bool:
        """Memeriksa apakah board tertentu terdaftar dalam allowlist public_boards."""
        if not board_name:
            return False
        return board_name.strip() in self.public_boards

    def get_task_category(self, agent_id: str | None = None, role: str | None = None) -> str:
        """Mengembalikan kategori tugas ramah publik berdasarkan agent ID atau role."""
        if agent_id:
            aid = agent_id.lower().strip()
            if aid in self.task_categories_by_agent:
                return self.task_categories_by_agent[aid]
        if role and role in self.task_categories_by_role:
            return self.task_categories_by_role[role]
        if "default" in self.task_categories_by_agent:
            return self.task_categories_by_agent["default"]
        return self.default_task_category


_CONFIG_CACHE: OfficeConfig | None = None


def find_office_yaml_path(explicit_path: Path | str | None = None) -> Path | None:
    """Mencari lokasi berkas office.yaml dari parameter eksplisit, env var, atau path relatif."""
    if explicit_path:
        p = Path(explicit_path).resolve()
        if p.is_file():
            return p

    env_path = os.environ.get("OFFICE_CONFIG_PATH")
    if env_path:
        p = Path(env_path).resolve()
        if p.is_file():
            return p

    # Cari di direktori kerja saat ini dan parent directories
    candidates = [
        Path("office.yaml"),
        Path("backend/office.yaml"),
        Path("../office.yaml"),
        Path(__file__).parent.parent.parent.parent / "office.yaml",
        Path(__file__).parent.parent / "office.yaml",
    ]
    for c in candidates:
        try:
            resolved = c.resolve()
            if resolved.is_file():
                return resolved
        except Exception:
            continue

    return None


def load_office_config(config_path: Path | str | None = None, reload: bool = False) -> OfficeConfig:
    """Memuat konfigurasi Office dari office.yaml atau fallback ke konfigurasi default."""
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None and not reload and config_path is None:
        return _CONFIG_CACHE

    target_path = find_office_yaml_path(config_path)
    if not target_path:
        logger.info("Berkas office.yaml tidak ditemukan, menggunakan nilai bawaan spesifikasi.")
        cfg = OfficeConfig()
        if config_path is None:
            _CONFIG_CACHE = cfg
        return cfg

    try:
        content = target_path.read_text(encoding="utf-8")
        data: dict[str, Any] = yaml.safe_load(content) or {}
    except Exception as exc:
        logger.warning("Gagal membaca %s: %s. Menggunakan nilai bawaan.", target_path, exc)
        cfg = OfficeConfig()
        if config_path is None:
            _CONFIG_CACHE = cfg
        return cfg

    boards = data.get("public_boards") or list(DEFAULT_PUBLIC_BOARDS)
    cat_agents = dict(DEFAULT_TASK_CATEGORIES_BY_AGENT)
    cat_agents.update(data.get("task_categories_by_agent") or {})

    cat_roles = dict(DEFAULT_TASK_CATEGORIES_BY_ROLE)
    cat_roles.update(data.get("task_categories_by_role") or {})

    def_cat = (
        data.get("default_task_category")
        or cat_agents.get("default")
        or "Operasi sistem dan komputasi rutin"
    )

    cfg = OfficeConfig(
        public_boards=boards,
        task_categories_by_agent=cat_agents,
        task_categories_by_role=cat_roles,
        default_task_category=def_cat,
    )
    if config_path is None:
        _CONFIG_CACHE = cfg
    return cfg
