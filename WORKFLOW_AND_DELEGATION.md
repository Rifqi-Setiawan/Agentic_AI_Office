# Multi-Agent Workflow, Delegation Architecture, and Audit Guide

This document is the authoritative manual for understanding, operating, and manually auditing the autonomous multi-agent ecosystem powering **Agentic AI Office / Hermes Sovereign Mission Control**.

---

## 1. System Hierarchy and Authority Model

The ecosystem operates on a strict single-human authority model with a hierarchical command chain:

```text
Level 0: Founder & Supreme Authority
└── Muhammad Rifqi Setiawan (@Rifqi-Setiawan)
    │
    ▼ [Direct Command & Executive Mandate]
Level 1: Executive Suite & Orchestration
└── Jarvis (vps-boss) — Chief Orchestrator & High-Level Planner
    └── [Direct Co-Pilot] vps-assistant — Operations & Execution Utility
        │
        ├──► Division Pillar 1: Research & Science
        │    └── Senku (professor) — Distinguished Research Scientist
        │        ├── data-engineer — DuckDB Medallion Lakehouse (L1-L5)
        │        └── paperwright — IEEE LaTeX Manuscript & BibTeX Scribe
        │
        ├──► Division Pillar 2: Core Engineering & Verification
        │    └── swe-backend — Principal Server APIs & Transactional Systems
        │        └── swe-QA (swe-verifier) — Independent Quality Verification Gate
        │            └── github-manager — Global Git Release & Publication PIC
        │
        ├──► Division Pillar 3: Client Interface & Design Systems
        │    └── swe-frontend — Principal Frontend & WebGL/Canvas Engineer
        │        └── ui-designer — Principal Design Systems & Anti-Slop UI Architect
        │
        └──► Division Pillar 4: Architecture, SRE & Observability
             └── tech-mentor — Interactive Systems Tutor & Learning Partner
                 └── devops-engineer — Principal SRE, Docker, Systemd & Security
                     └── office-lead — Mission Control Cockpit & Telemetry Systems
```

---

## 2. Roster of 14 Specialized Roles & Foundation Models

| ID | Operational Identity | Primary Responsibility | Foundation Model | Authorized Boundary |
| :--- | :--- | :--- | :--- | :--- |
| **`rifqi`** | **Muhammad Rifqi Setiawan** | Founder, Strategy & Final Decision Authority | Human Intelligence | Supreme Authority |
| **`vps-boss`** | **Jarvis** | Task decomposition, planning, routing, and reporting | `ag/gemini-3.8-flash-high` | Pure Planner / Router |
| **`vps-assistant`** | **vps-assistant** | Rapid ad-hoc scripting, server maintenance, utility | `ag/gemini-3.8-flash-high` | General Workspace |
| **`senku`** | **Senku** | Literature review, first-principles research, paper synthesis | `ag/claude-opus-4-6-thinking` | Research Sandbox |
| **`data-engineer`** | **data-engineer** | DuckDB Lakehouse, Bronze/Silver/Gold pipelines | `ag/gemini-3.8-flash-high` | Data Pipelines |
| **`paperwright`** | **paperwright** | IEEE conference/journal authoring & Tectonic compilation | `ag/gemini-3.8-flash-high` | LaTeX Workspaces |
| **`swe-backend`** | **swe-backend** | FastAPI, DuckDB/PostgreSQL, transactional APIs | `ag/gemini-3.8-flash-high` | Backend Codebases |
| **`swe-verifier`** | **swe-QA** | Independent test reproduction, invariant assertion, gates | `ag/gemini-3.8-flash-high` | Independent Cleanroom |
| **`swe-frontend`** | **swe-frontend** | React, Tailwind, Vite, interactive web applications | `ag/gemini-3.8-flash-high` | Frontend Codebases |
| **`ui-designer`** | **ui-designer** | Design systems, color tokens, typography, UX mockups | `ag/gemini-3.8-flash-high` | Design Workspaces |
| **`github-manager`**| **github-manager** | Git repository publication, commit hygiene, releases | `ag/gemini-3.8-flash-high` | Version Control Gate |
| **`tech-mentor`** | **tech-mentor** | Interactive tutoring, architectural scaffolding in ID | `ag/gemini-3.8-flash-high` | Educational Dialogue |
| **`devops-engineer`**| **devops-engineer** | Systemd user units, Docker lifecycle, Caddy TLS, SRE | `ag/gemini-3.8-flash-high` | Infrastructure & Network |
| **`office-lead`** | **office-lead** | Mission Control DAG, telemetry streaming, visualizations| `cx/gpt-5.6-sol` | Virtual Office Services |

---

## 3. The Delegation Lifecycle (The DELEGATE Framework)

Every non-trivial task delegated within the system follows a formal execution contract to prevent hallucinated completion, context dilution, and premature termination:

```text
[Step 1: Ingest & Classify]
      │ (Existing Project, Enhancement, Cross-Project, Server Ops, New Project)
      ▼
[Step 2: Formal Task Contract Creation]
      │ (Measurable Goal + File Paths + Test Commands + Constraints)
      ▼
[Step 3: Worker Implementation]
      │ (swe-backend / data-engineer / swe-frontend writes code & unit tests)
      ▼
[Step 4: Independent Verification Gate (Zero Self-Approval)]
      │ (swe-QA reproduces tests in clean environment; checks boundary errors)
      ▼
[Step 5: Release Certification & Publication]
      │ (github-manager verifies diff, commits with clean attribution, pushes)
      ▼
[Step 6: Synthesized Reporting to Rifqi]
      (Jarvis delivers concise executive brief with verified metrics)
```

### The Invariable Verification Rules
1. **Rule of Separation (Zero Self-Approval):** An agent that writes code or data pipelines (`swe-backend`, `data-engineer`, `swe-frontend`) is **strictly forbidden from approving its own work**.
2. **Independent Reproduction:** `swe-QA` must independently execute the automated test suite (e.g. `pytest -v`, boundary fuzzing, status code assertions) and inspect runtime logs.
3. **No Synthetic Fallback in Production:** Data pipelines must *fail-closed* with explicit error types (`LiveIngestionError`) rather than silently synthesizing mock data.
4. **Public API Hardening:** Publicly accessible endpoints must remain strictly read-only (`GET` only). All data mutation routes are isolated into private control-plane modules.

---

## 4. Real-Time Telemetry & Synchronization Engine

The Mission Control dashboard (`https://office.rifqisetiawan.my.id/`) receives real-time execution states through a multi-tiered telemetry engine:

```text
Agent Session (Hermes CLI / Telegram)
      │
      ▼ [Every prompt, tool execution, reasoning step]
SQLite Session Database (/srv/apps/hermes/profiles/*/state.db)
      │
      ▼ [FastAPI Non-blocking Harvester: ~18ms latency]
FastAPI Telemetry Collector (src/server.py :8091)
      │
      ├── WebSocket Stream (`/ws`) ──► Real-time Node Beacon & Pulse Trigger
      ├── Server-Sent Events (`/api/v1/stream/events`) ──► Kanban & Audit DAG
      └── REST Endpoints (`/api/v1/agents/roster`) ──► 3s Background Polling Fallback
            │
            ▼
React Flow DAG + Mission Control HUD (frontend/src/)
      (Node glowing cyan/amber, animated circuit traces, active execution status)
```

### Node State Mapping
* **`IDLE` (Slate / Gray):** Agent is standing by at its station, awaiting task assignment.
* **`ACTIVE` / `THINKING` (Pulsing Emerald / Cyan Glow):** Agent is parsing prompt context or generating reasoning tokens.
* **`EXECUTING` (Glowing Border + Action Tool Label):** Agent is actively running shell tools, writing files, or executing test suites.
* **`FOUNDER` (Gold Border `#eab308`):** Supreme human authority node representing Muhammad Rifqi Setiawan.

---

## 5. Manual Audit Checklist via GitHub

When auditing repository commits, pull requests, and releases manually through GitHub, verify the following standards:

### Checklist Item 1: Commit Author Attribution
- [ ] Author and Committer are strictly:  
  `Muhammad Rifqi Setiawan <149862767+Rifqi-Setiawan@users.noreply.github.com>`
- [ ] Zero commits attributed to bot usernames, machine hostnames, or unlinked emails.

### Checklist Item 2: Public Repository Cleanliness (Anti-AI-Slop & Privacy)
- [ ] Zero leaked secrets: No API tokens, passwords, private keys, or session cookies in code or diffs.
- [ ] Clean language: No conversational LLM filler phrases in commits (e.g. *"As an AI...", "Here is the code..."*).
- [ ] Code commits follow Conventional Commits standard (`feat:`, `fix:`, `chore:`, `refactor:`).

### Checklist Item 3: Automated Test Verification
- [ ] All unit and integration tests pass cleanly (`pytest tests/ -v` returns exit code 0).
- [ ] Code additions include corresponding test fixtures that test both success paths and boundary failure modes (HTTP 404, 422, 500).

### Checklist Item 4: Architectural Integrity
- [ ] Database mutation routes remain private and protected behind control-plane barriers.
- [ ] External network calls use bounded timeouts and fail-closed exception handling.
- [ ] File and directory permissions adhere to least privilege.

---

## 6. Emergency Interventions & Administrative Commands

Should any agent process drift or require immediate manual intervention:

* **Inspect Agent Logs:**
  ```bash
  journalctl --user -u agent-cockpit.service -n 100 --no-pager
  ```
* **Verify Systemd Service Status:**
  ```bash
  systemctl --user status agent-cockpit.service
  ```
* **Direct Verification Test:**
  ```bash
  cd /srv/hermes-control/services/agent-cockpit && .venv/bin/pytest tests/ -v
  ```
* **Restart Telemetry Engine:**
  ```bash
  systemctl --user restart agent-cockpit.service
  ```

---

## Author & Governance
**Muhammad Rifqi Setiawan**  
GitHub: [@Rifqi-Setiawan](https://github.com/Rifqi-Setiawan)  
Repository: [Agentic_AI_Office](https://github.com/Rifqi-Setiawan/Agentic_AI_Office)
