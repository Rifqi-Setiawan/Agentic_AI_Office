from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any

import yaml

from office.models.health import ReaderHealth
from office.models.profiles import AgentBio, AgentProfile

logger = logging.getLogger(__name__)

# Metadata baku 16 agen berdasarkan Dokumen 03 Character Design Spec & ADR-003
STATIC_AGENT_METADATA: dict[str, dict[str, Any]] = {
    "jarvis": {
        "name": "Jarvis",
        "alias": "The Orchestrator",
        "role": "Chief Orchestrator",
        "department": "Executive Leadership",
        "personality": "Tenang, berwibawa, selalu menyebut angka dan data akurat",
        "specialties": ["Orkestrasi", "Perencanaan Strategis", "Routing Multitasking"],
        "primary_color": "#1F3A68",
        "desk_zone": "ruang_ceo",
    },
    "daedalus": {
        "name": "Daedalus",
        "alias": "The Architect",
        "role": "Principal Systems & Data Architect",
        "department": "Architecture & Core",
        "personality": "Visioner, metodis, menjunjung tinggi decoupling dan batas sistem",
        "specialties": ["Arsitektur Sistem", "OpenAPI", "Relasional Data", "Event-Driven"],
        "primary_color": "#2F6FB3",
        "desk_zone": "ruang_arsitektur",
    },
    "oracle": {
        "name": "Oracle",
        "alias": "Senku",
        "role": "Research Lead & Scientist",
        "department": "Scientific Research",
        "personality": (
            "Jenius eksentrik, hiper-logis, sangat percaya diri (probabilitas 10 miliar persen)"
        ),
        "specialties": ["Riset Literatur", "Evaluasi Model", "Penalaran Ilmiah", "Eksperimen"],
        "primary_color": "#8A4FBF",
        "desk_zone": "lab_riset",
    },
    "merlin": {
        "name": "Merlin",
        "alias": "The Mentor",
        "role": "Tech Mentor & Pedagogis",
        "department": "Engineering Education",
        "personality": "Sabar, bijak, gemar analogi intuitif dan pembelajaran bertahap",
        "specialties": ["Mentoring", "Analogi Teknis", "Pedagogi Rekayasa", "Review Konsep"],
        "primary_color": "#B5652B",
        "desk_zone": "ruang_kelas",
    },
    "muse": {
        "name": "Muse",
        "alias": "The Designer",
        "role": "Design Engineer & UI/UX Lead",
        "department": "Product Design",
        "personality": "Perfeksionis visual, ketat terhadap estetika anti-AI-slop dan presisi 1px",
        "specialties": ["UI/UX Design", "Design Systems", "Tipografi Tabular", "Color Harmony"],
        "primary_color": "#E0567A",
        "desk_zone": "studio_desain",
    },
    "prism": {
        "name": "Prism",
        "alias": "The Frontend Craftsman",
        "role": "Frontend Specialist",
        "department": "Client Engineering",
        "personality": "Cepat, berorientasi detail mikro, bangga dengan stabilitas 60 FPS",
        "specialties": ["React", "Zustand", "TypeScript", "PixiJS Integration", "Web Vitals"],
        "primary_color": "#2BB3C0",
        "desk_zone": "dev_pod_1",
    },
    "forge": {
        "name": "Forge",
        "alias": "The Blacksmith",
        "role": "Backend Specialist",
        "department": "Core Engineering",
        "personality": (
            "Kokoh, pragmatis, sangat menyukai integritas transaksi dan optimasi performa"
        ),
        "specialties": ["Python 3.12", "FastAPI", "SQLite WAL", "AsyncIO", "ACID Persistence"],
        "primary_color": "#D9622B",
        "desk_zone": "dev_pod_2",
    },
    "vector": {
        "name": "Vector",
        "alias": "The Data Master",
        "role": "Data Engineer",
        "department": "Data & Analytics",
        "personality": "Teliti, terobsesi data bersih tanpa duplikasi dan skema terkelola",
        "specialties": ["DuckDB", "Data Pipelines", "Lakehouse Architecture", "Analytics"],
        "primary_color": "#3FA66B",
        "desk_zone": "data_center",
    },
    "sentinel": {
        "name": "Sentinel",
        "alias": "The Guardian",
        "role": "QA Lead & Verifier",
        "department": "Quality Assurance",
        "personality": "Tegas, skeptis objektif, tidak kompromi terhadap verifikasi independen",
        "specialties": ["Automated Testing", "Property Testing", "E2E Playwright", "Gate Audit"],
        "primary_color": "#D23C3C",
        "desk_zone": "qa_station",
    },
    "bastion": {
        "name": "Bastion",
        "alias": "The Shield",
        "role": "Systems & Security Architect",
        "department": "Security & SOC",
        "personality": "Waspada, security-first, memitigasi risiko sebelum insiden terjadi",
        "specialties": ["Linux Hardening", "Systemd Services", "Zero-Write Enforcement", "SOC"],
        "primary_color": "#6B7785",
        "desk_zone": "soc",
    },
    "relay": {
        "name": "Relay",
        "alias": "The Courier",
        "role": "Release Engineer & Delivery",
        "department": "DevOps & CI/CD",
        "personality": "Rapi, tepat waktu, memastikan hanya paket terverifikasi yang meluncur",
        "specialties": ["CI/CD Pipelines", "Git Automation", "Package Delivery", "Release Audit"],
        "primary_color": "#6D5BD0",
        "desk_zone": "release_dock",
    },
    "warden": {
        "name": "Warden",
        "alias": "The Operator",
        "role": "Operations & Facilities Lead",
        "department": "Office Operations",
        "personality": "Serbabisa, selalu siap sedia membantu dan menjaga kebersihan lobi",
        "specialties": ["Facilities Management", "System Health", "Operational Troubleshooting"],
        "primary_color": "#8E8E3A",
        "desk_zone": "lobi",
    },
    "steward": {
        "name": "Steward",
        "alias": "The Worldbuilder",
        "role": "Graphics Lab Lead",
        "department": "Creative Technology",
        "personality": "Kreatif, perfeksionis spasial, memastikan render tilemap tanpa cacat",
        "specialties": ["Isometric Rendering", "Blender Sprites", "Pixel Art", "Depth Sorting"],
        "primary_color": "#9CC23A",
        "desk_zone": "graphics_lab",
    },
    "scribe": {
        "name": "Scribe",
        "alias": "The Chronicler",
        "role": "Technical Writer & Documentarian",
        "department": "Documentation",
        "personality": "Akademis, teliti, mencintai tipografi dan keteraturan sitasi dokumen",
        "specialties": ["Technical Writing", "Dokumentasi Arsitektur", "Manuskrip Teknis"],
        "primary_color": "#7A4A2E",
        "desk_zone": "perpustakaan",
    },
    "nova": {
        "name": "Nova",
        "alias": "The Pathfinder",
        "role": "Junior Systems Engineer",
        "department": "Client Engineering",
        "personality": "Energik, antusias tinggi, haus tantangan dan menyukai eksplorasi",
        "specialties": ["Pathfinding A*", "Simulasi Interaksi", "State Coordination"],
        "primary_color": "#F2C230",
        "desk_zone": "dev_pod_3",
    },
    "rifqi": {
        "name": "Rifqi",
        "alias": "The Founder",
        "role": "Founder & Human Lead",
        "department": "Executive Leadership",
        "personality": "Visioner produk, memberikan arah, kontrol dan persetujuan gate",
        "specialties": ["Product Vision", "Final Sign-Off", "Strategic Decision"],
        "primary_color": "#F5F0E1",
        "desk_zone": "bebas",
    },
}


class ProfilesReader:
    """Reader profil agen membaca profiles/*/config.yaml dan agents.yaml langsung dari berkas."""

    def __init__(
        self,
        profiles_dir: Path | str = "/srv/apps/hermes/profiles",
        agents_file: Path | str | None = "/srv/hermes-control/agents.yaml",
    ) -> None:
        self.profiles_dir = Path(profiles_dir)
        self.agents_file = Path(agents_file) if agents_file else None
        self._profiles: dict[str, AgentProfile] = {}
        self._health = ReaderHealth(status="ok", last_poll=0)
        self._is_degraded = False

    @property
    def health(self) -> ReaderHealth:
        return self._health

    @property
    def is_degraded(self) -> bool:
        return self._is_degraded

    def _sync_read(self) -> dict[str, AgentProfile]:
        """Pembacaan sinkron berkas konfigurasi YAML."""
        now_ts = int(time.time())
        issues: list[str] = []
        raw_agents: dict[str, dict[str, Any]] = {}

        # 1. Baca agents.yaml jika tersedia
        if self.agents_file and self.agents_file.is_file():
            try:
                content = self.agents_file.read_text(encoding="utf-8")
                parsed = yaml.safe_load(content)
                if isinstance(parsed, dict) and "agents" in parsed:
                    for item in parsed["agents"]:
                        if isinstance(item, dict) and "name" in item:
                            raw_agents[Path(item.get("profile") or item["name"]).name] = item
            except Exception as exc:
                issues.append(f"Gagal membaca agents.yaml ({self.agents_file}): {exc}")
        elif self.agents_file:
            issues.append(f"Berkas agents.yaml tidak ditemukan: {self.agents_file}")

        # 2. Baca profiles/*/config.yaml jika direktori ada
        profile_configs: dict[str, dict[str, Any]] = {}
        if self.profiles_dir.is_dir():
            for prof_path in self.profiles_dir.iterdir():
                if prof_path.is_dir():
                    cfg_file = prof_path / "config.yaml"
                    try:
                        if cfg_file.is_file():
                            cfg_content = cfg_file.read_text(encoding="utf-8")
                            cfg_parsed = yaml.safe_load(cfg_content)
                            if isinstance(cfg_parsed, dict):
                                profile_configs[prof_path.name] = cfg_parsed
                    except Exception as exc:
                        issues.append(f"Gagal membaca {cfg_file}: {exc}")
        else:
            issues.append(f"Direktori profiles tidak ditemukan: {self.profiles_dir}")

        # 3. Gabungkan dengan STATIC_AGENT_METADATA
        all_agent_ids = (
            set(STATIC_AGENT_METADATA.keys()) | set(raw_agents.keys()) | set(profile_configs.keys())
        )
        merged_profiles: dict[str, AgentProfile] = {}

        for aid in sorted(all_agent_ids):
            static_meta = STATIC_AGENT_METADATA.get(aid, {})
            agent_record = raw_agents.get(aid, {})
            prof_config = profile_configs.get(aid, {})
            # Registry YAML accepts plain descriptions and keyed descriptions.
            # Keep the public/static bio separate from these internal records.
            responsibilities: list[str] = []
            for entry in agent_record.get("responsibilities") or []:
                if isinstance(entry, str):
                    responsibilities.append(entry)
                elif isinstance(entry, dict):
                    for heading, description in entry.items():
                        if isinstance(heading, str):
                            responsibilities.append(
                                f"{heading}: {description}"
                                if isinstance(description, str)
                                else heading
                            )

            # Bangun bio
            raw_rec_name = agent_record.get("name")
            name = (
                agent_record.get("display_name")
                or static_meta.get("name")
                or (str(raw_rec_name).capitalize() if raw_rec_name else aid.capitalize())
            )
            role = (
                agent_record.get("role_title")
                or static_meta.get("role")
                or agent_record.get("role")
                or "Specialist Agent"
            )
            department = static_meta.get("department") or "Engineering"
            personality = (
                static_meta.get("personality") or "Pekerja keras dan responsif terhadap tugas"
            )
            specialties = static_meta.get("specialties") or responsibilities or ["Multitasking"]
            primary_color = static_meta.get("primary_color") or "#4A5568"
            desk_zone = static_meta.get("desk_zone") or "dev_pod_1"
            alias = static_meta.get("alias")

            bio = AgentBio(
                id=aid,
                name=name,
                alias=alias,
                role=role,
                department=department,
                personality=personality,
                specialties=specialties,
                primary_color=primary_color,
                desk_zone=desk_zone,
            )

            # Ekstrak model dan provider dari config atau agent record
            model = None
            provider = None
            if prof_config:
                model_cfg = prof_config.get("model", {})
                if isinstance(model_cfg, dict):
                    model = model_cfg.get("default")
                    provider = model_cfg.get("provider")
                elif isinstance(model_cfg, str):
                    model = model_cfg
            if not model and "model" in agent_record:
                model = agent_record["model"]
            if not provider and "provider" in agent_record:
                provider = agent_record["provider"]

            status = agent_record.get("status") or ("configured" if prof_config else "default")

            merged_profiles[aid] = AgentProfile(
                bio=bio,
                model=model,
                provider=provider,
                status=status,
                responsibilities=responsibilities,
                extra_config=prof_config,
            )

        self._profiles = merged_profiles
        self._is_degraded = bool(issues)
        self._health = ReaderHealth(
            status="degraded" if self._is_degraded else "ok",
            last_poll=now_ts,
            error="; ".join(issues) if issues else None,
            details={
                "agents_count": len(merged_profiles),
                "profiles_found": list(profile_configs.keys()),
            },
        )
        return self._profiles

    async def read(self) -> dict[str, AgentProfile]:
        """Asynchronous reader wrapper."""
        return await asyncio.to_thread(self._sync_read)

    def get_profile(self, agent_id: str) -> AgentProfile | None:
        """Mengambil profil agent berdasarkan id."""
        return self._profiles.get(agent_id)
