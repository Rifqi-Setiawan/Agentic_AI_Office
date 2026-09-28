# 03 - Integrasi VPS, staging, operasi dan rollback

## 0. Batas perubahan

Kerjakan di branch/worktree staging dari checkout yang benar-benar digunakan service. Jangan menganggap path atau port dokumentasi selalu sama dengan VPS saat ini. Jangan menghentikan crawler, menghapus session DB, menulis ulang Kanban, mengganti seluruh server.py, atau memperbarui dependency global.

Dari root checkout staging, mulai dengan pemeriksaan tanpa perubahan:

```bash
pwd
git status --short
git rev-parse HEAD
python --version
python -c 'import sqlite3; print(sqlite3.sqlite_version)'
node --version
ss -ltnp
```

Baca unit service yang sedang dipakai dan argumen Uvicorn/Vite/reverse proxy. Catat path interpreter, working directory, user, EnvironmentFile, port aktual, serta metode dispatch worker. Dokumentasi repository menyebut beberapa port berbeda pada komponen berbeda; port private baru default 18091 tidak boleh menimpa listener existing.

Baca file paket `FILE_GUIDE.md` dan cocokkan import komponen lain yang mungkin memakai AgentNodeData lama. Caller utama MissionControl mempertahankan props existing; ini bukan bukti semua import custom di VPS pasti sama dengan branch publik.

## 1. Penerapan file pada worktree

Buat backup/diff atas tiga komponen lama. Salin seluruh isi direktori frontend CommandCenter pada paket, bukan hanya tiga file TSX. File lain yang tidak ada di paket tidak perlu dihapus. Salin direktori src/mission_control baru, tests, scripts, dan kebutuhan dokumentasi sesuai kebijakan repository.

Paket tidak membawa package.json, lockfile, database produksi, .env, atau credential nyata. Gunakan dependency lockfile asli. Simpan salinan README/FILE_GUIDE paket di direktori dokumentasi upgrade, bukan otomatis menimpa README repository.

Pada root checkout staging dengan folder integration yang telah disalin:

```bash
git apply --check integration/server.py.patch
```

Jika check berhasil:

```bash
git apply integration/server.py.patch
```

Jika konteks main sudah berubah, JANGAN pakai opsi force. Sisipkan isi `integration/server.py.snippet` sebelum catch-all `app.mount("/", ...)`. Jangan memasukkan router setelah static mount karena request dapat ditangkap handler static lebih dahulu. Jangan membuat objek FastAPI kedua di src/server.py atau mengganti lifespan/collector lama.

Snippet hanya aktif bila HERMES_MC_ENABLED=1. Pastikan flag tetap tidak aktif sampai konfigurasi, SQLite dan autentikasi siap.

## 2. Dependency dan pemeriksaan SQLite

Bekerja dalam virtual environment QA/staging. Gunakan dependency runtime repository yang sudah ditinjau. Install dependency test paket hanya pada environment QA:

```bash
python -m pip install -r requirements-mission-control-test.txt
python scripts/preflight.py --repo . --production
```

Preflight memeriksa interpreter Python dan versi SQLite yang ditautkan kepadanya. Package menggunakan WAL; inisialisasi default menolak versi tanpa perbaikan WAL-reset yang diketahui. Upstream fixed 3.51.3+, dengan backport 3.44.6/3.50.7. Karena Ubuntu dapat mem-backport patch tanpa mengganti nomor upstream secara besar, cocokkan paket OS yang benar-benar ditautkan ke Python dengan advisory vendor.

`HERMES_MC_SQLITE_BACKPORT_VERIFIED=1` hanya sah setelah verifikasi backport tersebut. Jangan menggunakan flag bypass sebagai solusi error startup. `HERMES_MC_REQUIRE_PATCHED_SQLITE=0` tersedia untuk laboratorium disposable saja dan tidak dianjurkan dalam EnvironmentFile produksi.

Jangan mengganti symlink library sistem atau interpreter global secara spekulatif. Pilih environment runtime teruji dan verifikasi semua service yang membacanya. Rujukan resmi: `https://sqlite.org/wal.html`, bagian 11.

## 3. Pembuatan credential dan database baru

Perintah berikut membuat direktori konfigurasi BARU di home operator; script menolak overwrite. Ini contoh staging yang konkret, bukan instruksi menjalankan semua worker sebagai user operator:

```bash
umask 077
python scripts/bootstrap_config.py \
  --directory "$HOME/.config/hermes-mc-staging" \
  --db-path "$HOME/.local/state/hermes-mc-staging/mission-control.sqlite3"
```

Hasil: mission-control.env, actor-tokens.json, serta 15 file token individual. Ada 14 aktor hierarki termasuk Rifqi dan satu identitas service runtime-dispatcher, bukan 15 AI. Token acak dibuat saat script berjalan; tidak ada secret bawaan pada ZIP. File 0600, direktori private 0700.

Master actor-tokens.json hanya milik private control-plane. Worker menerima file token identitasnya sendiri melalui mekanisme secret existing. Dispatcher tidak menerima credential QA/release. Public read service hanya memerlukan read token, DB path, flag enable dan kebijakan SQLite; tidak perlu environment yang membocorkan semua actor token.

Pada produksi, tempatkan file dengan owner service terpercaya yang benar, di luar repo, dan gunakan EnvironmentFile/service secret mekanisme existing. Kedua proses control-plane yang berbagi DB 0600 perlu akses dengan UID trusted yang sama atau mekanisme storage yang disesuaikan secara sadar; jangan chmod 666 database untuk mengatasi permission. Worker tetap akun/container berbeda tanpa akses file DB.

Default database baru tidak menggunakan DB profil atau Kanban. Direktori DB existing harus diperiksa permission-nya; constructor tidak mengubah seluruh permission parent directory lama.

## 4. Jalankan private control-plane pada staging

Dari root checkout staging, setelah preflight lulus:

```bash
set -a
. "$HOME/.config/hermes-mc-staging/mission-control.env"
set +a
python -m uvicorn src.mission_control.control_app:app \
  --host 127.0.0.1 --port 18091 --workers 1
```

Perintah berjalan foreground untuk inspeksi; bukan daemon background tersembunyi. Pada produksi, integrasikan ke supervisor/systemd yang sudah ada melalui review devops, dengan loopback bind, UMask=0077, direktori kerja yang tepat, restart policy, serta izin read/write minimum.

Endpoint /health hanya menunjukkan proses privat hidup. Itu bukan pemeriksaan bahwa seluruh runtime terinstrumentasi. Jangan meroute 18091 atau `/internal/v1/execution/*` melalui reverse proxy Internet. Firewall tidak menggantikan bearer credential.

SDK memakai 18091 secara default. Port yang berbeda harus diberikan melalui `base_url` constructor MissionClient. Jangan memilih 8091 hanya karena muncul di dokumentasi: port tersebut dapat sudah dipakai backend existing.

## 5. Pasang read API pada backend lama

Backend lama memerlukan HERMES_MC_ENABLED=1, HERMES_MC_DB dan HERMES_MC_READ_TOKEN dengan nilai yang benar, serta kebijakan SQLite. Restart hanya instance staging setelah check import/tests berhasil. Tidak perlu menghentikan scheduler/crawler.

Public route baru harus dilindungi reverse proxy TLS yang memverifikasi pengguna. Proxy menyuntikkan `X-Hermes-Read-Token` dengan overwrite, bukan meneruskan nilai header dari client. Jangan memasang CORS global baru atau VITE_READ_TOKEN.

### Opsi Caddy

Script bootstrap dapat menghasilkan snippet Caddy berisi Basic auth dan header internal, dengan bcrypt hasil binary Caddy yang terpasang:

```bash
python scripts/bootstrap_config.py --help
```

Untuk opsi ini jalankan bootstrap satu kali dengan `--caddy-snippet --backend-port` yang sama dengan listener backend staging hasil audit. Direktori target harus baru. Import execution.caddy hasil script DI DALAM site TLS existing, sebelum fallback handle. Jangan mengganti seluruh Caddyfile atau kehilangan autentikasi route lama. Password viewer tersimpan pada viewer-password.txt 0600; script tidak mencetak secret.

Caddy meneruskan response text/event-stream dengan streaming. Snippet tidak memaksa flush_interval -1. Validasi config melalui binary Caddy dan jalankan smoke test SSE sebelum reload produksi. Untuk Nginx/proxy lain, pastikan buffering/compression tidak menahan frame dan timeout cukup panjang.

Endpoint baru bersifat GET-only. Hal ini tidak otomatis mengamankan POST /chat atau route mutasi legacy yang sudah ada: audit dan lindungi legacy route secara terpisah.

### Diagnosis snapshot/SSE tanpa menaruh secret pada argumen proses

Setelah EnvironmentFile read dimuat pada shell operator yang tepercaya, beri port backend yang benar sebagai environment HERMES_PUBLIC_LOCAL_PORT lalu jalankan kode berikut. Ia membaca credential dari environment, menolak port nonnumerik, dan tidak mencetak token:

```bash
python - <<'PY'
import json
import os
from urllib.request import Request, urlopen
port = int(os.environ['HERMES_PUBLIC_LOCAL_PORT'])
if not 1 <= port <= 65535:
    raise SystemExit('Invalid backend port')
request = Request(
    f'http://127.0.0.1:{port}/api/v1/execution/snapshot',
    headers={'Authorization': 'Bearer ' + os.environ['HERMES_MC_READ_TOKEN']},
)
with urlopen(request, timeout=10) as response:
    payload = json.load(response)
print(json.dumps({key: payload[key] for key in [
    'schema_version', 'revision', 'instrumentation_seen', 'queued_count'
]}, indent=2))
PY
```

Tidak ada event runtime berarti instrumentation_seen=false dan semua garis redup. Jangan memasukkan fixture untuk menyamarkan kondisi tersebut.

## 6. Hubungkan dispatcher riil, bukan status collector

Temukan titik runtime yang menerima mandat Rifqi, mulai memanggil worker, menerima child dispatch, memperpanjang lease, menerima hasil, timeout dan cancel. Letakkan `run_tracked` di scope pemanggilan nyata itu. API wrapper menerima callable async existing, sehingga tidak perlu mengganti implementasi scheduler.

`CallSpec` membawa span_id/mission_id/task_id/caller/callee/parent_span_id/lease_seconds. `CallContext.child(callee, task_id)` membuat child yang sah. Parent scope harus await anak atau tetap waiting sampai anak selesai. Jika dispatcher existing menyimpan queue/job out-of-process, petakan ID dan heartbeat kepada supervisor yang mengetahui liveness worker; jangan membuat loop heartbeat yang selalu hidup ketika worker sudah mati.

Contoh eksekusi wrapper yang benar-benar runnable tersedia sebagai tes di `tests/test_runtime.py`, termasuk nested coroutine, kegagalan heartbeat, exception dan cancel. Tes tersebut adalah test-double untuk store, bukan adapter yang mengklaim telah terhubung ke runtime VPS Anda.

Untuk QA/rilis, gunakan MissionClient dengan token actor yang sesuai lalu `request()` pada resource privat dan model yang ada. Bukti test dan published_ref harus berasal dari runner/publisher existing. Jangan menjalankan verify/confirm secara otomatis hanya karena sebuah span completed.

Mulai dengan shadow instrumentation: rekam event dari satu tugas yang terkendali, tanpa mengubah perilaku delegasi lama. Bandingkan span ID dan caller/callee dengan log runner, bukan dengan screenshot saja. Baru jadikan proyeksi authoritative setelah persesuaian terbukti.

## 7. Frontend, build, dan uji browser

Vite development memerlukan proxy `/api/v1/execution` ke backend dengan header read yang hanya diketahui server dev. `integration/vite.proxy.snippet.ts` memakai environment HERMES_MC_READ_TOKEN, bukan VITE_*. Import objek proxy dari file tersebut dan merge sesudah proxy lama. Default contoh target 8000: sesuaikan target dengan backend development yang benar; jangan memindahkan port service produksi demi mengikuti contoh.

Dev server harus bind loopback; proxy tersebut bukan sistem autentikasi untuk Internet. Produksi memakai same-origin authenticated TLS reverse proxy, bukan Vite dev server.

Pada checkout staging:

```bash
python -m pytest -q tests/test_mission_control.py tests/test_runtime.py tests/test_sqlite_policy.py tests/test_http_transport.py
bash scripts/test_frontend_core.sh
node scripts/check_ts_syntax.cjs
cd frontend
npm ci
npm run build
```

Kembali ke root checkout untuk browser smoke. Install Playwright dan Chromium dalam environment QA yang disetujui tim, bukan dependency runtime produksi. Jalankan `scripts/browser_smoke.py` dengan base-url staging aktual dan output directory QA. Untuk Basic auth gunakan --username dan --password-file, bukan password literal pada command line.

Script memeriksa 1920x1080, 1440x900, 1280x720, 768x1024, 390x844 serta tema gelap/terang; menggunakan fixture hanya pada browser context. Semua screenshot diberi prefix TEST_FIXTURE. Inspeksi screenshot manual tetap diperlukan untuk readability dan komposisi, dan uji terpisah harus menggunakan event riil.

## 8. Acceptance sebelum rilis

- Hierarki tepat 14 node, assistant setingkat di samping Jarvis; tidak ada emoji, teks role berulang, atau kartu membesar saat hover.
- Root + backend nyata menyalakan hanya dua edge; mulai QA menyalakan ketiga; queued tidak menyala.
- Uji fork, dua invocation pasangan sama, dua mission, failure/cancel, timeout dan restart. Replay/late event tidak menghidupkan jalur selesai.
- Uji disconnect lebih dari TTL, payload invalid, session auth habis, dan proxy menahan SSE. UI harus stale atau unauthorized, tidak 'synced' palsu.
- Seluruh compile/build dan browser smoke lulus pada dependency lockfile VPS. CSS/handle tidak bertabrakan pada lima viewport; zoom tidak mengubah geometri tree.
- Token implementer gagal ketika mencoba verify/release; token dispatcher juga gagal. Publikasi baru berstatus released setelah acknowledgement real atas digest yang telah disetujui.
- Scanner secret/diff, permission DB/token, backup restore, dan akses publik ke private API diverifikasi independen. Crawler, collector, Kanban, dan WS lama tetap berfungsi.

Jangan menandai checklist lulus hanya berdasarkan tes paket: beberapa butir memerlukan VPS, proses nyata, dan pemeriksaan browser.

## 9. Rollback

Simpan commit baseline, diff patch dan konfigurasi lama sebelum rollout. Jika UI bermasalah, kembalikan tiga komponen lama melalui version control dan nonaktifkan HERMES_MC_ENABLED pada backend. Hentikan hanya control-plane tambahan setelah runner tidak lagi bergantung pada tracking wajib. Jangan hapus DB baru atau audit log sebagai bagian rollback; arsipkan untuk rekonsiliasi.

Tidak ada migrasi destruktif terhadap DB lama, sehingga rollback UI/router tidak membutuhkan restore DB agent. Bila wrapper fail-closed sudah dipasang pada dispatcher, siapkan pengembalian hook dispatcher yang telah direview sebelum mematikan service tracking; jangan meninggalkan semua task gagal karena endpoint privat dihentikan sepihak.
