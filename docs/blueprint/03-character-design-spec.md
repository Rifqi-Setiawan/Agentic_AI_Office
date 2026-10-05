> **Status 5 Oktober 2026:** konsep identitas/persona di bawah dipertahankan. Jalur produksi Quaternius/Blender, dua arah + mirror dan kuota frame lama telah digantikan ilustrasi 2.5D empat arah asli. Avatar aktif hanya Prism/Forge/Nova; karakter lain hidden tanpa legacy fallback, bukan dihapus dari profil. Produksi karakter ditunda sampai foundation selesai. Lihat [roster aktual](../AGENT_ROSTER.md) dan [handoff](../HANDOFF_BRE.md).

---

# 3. Agent Character Design Spec

Setiap karakter harus bisa dikenali dari siluetnya pada tinggi 48 px. Karena itu, pembeda utamanya adalah satu aksesori besar (helm, celemek, jas lab, tabung blueprint) ditambah satu warna khas. Wajah dan detail kecil hanya bonus.

### Sistem paper-doll

- **Badan dasar:** tiga varian dari rig Quaternius dengan proporsi chibi (tulang kepala diskala 1,6×, kaki dipendekkan). Base A = sedang, Base B = ramping, Base C = besar.
- **Lapisan di Blender:** badan → rambut atau penutup kepala → kostum → aksesori → prop di tangan. Variasi warna lewat material swap, lalu semua lapisan dirender bersama jadi satu sprite sheet per karakter. Komposisi dilakukan saat build, bukan di runtime.
- **Animasi wajib V1** (2 arah + mirror): `idle`, `walk` (6 frame), `sit_type`, `stand_talk`, `celebrate`, `pray` (berdiri, rukuk, sujud, duduk), `drink`.
- **Animasi Fase 2:** `swim`, `game`, `whiteboard`, ditambah satu animasi kerja khas per karakter (kolom Gerak khas).
- **Penanda:** badge task nyata (ikon kecil + denyut) hanya muncul saat `work = working`. Rifqi punya mahkota kecil emas yang melayang.

### Visual dan zona

| Karakter | Base | Kostum & aksesori pembeda | Warna khas | Prop | Gerak khas | Zona rumah |
| --- | --- | --- | --- | --- | --- | --- |
| Jarvis | A | Jas navy tiga potong, dasi emas tipis, earpiece | `#1F3A68` | Tablet | Tangan di belakang punggung, melirik jam tangan | Ruang CEO |
| Daedalus | B | Kemeja lengan digulung, syal arsitek, tabung blueprint di punggung | `#2F6FB3` | Jangka besar | Membingkai udara dengan jari | Ruang Arsitektur |
| Oracle (Senku) | A | Jas lab putih panjang beraksen ungu, goggles bulat di dahi, saku penuh tabung reaksi, rambut gelap acak-acakan | `#8A4FBF` | Tabung reaksi berasap | Menunjuk ke atas saat "eureka" | Lab Riset |
| Merlin | A | Kardigan, syal bermotif bintang, kacamata bulat, rambut & janggut abu pendek | `#B5652B` | Tongkat penunjuk berujung kilau | Mengelus janggut, mengangguk pelan | Ruang Kelas |
| Muse | B | Overall denim penuh noda cat, stylus di telinga, anting swatch warna | `#E0567A` | Tablet gambar | Membingkai dengan dua tangan, menggeser "1 px" | Studio Desain |
| Prism | A | Hoodie gelap dengan garis spektrum di lengan, headphone besar | `#2BB3C0` | Keyboard mekanik | Mengetik sangat cepat, memutar kursi saat build | Dev Pod 1 |
| Forge | C | Celemek kulit pandai besi, sarung tangan tebal, kacamata las di dahi | `#D9622B` | Palu kecil di sabuk | Mengetuk meja seperti menempa | Dev Pod 2 |
| Vector | B | Rompi lapangan bermotif panah, topi, gulungan kabel di bahu | `#3FA66B` | Tablet grafik | Menghitung dengan jari, mengusap layar | Data Center |
| Sentinel | A | Mantel panjang abu gelap, visor hitam | `#D23C3C` | Papan klip + stempel PASS/FAIL | Menyipitkan mata, mengetuk papan klip | QA Station |
| Bastion | C | Helm taktis berlampu, rompi armor pelat, perisai kecil di punggung | `#6B7785` | Walkie-talkie | Patroli sambil menoleh kiri-kanan | SOC |
| Relay | A | Jaket kurir, topi kurir, tas selempang penuh paket | `#6D5BD0` | Paket berlabel | Jalan cepat, menempel label | Release Dock |
| Warden | A | Rompi utilitas penuh kantong, sabuk alat, gantungan kunci besar | `#8E8E3A` | Kotak perkakas | Mengeluarkan alat acak dari kantong | Meja Utilitas (Lobi) |
| Steward | A | Overall pekerja, kacamata VR di dahi, sabuk berisi blok tile mini | `#9CC23A` | Tile yang melayang | "Memasang" tile ke lantai | Graphics Lab |
| Scribe | B | Kerudung, blazer tweed, kacamata berantai | `#7A4A2E` | Pena bulu + tumpukan kertas | Membetulkan kacamata, mencelup pena | Perpustakaan |
| Nova | B | Jaket varsity bergambar bintang, jepit rambut bintang, sepatu kets | `#F2C230` | Botol minum | Lompat kecil, high-five | Dev Pod 3 |
| Rifqi | A | Hoodie krem, celana cargo, earphone; kaos + celana pendek saat di kolam | `#F5F0E1` | Ponsel | Peregangan, melambai ke agent | Bebas |

Kombinasi warna harus divalidasi Muse untuk kontras di mode siang dan malam (task T0.5). Di HUD, warna tidak pernah jadi satu-satunya pembeda; selalu ada nama dan ikon.

### Persona dan perilaku

Bobot ambient menentukan ke mana agent pergi saat `idle`. Angka adalah bobot relatif.

| Karakter | Persona | Ambient favorit (bobot) | Reaksi selesai | Reaksi blocked / gagal |
| --- | --- | --- | --- | --- |
| Jarvis | Tenang, berwibawa, selalu menyebut angka | Patroli ke pod 4, espresso 3, ngobrol dengan Merlin 2 | Merapikan dasi | Menerima agent yang blocked di pintunya |
| Daedalus | Visioner, metodis | Review blueprint 4, diskusi di pod Forge/Prism 3, kafe 2 | Menggulung blueprint dengan puas | Menghapus diagram, menggambar ulang |
| Oracle | Jenius eksentrik, sangat percaya diri | Eksperimen 5, rak jurnal perpustakaan 3, whiteboard 2 | Asap warna-warni dari tabung | Tabung meletup kecil, rambut jadi berantakan |
| Merlin | Sabar, gemar analogi | Mengajar di whiteboard 4, perpustakaan 3, teh di lounge 3 | Bintang kecil berkilau dari tongkat | Menghela napas lalu menulis analogi baru |
| Muse | Perfeksionis visual | Mood board 4, kafe 3, mengomentari dekor 2 | Memasang swatch baru di mood board | Merobek sketsa |
| Prism | Cepat, detail, bangga dengan 60 fps | Arcade 4, kafe 2, mengintip layar Muse 2 | Kursi berputar 360° | Menatap konsol merah, menepuk dahi |
| Forge | Kokoh, "dibuat untuk tahan lama" | Kafe 4, angkat galon air 2, diskusi dengan Vector 2 | Mengangkat palu ke atas | Percikan api kecil di meja |
| Vector | Teliti, terobsesi data bersih | Rak server 4, dashboard data 3, kafe 2 | Grafik naik di tabletnya | Menyusun ulang kabel dengan panik |
| Sentinel | Tegas, skeptis, tidak bisa disuap | Inspeksi diam-diam ke pod 4, perpustakaan 2, kafe 1 | Stempel hijau PASS | Stempel merah FAIL (Fase 2) |
| Bastion | Waspada, security-first | Patroli koridor 5, SOC 4, kolam (jaga) 1 | Mengangguk, walkie "clear" | Lampu helm berkedip merah, lari ke rak server |
| Relay | Rapi, tidak ada yang rilis tanpa tanda tangannya | Menata paket 4, kafe 2, jalan cepat ke QA 2 | Paket berangkat di konveyor | Paket ditahan dengan pita kuning |
| Warden | Serbabisa, selalu siap | Membantu agent yang blocked 4, menyapu lobi 2, kafe 2 | Jempol ke atas | Membongkar kotak perkakas |
| Steward | Kreatif, perfeksionis visual | Memperbaiki tile "glitch" 4, Graphics Lab 3, arcade 2 | Tile berkilau saat terpasang | Tile berkedip error di tangannya |
| Scribe | Akademis, cinta tipografi | Membaca 5, kafe (teh) 2, merapikan rak 2 | Menumpuk manuskrip rapi | Kertas berhamburan |
| Nova | Energik, ingin membuktikan diri | Arcade 4, kolam 3, high-five agent lain 3 | Lompat sambil kepalan ke udara | Garuk kepala, lalu lari ke Merlin |
| Rifqi | Santai, penasaran | Kolam 4, arcade 3, ngobrol dengan Merlin 2, cek Jarvis 2 | Bertepuk tangan | Menghampiri agent yang gagal |

### Dialog bank (contoh V1)

Placeholder diisi backend dengan data aman: `{proyek}` (nama board dari allowlist), `{n}` (task selesai hari ini), `{durasi}`, `{agent}`. Bank lengkap minimal 6 baris per state per agent (task T1.16).

| Karakter | Saat kerja | Saat selesai | Saat blocked / gagal | Ambient |
| --- | --- | --- | --- | --- |
| Jarvis | "Semua jalur terpantau. {n} task tuntas hari ini." | "Satu lagi selesai. Saya laporkan ke Rifqi." | "Siapa yang menunggu keputusan? Masuk." | "Kopi dulu, lalu briefing." |
| Daedalus | "Layer ini harus decoupled. Event-driven, bukan direct call." | "Blueprint final. Tidak ada dependensi melingkar." | "Asumsinya runtuh. Gambar ulang." | "Kantor ini butuh satu koridor lagi." |
| Oracle | "Hipotesis sedang diuji. Probabilitasnya 10 miliar persen." | "Terbukti. Logika tidak pernah bohong." | "Data kurang. Ilmuwan tidak menebak." | "Kenapa espresso ini pahit? Ada penjelasan kimianya." |
| Merlin | "Bayangkan ini seperti dapur restoran..." | "Nah, sekarang konsepnya sudah utuh." | "Kita mundur satu langkah. Apa yang sebenarnya ditanya?" | "Ada yang mau kuis singkat?" |
| Muse | "Spacing-nya kurang 4 px." | "Bersih. Tidak ada slop." | "Ini terlihat seperti template. Ulang." | "Warna dinding ini perlu dikurangi saturasinya." |
| Prism | "Re-render tiga kali per frame? Tidak di jam kerjaku." | "60 fps stabil. Kirim." | "Konsol merah semua..." | "Satu ronde lagi di arcade." |
| Forge | "Endpoint ini butuh idempotency key." | "Semua 200 OK. Dibuat untuk tahan lama." | "Migrasi gagal. Rollback dulu." | "Galon kosong lagi. Siapa yang habiskan?" |
| Vector | "Bronze ke silver jalan. Jangan ada null." | "Gold layer siap. Zero duplicate." | "Skemanya berubah tanpa ADR!" | "Rak 3 sedikit hangat hari ini." |
| Sentinel | "Saya cek ulang dari nol. Bukan dari laporanmu." | "PASS. Untuk kali ini." | "FAIL. Kembalikan ke pembuatnya." | "Saya cuma lewat. Lanjutkan saja." |
| Bastion | "Firewall diaudit. Semua port tercatat." | "Layanan hijau. Clear." | "Ada yang jatuh. Saya ke sana." | "Patroli koridor selatan." |
| Relay | "Commit dirapikan, atribusi dicek." | "Siap kirim. Paket berangkat." | "Tertahan sampai QA bilang PASS." | "Label paket ini miring." |
| Warden | "Siap laksanakan." | "Beres. Tinggal review." | "Butuh bantuan? Saya bawa perkakas." | "Lobi bersih, papan absen terisi." |
| Steward | "Lantai ini saya pasang ulang, jangan diinjak dulu." | "Render stabil. Tidak ada tile bocor." | "Ada tile yang glitch. Sebentar." | "Kantor ini rumah kita. Harus rapi." |
| Scribe | "Referensi ke-12 belum lengkap DOI-nya." | "Manuskrip terkompilasi. Zero unresolved references." | "BibTeX-nya rusak. Lagi." | "Bau buku lama itu menenangkan." |
| Nova | "Gas! Ini bisa selesai sebelum makan siang." | "Lulus semua tes! Sentinel, giliranmu." | "Hmm... Merlin, ada waktu sebentar?" | "Siapa mau balapan ke kolam?" |
| Rifqi | — | — | — | "Woi Jarvis, gimana progres hari ini?" |

### Aturan bubble

- Maksimal 3 bubble tampil bersamaan, masing-masing 4 dtk, dengan cooldown 20 dtk per agent.
- Urutan prioritas: event Founder > gagal > blocked > selesai > mulai kerja > ambient.
- Bubble ambient hanya muncul untuk agent yang sedang berada di area pandang kamera.
