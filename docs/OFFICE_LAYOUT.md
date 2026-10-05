# Denah kantor aktual — Floor 1

Snapshot dari [floor1.tmj](../frontend/public/maps/floor1.tmj), 5 Oktober 2026. **44×32 tile, 17 zona, 133 slot interaksi, 26 pintu**. Dua koridor membagi tiga pita: belakang untuk berpikir/koordinasi, tengah untuk produksi, depan untuk sosial. Batas zona dan konsep dipertahankan; penataan/dekorasi final per ruang dibahas nanti. [Handoff](HANDOFF_BRE.md), [rencana](PROJECT_PLAN.md), [roster](AGENT_ROSTER.md).

![Denah canonical, panduan teknis top-down](../art/environment-foundation-2026-10-05/prompt-pack/references/09-denah-canonical.png)

Gambar adalah diagram teknis dari map, bukan screenshot browser atau target dekorasi. Peta top-down: gx meningkat ke timur, gy ke selatan. Isometric/dimetric 2:1: `screenX = 1088 + (gx - gy) * 32`, `screenY = 64 + (gx + gy) * 16`. Pada layar +gx turun-kanan, +gy turun-kiri. Tile world 64×32 logical; world presentation 2560×1440; packed assets umumnya 2×. Tinggi wall terpisah dari ukuran tile/collision.

## Ruangan dan pengguna

Koordinat di tabel inklusif. Jumlah slot adalah jumlah objek aktual pada layer slots, bukan jumlah kursi yang disimpulkan dari blueprint. Penghuni/tujuan adalah konsep identitas, bukan jumlah avatar yang sekarang tampil.

| ID | Ruang | gx | gy | Penghuni konsep | Slot aktual | Fungsi |
| --- | --- | --- | --- | --- | ---: | --- |
| Z01 | Ruang CEO | 0–9 | 0–7 | Jarvis | 6 | Koordinasi eksekutif dan observasi status. |
| Z02 | Boardroom | 10–19 | 0–7 | Rapat | 13 | Rapat lintas agen dan presentasi. |
| Z03 | Ruang Arsitektur | 20–27 | 0–7 | Daedalus | 3 | Desain arsitektur sistem/blueprint. |
| Z04 | Ruang Kelas | 28–34 | 0–7 | Merlin | 7 | Mentoring dan diskusi konsep. |
| Z05 | Perpustakaan | 35–43 | 0–7 | Scribe | 6 | Dokumentasi dan pengetahuan. |
| Z06 | Lab Riset | 0–8 | 10–19 | Oracle | 4 | Riset dan eksperimen. |
| Z07 | Studio Desain | 9–15 | 10–19 | Muse | 2 | Desain visual/UI/UX. |
| Z08 | Dev Pods | 16–23 | 10–19 | Prism, Forge, Nova | 6 | Produksi frontend/backend/simulasi; tiga staf utama dan hotdesk tamu. |
| Z09 | Graphics Lab | 24–27 | 10–19 | Steward | 2 | Grafika, engine dan worldbuilding. |
| Z10 | QA Station | 28–31 | 10–19 | Sentinel | 2 | Verifikasi kualitas dan gate. |
| Z11 | Release Dock | 32–35 | 10–19 | Relay | 3 | Pengemasan/release delivery. |
| Z12 | Data Center & SOC | 36–43 | 10–19 | Vector, Bastion | 6 | Data engineering dan Security/SOC. |
| Z13 | Lobi | 0–9 | 22–31 | Warden | 3 | Penerimaan tamu dan operasi fasilitas. |
| Z14 | Kafetaria & Lounge | 10–21 | 22–31 | Semua | 16 | Kafe, rehat dan percakapan bersama. |
| Z15 | Arcade | 22–29 | 22–31 | Semua | 8 | Area hiburan bersama. |
| Z16 | Musholla | 30–36 | 22–31 | Semua | 21 | Ruang ibadah dan wudhu. |
| Z17 | Kolam luar | 37–43 | 22–31 | Semua | 25 | Kolam/outdoor yang sudah ada di konsep. |

Total 133 slot. `corridor_north`: gx 0–43 / gy 8–9. `corridor_south`: gx 0–43 / gy 20–21. Koridor bukan zona tambahan. Layer map: floor, walls_back, walls_front, furniture, collision, slots, doors, zones. Source SHA256: `9a9bc468e345658b349923f4ae8dc696397bb929c69688b350ee74e6b610ef0e`.

## Akses dan jalur produksi

Ruang belakang Z01–Z05 terhubung ke koridor utara. Ruang produksi Z06–Z12 memiliki akses utara dan selatan. Empat portal lateral pada gy14 menghubungkan Dev Pods → Graphics Lab → QA → Release → Data/SOC. Z16/Z17 punya portal ke koridor selatan; area sosial Z13–Z15 memakai rancangan terbuka, dengan entrance luar di lobi. Navigasi mengikuti collision/door map, bukan posisi wall art.

| Door ID | Dari | Ke | (gx,gy) |
| --- | --- | --- | --- |
| `door_z01` | Z01 | corridor_north | (5,7) |
| `door_z02` | Z02 | corridor_north | (15,7) |
| `door_z03` | Z03 | corridor_north | (23,7) |
| `door_z04` | Z04 | corridor_north | (31,7) |
| `door_z05` | Z05 | corridor_north | (39,7) |
| `door_z06_north` | Z06 | corridor_north | (4,10) |
| `door_z07_north` | Z07 | corridor_north | (12,10) |
| `door_z08_north` | Z08 | corridor_north | (19,10) |
| `door_z09_north` | Z09 | corridor_north | (25,10) |
| `door_z10_north` | Z10 | corridor_north | (29,10) |
| `door_z11_north` | Z11 | corridor_north | (33,10) |
| `door_z12_north` | Z12 | corridor_north | (39,10) |
| `door_z06_south` | Z06 | corridor_south | (4,19) |
| `door_z07_south` | Z07 | corridor_south | (12,19) |
| `door_z08_south` | Z08 | corridor_south | (19,19) |
| `door_z09_south` | Z09 | corridor_south | (25,19) |
| `door_z10_south` | Z10 | corridor_south | (29,19) |
| `door_z11_south` | Z11 | corridor_south | (33,19) |
| `door_z12_south` | Z12 | corridor_south | (39,19) |
| `door_prod_z08_z09` | Z08 | Z09 | (23,14) |
| `door_prod_z09_z10` | Z09 | Z10 | (27,14) |
| `door_prod_z10_z11` | Z10 | Z11 | (31,14) |
| `door_prod_z11_z12` | Z11 | Z12 | (35,14) |
| `door_z16_north` | Z16 | corridor_south | (33,22) |
| `door_z17_north` | Z17 | corridor_south | (39,22) |
| `door_lobby_entrance` | Z13 | outside | (4,31) |

26 entry ini adalah registrasi koneksi; label from/to sendiri tidak berarti pintu satu arah. Jangan mempergeser/menghapus portal untuk mengakomodasi artwork.

## Z08 — layout Dot yang disetujui

Z08 adalah **Dev Pods**. Tiga workstation tetap untuk Prism, Forge dan Nova membentuk deretan staf. Guest memakai hotdesk kecil dengan satu laptop pada sisi ruangan, terpisah dari staf. User menyetujui “Terapkan penataan baru dari Dot”: dua standing desk diganti area sofa/TV dan dua slot gaming. Batas ruang gx 16–23 / gy 10–19 tetap. Pintu utara (19,10), selatan (19,19), dan lateral ke Z09 (23,14) tetap.

| Slot aktual | (gx,gy) | Facing | Action | Capacity | y_offset |
| --- | --- | --- | --- | ---: | ---: |
| `slot_z08_desk_prism` | (17,12) | SE | `sit_type` | 1 | -6 |
| `slot_z08_desk_forge` | (17,14) | SE | `sit_type` | 1 | -6 |
| `slot_z08_desk_nova` | (17,16) | SE | `sit_type` | 1 | -6 |
| `slot_z08_desk_guest` | (22,12) | NE | `sit_type` | 1 | -6 |
| `slot_z08_gaming_1` | (19,16) | NE | `game` | 1 | -4 |
| `slot_z08_gaming_2` | (20,16) | NE | `game` | 1 | -4 |

Untuk SE, meja/keyboard berada di depan karakter pada +gx; kursi di belakang. Front/back monitor harus sesuai arah karakter. Posisi presentasi art tidak boleh dijadikan alasan mengubah posisi logical slot. Lihat [approved-layout-adjustments](visual-migration/approved-layout-adjustments.json), [integrasi Dot Z08](visual-migration/DOT_Z08_COMPONENTS_INTEGRATION.md) dan [koreksi orientasi](visual-migration/ORIENTATION_FIX.md). Slot Guest tetap di map meskipun avatarnya belum ditampilkan.

## Dinding dan fondasi yang masih perlu diperbaiki

W01/W02 baru dipasang untuk trial di 193 modul tinggi 80 logical. **User menyatakan tinggi itu menghalangi ruangan lain dan jalan.** Tinggi tersebut belum final approved. P0: gunakan cutaway/low internal partitions dan batas belakang tinggi hanya bila interior/koridor tetap terlihat; opsi camera-aware visibility dapat diuji. Ini policy rendering, bukan perubahan denah/collision.

F01 belum dipasang karena rasio footprint 1.5311:1 perlu direvisi ke 2:1. Lantai existing tetap. Sudut, pilar, kusen, window, ambang, platform dan struktur kolam masih perlu migrasi general agar sambungan konsisten. Tema material akhir, furnitur/dekorasi tiap ruang ditunda; general foundation memakai suasana oak hangat/blue-gray/charcoal/cyan dan cahaya kiri atas.

## Authority dan verifikasi

Map serta [snapshot fact JSON](reference/office-facts-20261005.json) menjadi authority koordinat/count. Blueprint awal memberi konsep tetapi tabel jumlah furniturnya bukan hitungan slot runtime terbaru (contoh Z17 aktual 25 slot). Jangan regenerate map dari spesifikasi lama dan kehilangan exception Z08. Bila perubahan map memang diizinkan nanti, sinkronkan generator, kontrak, ledger, snapshot dan tes. Ukuran/grid/bounds/connections dipertahankan pada pekerjaan general sekarang.

Default slot roster Rifqi `slot_z14_lounge_1` tidak ada di map; fallback roster (14,28) SE. Masalah ini dicatat untuk tahap sinkronisasi berikutnya; tidak ada tambahan slot dalam handoff. Browser telah memeriksa Z08/Z01 pada trial wall, belum seluruh 17 zona. Diagram denah tidak menggantikan pemeriksaan browser/navigasi.
