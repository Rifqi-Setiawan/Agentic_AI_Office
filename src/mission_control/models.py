"""Validated write contracts. No prompts, credentials, or tool output in telemetry."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

AGENTS = (
    "rifqi", "vps-boss", "vps-assistant", "professor", "swe-backend",
    "swe-frontend", "tech-mentor", "data-engineer", "paperwright",
    "swe-verifier", "ui-designer", "devops-engineer", "github-manager", "office-lead",
)
ALIASES = {"jarvis": "vps-boss", "senku": "professor", "swe-qa": "swe-verifier"}
IMPLEMENTERS = set(AGENTS) - {"rifqi", "vps-boss", "swe-verifier", "github-manager"}
OPEN_STATES = ("queued", "running", "waiting")
ACTIVE_STATES = ("running", "waiting")
TERMINAL_STATES = ("completed", "failed", "cancelled", "expired")
Key = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")]
Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Lease = Annotated[int, Field(ge=5, le=300)]


def agent_id(value: str) -> str:
    value = ALIASES.get(value.strip().lower(), value.strip().lower())
    if value not in AGENTS:
        raise ValueError("Unknown canonical agent identity")
    return value


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SpanCreate(Contract):
    event_id: Key
    span_id: Key
    mission_id: Key
    task_id: Key
    parent_span_id: Key | None = None
    caller: str
    callee: str
    lease_seconds: Lease = 30

    @field_validator("caller", "callee")
    @classmethod
    def canonical_agent(cls, value: str) -> str:
        return agent_id(value)

    @model_validator(mode="after")
    def not_self(self):
        if self.caller == self.callee:
            raise ValueError("A delegation must have two different actors")
        if self.span_id == self.parent_span_id:
            raise ValueError("A span cannot parent itself")
        return self


class SpanTransition(Contract):
    event_id: Key
    expected_version: Annotated[int, Field(ge=0)]
    state: Literal["running", "waiting", "completed", "failed", "cancelled"]
    lease_seconds: Lease = 30


class SpanHeartbeat(Contract):
    event_id: Key
    expected_version: Annotated[int, Field(ge=0)]
    lease_seconds: Lease = 30


class TaskCreate(Contract):
    event_id: Key
    task_id: Key
    mission_id: Key
    goal: Annotated[str, Field(min_length=8, max_length=1000)]
    implementers: Annotated[list[str], Field(min_length=1, max_length=10)]
    acceptance_criteria: Annotated[list[Annotated[str, Field(min_length=3, max_length=500)]], Field(min_length=1, max_length=20)]
    allowed_paths: Annotated[list[Annotated[str, Field(min_length=1, max_length=300)]], Field(min_length=1, max_length=30)]
    test_commands: Annotated[list[list[Annotated[str, Field(min_length=1, max_length=300)]]], Field(min_length=1, max_length=20)]
    deadline_at_ms: Annotated[int, Field(gt=0)]
    max_attempts: Annotated[int, Field(ge=1, le=10)] = 3
    budget_usd: Annotated[float, Field(gt=0, le=10000, allow_inf_nan=False)]

    @field_validator("implementers")
    @classmethod
    def valid_implementers(cls, values: list[str]) -> list[str]:
        ids = [agent_id(value) for value in values]
        if len(set(ids)) != len(ids) or not set(ids) <= IMPLEMENTERS:
            raise ValueError("Implementers must be unique and separate from planner, verifier, release manager and human")
        return ids

    @field_validator("allowed_paths")
    @classmethod
    def relative_paths(cls, values: list[str]) -> list[str]:
        for value in values:
            if value.startswith(("/", "\\")) or ".." in value.replace("\\", "/").split("/") or "\x00" in value:
                raise ValueError("Paths must be workspace-relative without traversal")
        return values

    @field_validator("test_commands")
    @classmethod
    def argv_lists(cls, values: list[list[str]]) -> list[list[str]]:
        if any(not argv or len(argv) > 40 for argv in values):
            raise ValueError("Each command must be a nonempty argv list, at most 40 arguments")
        return values


class TaskMutation(Contract):
    event_id: Key
    expected_version: Annotated[int, Field(ge=0)]
    artifact_digest: Digest


class ArtifactSubmit(TaskMutation):
    pass


class Verification(TaskMutation):
    verdict: Literal["approved", "rejected"]
    tests_exit_code: Annotated[int, Field(ge=0, le=255)]
    evidence_digest: Digest
    evidence_ref: Key

    @model_validator(mode="after")
    def approval_requires_pass(self):
        if self.verdict == "approved" and self.tests_exit_code != 0:
            raise ValueError("A nonzero test exit code cannot be approved")
        return self


class ReleaseAuthorize(TaskMutation):
    pass


class ReleaseConfirm(TaskMutation):
    authorization_id: Key
    published_ref: Annotated[str, Field(pattern=r"^[a-f0-9]{40}$|^[a-f0-9]{64}$")]
