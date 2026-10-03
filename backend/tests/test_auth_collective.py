from __future__ import annotations

import asyncio
import time
from typing import Generator

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

from office.api.auth import (
    LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    SESSION_COOKIE_NAME,
    login_rate_limiter,
)
from office.domain.collective import DEFAULT_COLLECTIVE_TTL, CollectiveManager
from office.main import app

ph = PasswordHasher()
TEST_FOUNDER_PASSWORD = "CorrectFounderPassword2026!"
TEST_FOUNDER_HASH = ph.hash(TEST_FOUNDER_PASSWORD)


@pytest.fixture(autouse=True)
def setup_auth_environment(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    """Mengatur hash Founder di environment dan mereset rate limiter untuk setiap tes."""
    monkeypatch.setenv("OFFICE_FOUNDER_HASH", TEST_FOUNDER_HASH)
    monkeypatch.setenv("OFFICE_SESSION_SECRET", "test-secret-founder-session-key")
    monkeypatch.delenv("OFFICE_COOKIE_SECURE", raising=False)
    login_rate_limiter.reset_all()

    # Reset active collective pada state engine
    if hasattr(app.state, "engine"):
        app.state.engine.set_active_collective(None)
    if hasattr(app.state, "collective_manager"):
        app.state.collective_manager.cancel_expiry_timer()

    yield

    login_rate_limiter.reset_all()
    if hasattr(app.state, "engine"):
        app.state.engine.set_active_collective(None)
    if hasattr(app.state, "collective_manager"):
        app.state.collective_manager.cancel_expiry_timer()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def login_as_founder(client: TestClient) -> dict[str, str]:
    """Helper untuk login dan mengembalikan cookie sesi Founder."""
    resp = client.post(
        "/api/v1/auth/login",
        headers={"X-Office-Intent": "1"},
        json={"password": TEST_FOUNDER_PASSWORD},
    )
    assert resp.status_code == 200, f"Login gagal: {resp.text}"
    cookie_val = resp.cookies.get(SESSION_COOKIE_NAME)
    assert cookie_val is not None
    return {SESSION_COOKIE_NAME: cookie_val}


# ==============================================================================
# 1. Acceptance Criterion 1: POST tanpa cookie atau tanpa header -> 401/403
# ==============================================================================


class TestCsrfAndAuthProtection:
    """Verifikasi AC1: Seluruh mutasi POST wajib membawa header X-Office-Intent: 1 dan cookie."""

    def test_login_without_intent_header_returns_403(self, client: TestClient) -> None:
        """POST /api/v1/auth/login tanpa header X-Office-Intent ditolak 403 Forbidden."""
        resp = client.post("/api/v1/auth/login", json={"password": TEST_FOUNDER_PASSWORD})
        assert resp.status_code == 403
        data = resp.json()
        assert data["code"] == "FORBIDDEN"
        assert "X-Office-Intent: 1" in data["error"]

    def test_login_with_invalid_intent_header_returns_403(self, client: TestClient) -> None:
        """POST /api/v1/auth/login dengan nilai header selain '1' ditolak 403."""
        resp = client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "0"},
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert resp.status_code == 403

    def test_logout_without_intent_header_returns_403(self, client: TestClient) -> None:
        """POST /api/v1/auth/logout tanpa header X-Office-Intent ditolak 403."""
        cookies = login_as_founder(client)
        resp = client.post("/api/v1/auth/logout", cookies=cookies)
        assert resp.status_code == 403

    def test_logout_without_cookie_returns_401(self, client: TestClient) -> None:
        """POST /api/v1/auth/logout tanpa cookie sesi ditolak 401 Unauthorized."""
        resp = client.post("/api/v1/auth/logout", headers={"X-Office-Intent": "1"})
        assert resp.status_code == 401
        data = resp.json()
        assert data["code"] == "UNAUTHORIZED"

    def test_collective_without_intent_header_returns_403(self, client: TestClient) -> None:
        """POST /api/v1/collective tanpa header X-Office-Intent ditolak 403."""
        cookies = login_as_founder(client)
        resp = client.post("/api/v1/collective", cookies=cookies, json={"kind": "rapat"})
        assert resp.status_code == 403
        assert resp.json()["code"] == "FORBIDDEN"

    def test_collective_without_cookie_returns_401(self, client: TestClient) -> None:
        """POST /api/v1/collective dengan header tetapi tanpa cookie ditolak 401."""
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            json={"kind": "rapat"},
        )
        assert resp.status_code == 401
        assert resp.json()["code"] == "UNAUTHORIZED"

    def test_collective_without_cookie_and_without_header_returns_403(
        self, client: TestClient
    ) -> None:
        """POST /api/v1/collective tanpa cookie dan tanpa header ditolak 401 atau 403."""
        resp = client.post("/api/v1/collective", json={"kind": "rapat"})
        assert resp.status_code in (401, 403)

    def test_get_endpoints_do_not_require_intent_header(self, client: TestClient) -> None:
        """Endpoint GET (misal snapshot, healthz) publik tidak memerlukan header intent."""
        resp1 = client.get("/api/v1/snapshot")
        assert resp1.status_code == 200

        resp2 = client.get("/api/v1/healthz")
        assert resp2.status_code == 200


# ==============================================================================
# 2. Acceptance Criterion 2: Percobaan login ke-6 -> 429
# ==============================================================================


class TestLoginRateLimiting:
    """Verifikasi AC2: Rate limit 5 percobaan/15 mnt/IP, percobaan ke-6 menghasilkan 429."""

    def test_login_attempt_6_returns_429(self, client: TestClient) -> None:
        """5 percobaan login gagal berturut-turut menghasilkan 401, percobaan ke-6 ditolak 429."""
        ip = "192.168.1.100"
        headers = {"X-Office-Intent": "1", "X-Forwarded-For": ip}

        for attempt in range(1, 6):
            resp = client.post(
                "/api/v1/auth/login",
                headers=headers,
                json={"password": "WrongPassword123!"},
            )
            assert resp.status_code == 401, f"Percobaan {attempt} seharusnya 401"
            assert resp.json()["code"] == "INVALID_CREDENTIALS"

        # Percobaan ke-6 wajib menghasilkan 429
        resp6 = client.post(
            "/api/v1/auth/login",
            headers=headers,
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert resp6.status_code == 429
        data6 = resp6.json()
        assert data6["code"] == "TOO_MANY_ATTEMPTS"
        assert "5 percobaan per 15 menit" in data6["error"]
        assert "Retry-After" in resp6.headers
        assert int(resp6.headers["Retry-After"]) > 0

    def test_rate_limiting_isolated_per_ip(self, client: TestClient) -> None:
        """Pemblokiran rate limit pada satu IP tidak mempengaruhi IP lain."""
        ip_blocked = "10.10.10.1"
        ip_clean = "10.10.10.2"

        # Blokir ip_blocked dengan 5 percobaan
        for _ in range(5):
            client.post(
                "/api/v1/auth/login",
                headers={"X-Office-Intent": "1", "X-Forwarded-For": ip_blocked},
                json={"password": "WrongPassword!"},
            )

        resp_blocked = client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "1", "X-Forwarded-For": ip_blocked},
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert resp_blocked.status_code == 429

        # IP clean tetap dapat login dengan kredensial yang sah
        resp_clean = client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "1", "X-Forwarded-For": ip_clean},
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert resp_clean.status_code == 200
        assert resp_clean.json()["success"] is True

    def test_rate_limiting_resets_after_window(self) -> None:
        """Setelah jendela waktu 15 menit (900 detik) berlalu, percobaan kembali diizinkan."""
        base_time = 100000.0
        ip = "172.16.0.5"

        # 5 percobaan pada waktu base_time
        for _ in range(5):
            allowed, _ = login_rate_limiter.check_and_record(ip, now=base_time)
            assert allowed is True

        # Percobaan ke-6 pada waktu yang sama ditolak
        allowed, retry_after = login_rate_limiter.check_and_record(ip, now=base_time)
        assert allowed is False
        assert retry_after == LOGIN_RATE_LIMIT_WINDOW_SECONDS

        # Maju waktu melebihi 15 menit
        future_time = base_time + LOGIN_RATE_LIMIT_WINDOW_SECONDS + 1
        allowed_future, _ = login_rate_limiter.check_and_record(ip, now=future_time)
        assert allowed_future is True


# ==============================================================================
# 3. Autentikasi Founder dan Pengelolaan Sesi
# ==============================================================================


class TestFounderAuthLifecycle:
    """Pengujian verifikasi Argon2, cookie itsdangerous 7 hari, dan alur login/logout."""

    def test_login_missing_founder_hash_env_returns_500(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Jika OFFICE_FOUNDER_HASH tidak disetel di environment, server mengembalikan 500."""
        monkeypatch.delenv("OFFICE_FOUNDER_HASH", raising=False)
        resp = client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "1"},
            json={"password": "any_password"},
        )
        assert resp.status_code == 500
        assert resp.json()["code"] == "CONFIG_ERROR"

    def test_login_success_sets_session_cookie(self, client: TestClient) -> None:
        """Login sukses mengembalikan 200, expires_at 7 hari, dan Set-Cookie HttpOnly."""
        start_ts = int(time.time())
        resp = client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "1"},
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["role"] == "founder"
        # 7 hari = 604.800 detik
        assert data["expires_at"] >= start_ts + 604800 - 5

        # Periksa atribut Set-Cookie header
        set_cookie_header = resp.headers.get("set-cookie", "")
        assert SESSION_COOKIE_NAME in set_cookie_header
        assert "HttpOnly" in set_cookie_header
        assert "samesite=strict" in set_cookie_header.lower()
        assert "Max-Age=604800" in set_cookie_header

    def test_cookie_secure_attribute_when_https(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Cookie menyertakan flag Secure saat HTTPS aktif atau di environment produksi."""
        monkeypatch.setenv("OFFICE_COOKIE_SECURE", "true")
        https_client = TestClient(app, base_url="https://office.rifqisetiawan.my.id")
        resp = https_client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "1", "X-Forwarded-Proto": "https"},
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert resp.status_code == 200
        set_cookie_header = resp.headers.get("set-cookie", "")
        assert "Secure" in set_cookie_header

    def test_logout_clears_cookie_and_ends_session(self, client: TestClient) -> None:
        """Logout menghapus cookie sesi dan request terlindungi berikutnya mengembalikan 401."""
        login_resp = client.post(
            "/api/v1/auth/login",
            headers={"X-Office-Intent": "1"},
            json={"password": TEST_FOUNDER_PASSWORD},
        )
        assert login_resp.status_code == 200
        token = login_resp.cookies.get(SESSION_COOKIE_NAME)
        assert token is not None

        # Panggil logout dengan cookie dan header intent
        logout_resp = client.post(
            "/api/v1/auth/logout",
            headers={"X-Office-Intent": "1"},
            cookies={SESSION_COOKIE_NAME: token},
        )
        assert logout_resp.status_code == 200
        assert logout_resp.json()["success"] is True

        # Akses endpoint Founder tanpa cookie (atau cookie kedaluwarsa) ditolak 401
        protected_resp = client.get("/api/v1/snapshot?projection=founder")
        assert protected_resp.status_code == 401


# ==============================================================================
# 4. Acceptance Criterion 3: Event Kolektif dan Berakhir Otomatis Setelah TTL
# ==============================================================================


class TestCollectiveEvents:
    """Verifikasi AC3: POST /api/v1/collective untuk rapat, break, sholat dan auto-expire TTL."""

    def test_trigger_rapat_default_ttl(self, client: TestClient) -> None:
        """Memicu rapat menggunakan TTL default 10 menit (600 detik)."""
        cookies = login_as_founder(client)
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "rapat"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["kind"] == "rapat"
        assert data["title"] == "Rapat Mendadak"
        assert data["active"] is True
        assert data["expires_at"] - data["started_at"] == DEFAULT_COLLECTIVE_TTL["rapat"]
        assert isinstance(data["participants"], list)
        assert len(data["participants"]) > 0

        # Periksa snapshot dunia kantor
        snap_resp = client.get("/api/v1/snapshot")
        assert snap_resp.status_code == 200
        snap_data = snap_resp.json()
        assert snap_data["active_collective"] is not None
        assert snap_data["active_collective"]["kind"] == "rapat"

    def test_trigger_break_default_ttl(self, client: TestClient) -> None:
        """Memicu break menggunakan TTL default 10 menit (600 detik)."""
        cookies = login_as_founder(client)
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "break"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["kind"] == "break"
        assert data["title"] == "Break Time"
        assert data["expires_at"] - data["started_at"] == DEFAULT_COLLECTIVE_TTL["break"]

    def test_trigger_sholat_default_ttl(self, client: TestClient) -> None:
        """Memicu sholat menggunakan TTL default 5 menit (300 detik)."""
        cookies = login_as_founder(client)
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "sholat"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["kind"] == "sholat"
        assert data["title"] == "Sholat Berjamaah"
        assert data["expires_at"] - data["started_at"] == DEFAULT_COLLECTIVE_TTL["sholat"]

    def test_trigger_conflict_while_active_returns_409(self, client: TestClient) -> None:
        """Memicu event baru saat event lain masih aktif menghasilkan 409 Conflict."""
        cookies = login_as_founder(client)
        resp1 = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "rapat"},
        )
        assert resp1.status_code == 200

        # Event kedua ditolak 409
        resp2 = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "sholat"},
        )
        assert resp2.status_code == 409
        assert resp2.json()["code"] == "COLLECTIVE_ACTIVE"

    def test_trigger_invalid_kind_returns_400(self, client: TestClient) -> None:
        """Jenis event yang tidak valid ditolak 400 Bad Request."""
        cookies = login_as_founder(client)
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "karaoke"},
        )
        assert resp.status_code == 422 or resp.status_code == 400

    def test_trigger_custom_title_and_participants(self, client: TestClient) -> None:
        """Judul kustom dan daftar partisipan spesifik dihormati."""
        cookies = login_as_founder(client)
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={
                "kind": "rapat",
                "title": "Evaluasi Arsitektur Sprint",
                "participants": ["jarvis", "forge", "prism"],
                "duration_seconds": 120,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Evaluasi Arsitektur Sprint"
        assert data["participants"] == ["jarvis", "forge", "prism"]
        assert data["expires_at"] - data["started_at"] == 120

    def test_event_expires_automatically_passive_time(self, client: TestClient) -> None:
        """Event kolektif otomatis berakhir setelah melampaui TTL pada pembacaan snapshot."""
        cookies = login_as_founder(client)
        resp = client.post(
            "/api/v1/collective",
            headers={"X-Office-Intent": "1"},
            cookies=cookies,
            json={"kind": "sholat", "duration_seconds": 300},
        )
        assert resp.status_code == 200
        coll_data = resp.json()
        expires_at = coll_data["expires_at"]

        # Pada waktu sekarang, event masih aktif
        engine = app.state.engine
        assert engine.get_active_collective() is not None

        # Evaluasi dengan current_time setelah expires_at
        future_snapshot = engine.get_snapshot(current_time=expires_at + 1)
        assert future_snapshot.active_collective is None

        # Linimasa mencatat event collective_ended
        recent_events = future_snapshot.recent_events
        ended_events = [e for e in recent_events if e.kind == "collective_ended"]
        assert len(ended_events) >= 1

    @pytest.mark.asyncio
    async def test_event_expires_automatically_realtime_async(self) -> None:
        """Background worker asinkron mengakhiri event dan memancarkan collective_ended."""
        engine = app.state.engine
        broadcaster = app.state.broadcaster
        manager = CollectiveManager(engine=engine, broadcaster=broadcaster)

        # Mulai event dengan durasi sangat singkat (0.15 detik) untuk pengetesan
        coll = await manager.start_event(kind="sholat", duration_seconds=1)
        assert manager.get_active() is not None
        assert coll.active is True

        # Akhiri manual atau tunggu worker
        await asyncio.sleep(1.05)

        # Setelah 1.05 detik, event berakhir otomatis
        assert manager.get_active() is None
        ended_events = [e for e in engine.ring_buffer.get_recent() if e.kind == "collective_ended"]
        assert len(ended_events) >= 1


# ==============================================================================
# 5. Penyiaran SSE untuk Semua Viewer (Publik Melihat Event Kolektif)
# ==============================================================================


class TestCollectiveSseBroadcast:
    """Memastikan event kolektif disiarkan ke subscriber SSE (publik dan founder)."""

    @pytest.mark.asyncio
    async def test_collective_broadcast_to_subscribers(self) -> None:
        """Subscriber SSE menerima event 'collective' dan 'event' saat dimulai dan berakhir."""
        engine = app.state.engine
        broadcaster = app.state.broadcaster
        manager = CollectiveManager(engine=engine, broadcaster=broadcaster)

        # Daftarkan subscriber penonton publik
        subscriber_queue = broadcaster.register_subscriber()

        try:
            # Picu event kolektif
            coll = await manager.start_event(
                kind="rapat",
                duration_seconds=600,
                title="Rapat Koordinasi Global",
            )

            # Baca pesan dari queue subscriber
            received_messages: list[str] = []
            for _ in range(2):
                msg = await asyncio.wait_for(subscriber_queue.get(), timeout=1.0)
                received_messages.append(msg)

            # Pesan pertama: status collective
            assert any("event: collective" in m for m in received_messages)
            assert any(coll.id in m for m in received_messages)

            # Pesan kedua: linimasa collective_started
            assert any("event: event" in m for m in received_messages)
            assert any("collective_started" in m for m in received_messages)

            # Akhiri event
            await manager.end_event(coll.id)

            ended_messages: list[str] = []
            for _ in range(2):
                msg = await asyncio.wait_for(subscriber_queue.get(), timeout=1.0)
                ended_messages.append(msg)

            # Pesan penutupan: status collective null
            assert any("event: collective\nid:" in m and "null" in m for m in ended_messages)
            # Pesan linimasa collective_ended
            assert any("collective_ended" in m for m in ended_messages)

        finally:
            broadcaster.unregister_subscriber(subscriber_queue)
