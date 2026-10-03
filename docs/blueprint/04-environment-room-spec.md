# 4. Environment / Room Design Spec

V1 terdiri dari satu lantai berukuran 44×32 tile dengan 17 zona dalam tiga pita. Pita belakang untuk ruang berpikir, pita tengah untuk jalur produksi, dan pita depan untuk ruang sosial. Jalur produksi sengaja disusun berurutan, Dev Pods → QA → Release Dock → Data Center, supaya alur kerja Hermes terbaca dari tata letaknya.

```text
      0         1         2         3         4   
   gx 01234567890123456789012345678901234567890123
gy  0 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  1 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  2 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  3 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  4 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  5 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  6 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  7 AAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDEEEEEEEEE
gy  8 ============================================
gy  9 ============================================
gy 10 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 11 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 12 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 13 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 14 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 15 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 16 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 17 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 18 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 19 FFFFFFFFFGGGGGGGHHHHHHHHIIIIJJJJKKKKLLLLLLLL
gy 20 ============================================
gy 21 ============================================
gy 22 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 23 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 24 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 25 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 26 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 27 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 28 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 29 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 30 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ
gy 31 MMMMMMMMMMNNNNNNNNNNNNOOOOOOOOPPPPPPPQQQQQQQ

Legenda (1 karakter = 1 tile, utara di atas, "=" = koridor):
  A = Z01 Ruang CEO (Jarvis)
  B = Z02 Boardroom
  C = Z03 Ruang Arsitektur (Daedalus)
  D = Z04 Ruang Kelas (Merlin)
  E = Z05 Perpustakaan (Scribe)
  F = Z06 Lab Riset (Oracle)
  G = Z07 Studio Desain (Muse)
  H = Z08 Dev Pods (Prism, Forge, Nova)
  I = Z09 Graphics Lab (Steward)
  J = Z10 QA Station (Sentinel)
  K = Z11 Release Dock (Relay)
  L = Z12 Data Center & SOC (Vector, Bastion)
  M = Z13 Lobi (Warden)
  N = Z14 Kafetaria & Lounge
  O = Z15 Arcade
  P = Z16 Musholla
  Q = Z17 Kolam luar
```

Denah top-down (utara di atas). Di game, peta dirender isometrik 2:1 dengan pojok barat laut di bagian paling atas layar. Salinan denah ini juga ada di `floor-plan.txt`.

### Zona

Koordinat inklusif. `gx` naik ke timur, `gy` naik ke selatan. Koridor utara ada di `gy 8–9` dan koridor selatan di `gy 20–21`, keduanya selebar peta.

| ID | Zona | gx | gy | Penghuni | Furnitur utama | Slot interaksi |
| --- | --- | --- | --- | --- | --- | --- |
| Z01 | Ruang CEO | 0–9 | 0–7 | Jarvis | Meja eksekutif gelap, dinding 6 monitor status, sofa kulit, rak trofi | `desk:jarvis`, `sofa` ×2, `door_queue` ×3 |
| Z02 | Boardroom | 10–19 | 0–7 | Rapat | Meja oval 12 kursi, layar presentasi, dinding kaca | `meeting_seat` ×12, `presenter` ×1 |
| Z03 | Ruang Arsitektur | 20–27 | 0–7 | Daedalus | Meja blueprint miring, maket sistem mini, rak gulungan | `desk:daedalus`, `blueprint_table` ×2 |
| Z04 | Ruang Kelas | 28–34 | 0–7 | Merlin | Whiteboard besar, 6 kursi diskusi, karpet | `whiteboard` ×1, `class_seat` ×6 |
| Z05 | Perpustakaan | 35–43 | 0–7 | Scribe | Rak buku tinggi, meja tulis kayu, lampu baca hijau, mesin cetak kecil | `desk:scribe`, `bookshelf_browse` ×3, `reading_chair` ×2 |
| Z06 | Lab Riset | 0–8 | 10–19 | Oracle | Meja lab kimia, mikroskop, rak tabung, whiteboard rumus, rak jurnal | `desk:oracle`, `lab_bench` ×2, `whiteboard` ×1 |
| Z07 | Studio Desain | 9–15 | 10–19 | Muse | Meja gambar dengan tablet besar, mood board, dinding swatch warna | `desk:muse`, `moodboard` ×1 |
| Z08 | Dev Pods | 16–23 | 10–19 | Prism, Forge, Nova | 3 workstation dual-monitor + 1 pod tamu | `desk:prism`, `desk:forge`, `desk:nova`, `desk:guest`, `pair_stand` ×2 |
| Z09 | Graphics Lab | 24–27 | 10–19 | Steward | Monitor besar berisi preview office, tumpukan tile cadangan | `desk:steward`, `tile_repair` (dinamis) |
| Z10 | QA Station | 28–31 | 10–19 | Sentinel | 3 layar hasil tes, meja stempel, lampu PASS/FAIL | `desk:sentinel`, `inspect_stand` ×1 |
| Z11 | Release Dock | 32–35 | 10–19 | Relay | Rak paket, konveyor pendek ke pintu "GitHub", papan changelog | `desk:relay`, `parcel_rack` ×2 |
| Z12 | Data Center & SOC | 36–43 | 10–19 | Vector, Bastion | 6 rak server LED, dinding peta SOC, konsol alert | `desk:vector`, `desk:bastion`, `rack_inspect` ×4 |
| Z13 | Lobi | 0–9 | 22–31 | Warden | Meja resepsionis/utilitas, papan absen 15 agent, tanaman, pintu masuk | `desk:warden`, `attendance_board` ×1, `spawn` (pintu) |
| Z14 | Kafetaria & Lounge | 10–21 | 22–31 | Semua | Counter marmer, mesin espresso, 4 meja bundar, sofa lounge, papan prestasi harian | `cafe_seat` ×8, `counter_queue` ×3, `lounge_sofa` ×4 |
| Z15 | Arcade | 22–29 | 22–31 | Semua | 3 kabinet arcade, meja biliar, bean bag, lampu neon | `arcade` ×3, `billiard` ×2, `beanbag` ×3 |
| Z16 | Musholla | 30–36 | 22–31 | Semua | Karpet sajadah hijau zamrud bergaris shaf, mihrab kayu, rak Al-Qur'an, tempat wudhu | `imam` ×1, `prayer_row` ×16 (2 shaf × 8), `wudhu` ×4 |
| Z17 | Kolam (luar) | 37–43 | 22–31 | Semua | Kolam toska dengan coping, 3 kursi santai, payung, tanaman tropis | `pool_swim` (loop 6 titik), `pool_lounger` ×3 |

Furnitur generik (meja, kursi, monitor, rak buku, sofa, tanaman, lampu, counter) diambil dari Kenney Furniture Kit. Furnitur khusus dibuat sebagai model low-poly sederhana di Blender: rak server, kabinet arcade, perlengkapan lab, meja blueprint, kolam, mihrab, sajadah, whiteboard, dan konveyor.

### Aturan konstruksi

- Dinding belakang (sisi utara dan barat ruangan) digambar setinggi penuh. Dinding depan hanya setinggi 8 px (cutaway) supaya interior terlihat.
- Setiap ruangan punya satu pintu di tengah sisi yang menghadap koridor; Lobi, Kafetaria, dan Arcade terbuka tanpa pintu.
- Slot adalah objek di layer `slots` di Tiled dengan properti `type`, `capacity`, `facing` (SE/SW/NE/NW), dan `anim`. Engine membaca properti ini, jadi tidak ada koordinat hardcode di kode.
- Kolam dan musholla tidak menghapus pelat lantai; keduanya digambar sebagai cekungan dengan tepi (lesson #6 dan #8).
- Posisi karakter duduk punya `y_offset` per slot supaya tidak tenggelam di balik meja (lesson #7).

### Telemetri yang tampil di lingkungan

Vitals ditampilkan lewat perubahan ruangan, bukan hanya angka di HUD.

| Sinyal | Ambang | Perubahan di ruangan | Fase |
| --- | --- | --- | --- |
| CPU | > 80% selama 60 dtk | LED rak server berkedip cepat, kipas AC berputar, Bastion berkeringat | 2 |
| RAM | > 85% | Rak server menyala oranye, Vector mondar-mandir | 2 |
| Disk | > 85% | Kardus mulai menumpuk di Data Center | 2 |
| Task selesai hari ini | Setiap task | Angka di mesin espresso dan papan prestasi kafetaria bertambah | 1 |
| Agent `off_duty` | Status profil | Nama di papan absen lobi berwarna abu | 1 |
| Reader Hermes gagal | `healthz` merah | Lampu kantor meredup, banner "telemetri offline"; agent tetap hidup lewat ambient | 1 |

### Atmosfer

Atmosfer berganti otomatis mengikuti jam WIB, dan Founder bisa menimpanya secara manual.

| Mode | Jam WIB | Tampilan |
| --- | --- | --- |
| Siang | 05.00–15.00 | Cahaya netral hangat, bayangan pendek, jendela terang |
| Senja | 15.00–18.00 | Tint amber, bayangan panjang, lampu meja mulai menyala |
| Malam | 18.00–05.00 | Tint biru tua, cahaya monitor dan neon arcade jadi sprite additive, jendela memancar; agent idle cenderung ke lounge atau arcade |
