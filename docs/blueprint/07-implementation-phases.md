# 7. Implementation Phases

Pekerjaan dibagi menjadi empat fase yang masing-masing ditutup oleh gate. Fase 0 sengaja dibuat untuk membuktikan dua hal paling berisiko (kualitas art dan pembacaan SQLite) sebelum ada pembangunan besar. Durasi tidak saya tetapkan karena kecepatan agent belum diketahui. Effort per task ada di bagian 6.

```text
[Fase 0 · Fondasi: T0.1–T0.7] --G0--> [Fase 1 · MVP: T1.1–T1.23] --G1--> [Fase 2 · Persona: T2.1–T2.9] --G2--> [Fase 3 · Ekspansi: T3.1–T3.5] --G3
```

| Fase | Tujuan | Isi | Gate (syarat lanjut) |
| --- | --- | --- | --- |
| 0 — Fondasi & spike | Membuktikan arah visual dan akses data | T0.1–T0.7 | **G0:** Muse memberi GO pada spike art dan Rifqi setuju arah visual; uji SQLite 1 jam tanpa error lock di Hermes; ADR + OpenAPI disetujui Jarvis |
| 1 — MVP "Office Hidup" | Office live dengan data nyata | T1.1–T1.23 | **G1:** 16 karakter tampil; lag status ≤ 2 dtk; nol kebocoran di tes redaksi; 60 fps p95; initial load ≤ 5 MB; Sentinel PASS; Rifqi menyetujui cutover |
| 2 — Kepribadian & gimmick | Semua aktivitas di brief terlihat; office terasa hidup | T2.1–T2.9 | **G2:** 12 aktivitas di brief terlihat; reaksi event teruji; budget performa tetap PASS |
| 3 — Ekspansi | Fitur tambahan, dipilih sesuai minat | T3.1–T3.5 | **G3:** per fitur, masing-masing dengan tes redaksi publik |

Cara menjalankan dengan Hermes:

1. Ekstrak zip ke `docs/blueprint/` di repo (dikerjakan dalam T0.1).
2. Jarvis mengimpor `tasks.yaml` sebagai kartu di board `office-v2`, dengan dependensi sebagai `task_links`.
3. Hanya kartu fase aktif yang dipindah ke `ready`. Kartu fase berikutnya tetap di `todo` sampai gate fase sebelumnya PASS.
4. Setiap gate menghasilkan laporan Sentinel, lalu Jarvis meringkasnya untuk Rifqi. Keputusan visual (G0, G1) tetap butuh persetujuan Rifqi.
