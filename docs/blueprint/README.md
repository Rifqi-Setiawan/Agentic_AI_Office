# Blueprint awal — baca bersama handoff terbaru

Blueprint 3 Oktober memberi landasan konsep/arsitektur. Untuk melanjutkan gunakan [HANDOFF_BRE](../HANDOFF_BRE.md), [plan](../PROJECT_PLAN.md), [roster](../AGENT_ROSTER.md), [denah aktual](../OFFICE_LAYOUT.md) dan art bible 5 Oktober. User terbaru mengizinkan push branch, memprioritaskan lingkungan general, menunda karakter/dekorasi, dan mengkritik wall tinggi yang menutup pandangan. Layout Z08 Dot sudah disetujui dan tercatat pada approved-layout-adjustments; map aktual menjadi authority koordinat. Aturan lama Blender/pixel art/mirror/kuota frame dan slice gate digantikan instruksi baru. Import Kanban/deploy/cutover dari contoh di bawah tidak diotorisasi oleh handoff ini.

---

# Office v2 — Blueprint (untuk agent Hermes)

Paket ini adalah spesifikasi lengkap untuk membangun ulang office virtual di office.rifqisetiawan.my.id.
Isinya sudah disepakati dengan Rifqi pada 3 Oktober 2026. Ringkasan keputusannya ada di `00-keputusan-dan-asumsi.md`.

## Isi

| File | Isi | Pembaca utama |
| --- | --- | --- |
| `00-keputusan-dan-asumsi.md` | Jawaban klarifikasi Rifqi + asumsi desain | Semua |
| `01-master-architecture.md` | Arsitektur, model domain, turunan status, kontrak API, redaksi, keamanan | Forge, Daedalus, Bastion, Prism |
| `02-tech-stack.md` | Stack + justifikasi, konvensi isometrik, budget performa | Semua engineer |
| `03-character-design-spec.md` | 16 karakter: visual, warna, persona, bobot ambient, reaksi, dialog, aturan bubble | Steward, Muse, Nova, Merlin |
| `04-environment-room-spec.md` | 17 zona + koordinat, furnitur, slot, aturan konstruksi, telemetri lingkungan, atmosfer | Daedalus, Steward, Warden |
| `05-feature-prioritization.md` | 36 fitur (MoSCoW), event kolektif, easter egg | Jarvis, semua |
| `06-task-decomposition.md` | Tabel 44 task + jalur kritis | Jarvis |
| `07-implementation-phases.md` | Fase 0–3, gate G0–G3, cara menjalankan di Hermes | Jarvis, Sentinel |
| `08-risk-assessment.md` | 15 risiko + mitigasi + PIC | Jarvis, Sentinel |
| `tasks.yaml` | Sumber utama task: body, acceptance criteria, dependensi | Jarvis (impor ke Kanban) |
| `floor-plan.txt` | Denah ASCII 44x32, 1 karakter = 1 tile | Daedalus (peta Tiled) |

## Cara pakai (untuk Jarvis)

1. Simpan folder ini di repo sebagai `docs/blueprint/` (bagian dari task T0.1).
2. Impor `tasks.yaml` ke board `office-v2`:
   - `title` → `tasks.title`; `body` + daftar `acceptance` → `tasks.body` (Markdown, acceptance sebagai checklist).
   - `assignee` → `tasks.assignee`; `priority` → `tasks.priority` (sesuaikan arah skala bila konvensi Hermes berbeda).
   - Setiap item `depends_on` → baris `task_links` (parent = dependensi, child = task ini).
   - Simpan ID blueprint (mis. `T1.4`) di awal judul kartu supaya mudah dilacak.
3. Hanya kartu fase aktif yang masuk `ready`. Fase berikutnya tetap `todo` sampai gate fase sebelumnya PASS (lihat 07).
4. Setelah setiap gate, ringkas laporan Sentinel untuk Rifqi. Persetujuan visual di G0 dan G1 wajib dari Rifqi.

## Aturan yang berlaku untuk semua task

- Kode office tidak boleh menulis apa pun ke `/srv/apps/hermes/**`.
- PIC tidak boleh meng-approve hasilnya sendiri. Verifikasi gate dilakukan Sentinel.
- Office v1 (port 8091) tidak boleh diganggu sampai cutover di T1.23.
- Semua aset pihak ketiga harus CC0 atau berlisensi jelas, dan dicatat di `LICENSES.md`. Tidak boleh meniru karakter atau desain berhak cipta.
- Teks UI dan dialog memakai Bahasa Indonesia. Waktu ditampilkan dan dihitung dalam Asia/Jakarta.
- Kalau spec bertentangan atau ambigu, catat sebagai komentar di kartu, lalu lanjutkan dengan tafsiran paling konservatif. Jangan diam-diam mengubah scope.
