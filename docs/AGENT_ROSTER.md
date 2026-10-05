# Roster, identitas dan peran agen Office

Snapshot repository 5 Oktober 2026. [Handoff](HANDOFF_BRE.md) dan [rencana](PROJECT_PLAN.md) adalah konteks aktif; fokus sekarang lingkungan general, bukan produksi karakter.

## Apa yang sebenarnya terdaftar

`frontend/src/world/simulation/roster.ts` berisi **17 spawn definitions: 15 AI specialist + Rifqi (Founder manusia) + satu Guest/tamu generik**. Metadata statis backend berisi 16 identitas (15 specialist + Rifqi), tanpa Guest. Komentar lama “16 specialist + Founder + Guest” pada roster tidak sesuai jumlah objek aktual. Ini inventaris **Office di repo**, bukan hasil audit registri Hermes live; task handoff tidak membaca profiles live, agents.yaml VPS, kredensial atau `.env`.

Aktor scene yang tersedia sekarang hanya **Prism, Forge dan Nova**. Kebijakan renderer menghilangkan actor yang belum punya empat idle view ilustrasi 2.5D, termasuk simulasi/reservasi kursinya. Profil dan identitas logis tetap tersimpan; menyembunyikan avatar tidak menghapus agent Hermes. Dot dan Bre adalah kolaborator eksternal pada percakapan, belum menjadi canonical agent ID/slot Office di repo.

## Tabel roster aktual

| ID | Nama | Peran frontend | Home/slot default map | Warna identitas | Avatar aktif |
| --- | --- | --- | --- | --- | --- |
| `jarvis` | Jarvis | Principal Orchestrator | Z01 (4,3) SE | `#1F3A68` | Belum tersedia; hidden |
| `daedalus` | Daedalus | System Architect | Z03 (23,3) SE | `#2F6FB3` | Belum tersedia; hidden |
| `merlin` | Merlin | Knowledge Mentor | Z04 (31,2) SW | `#B5652B` | Belum tersedia; hidden |
| `scribe` | Scribe | Documentation & Librarian | Z05 (36,4) SE | `#7A4A2E` | Belum tersedia; hidden |
| `oracle` | Oracle | Research Scientist | Z06 (6,13) SE | `#8A4FBF` | Belum tersedia; hidden |
| `muse` | Muse | Design Lead | Z07 (10,13) SE | `#E0567A` | Belum tersedia; hidden |
| `prism` | Prism | Frontend Specialist | Z08 (17,12) SE | `#2BB3C0` | Ilustrasi 2.5D |
| `forge` | Forge | Backend Specialist | Z08 (17,14) SE | `#D9622B` | Ilustrasi 2.5D |
| `nova` | Nova | Ops & Automation | Z08 (17,16) SE | `#F2C230` | Ilustrasi 2.5D |
| `steward` | Steward | Graphics & Engine Lead | Z09 (25,12) SE | `#9CC23A` | Belum tersedia; hidden |
| `sentinel` | Sentinel | QA Lead & Auditor | Z10 (29,12) SE | `#D23C3C` | Belum tersedia; hidden |
| `relay` | Relay | Release Officer | Z11 (33,12) SE | `#6D5BD0` | Belum tersedia; hidden |
| `vector` | Vector | Data Engineer | Z12 (37,13) SE | `#3FA66B` | Belum tersedia; hidden |
| `bastion` | Bastion | Security & SOC Officer | Z12 (41,13) SE | `#6B7785` | Belum tersedia; hidden |
| `warden` | Warden | Operations & Facilities | Z13 (4,25) SE | `#8E8E3A` | Belum tersedia; hidden |
| `rifqi` | Rifqi | Founder & Visionary | Z14 fallback (14,28) SE; slot belum ada | `#F5F0E1` | Belum tersedia; hidden |
| `guest` | Tamu | Pengunjung Kantor | Z08 (22,12) NE | `#9CA8B8` | Belum tersedia; hidden |

## Identitas masing-masing

Alias, department, personality dan specialties di bawah berasal dari `STATIC_AGENT_METADATA` backend. Konsep kostum awal berasal dari blueprint; konsep bukan bukti bahwa artwork sudah ada. Untuk tiga actor aktif, artwork user/Dot dan provenance lebih baru menjadi referensi visual; tidak boleh beralih ke sprite lama.

### Jarvis — `jarvis`

**Identitas:** The Orchestrator. **Peran profil:** Chief Orchestrator. **Department:** Executive Leadership.

**Persona:** Tenang, berwibawa, selalu menyebut angka dan data akurat. **Keahlian:** Orkestrasi, Perencanaan Strategis, Routing Multitasking.

Konsep awal: jas navy, tablet dan earpiece.

Default slot roster: `slot_z01_desk_jarvis`. Map: Z01, (4,3), facing SE, action `sit_type`, capacity 1.

### Daedalus — `daedalus`

**Identitas:** The Architect. **Peran profil:** Principal Systems & Data Architect. **Department:** Architecture & Core.

**Persona:** Visioner, metodis, menjunjung tinggi decoupling dan batas sistem. **Keahlian:** Arsitektur Sistem, OpenAPI, Relasional Data, Event-Driven.

Konsep awal: lengan digulung, scarf dan blueprint.

Default slot roster: `slot_z03_desk_daedalus`. Map: Z03, (23,3), facing SE, action `sit_type`, capacity 1.

### Merlin — `merlin`

**Identitas:** The Mentor. **Peran profil:** Tech Mentor & Pedagogis. **Department:** Engineering Education.

**Persona:** Sabar, bijak, gemar analogi intuitif dan pembelajaran bertahap. **Keahlian:** Mentoring, Analogi Teknis, Pedagogi Rekayasa, Review Konsep.

Konsep awal: cardigan, scarf bintang, kacamata dan janggut abu pendek.

Default slot roster: `slot_z04_whiteboard`. Map: Z04, (31,2), facing SW, action `whiteboard`, capacity 1.

### Scribe — `scribe`

**Identitas:** The Chronicler. **Peran profil:** Technical Writer & Documentarian. **Department:** Documentation.

**Persona:** Akademis, teliti, mencintai tipografi dan keteraturan sitasi dokumen. **Keahlian:** Technical Writing, Dokumentasi Arsitektur, Manuskrip Teknis.

Konsep awal: tweed/hood, chained glasses dan quill.

Default slot roster: `slot_z05_desk_scribe`. Map: Z05, (36,4), facing SE, action `sit_type`, capacity 1.

### Oracle — `oracle`

**Identitas:** Senku. **Peran profil:** Research Lead & Scientist. **Department:** Scientific Research.

**Persona:** Jenius eksentrik, hiper-logis, sangat percaya diri (probabilitas 10 miliar persen). **Keahlian:** Riset Literatur, Evaluasi Model, Penalaran Ilmiah, Eksperimen.

Konsep awal: lab coat ungu, goggles dan alat eksperimen; alias lama bukan referensi untuk meniru karakter ber-IP.

Default slot roster: `slot_z06_desk_oracle`. Map: Z06, (6,13), facing SE, action `sit_type`, capacity 1.

### Muse — `muse`

**Identitas:** The Designer. **Peran profil:** Design Engineer & UI/UX Lead. **Department:** Product Design.

**Persona:** Perfeksionis visual, ketat terhadap estetika anti-AI-slop dan presisi 1px. **Keahlian:** UI/UX Design, Design Systems, Tipografi Tabular, Color Harmony.

Konsep awal: overall dengan noda cat dan stylus.

Default slot roster: `slot_z07_desk_muse`. Map: Z07, (10,13), facing SE, action `sit_type`, capacity 1.

### Prism — `prism`

**Identitas:** The Frontend Craftsman. **Peran profil:** Frontend Specialist. **Department:** Client Engineering.

**Persona:** Cepat, berorientasi detail mikro, bangga dengan stabilitas 60 FPS. **Keahlian:** React, Zustand, TypeScript, PixiJS Integration, Web Vitals.

Aset ilustrasi user/Dot menjadi referensi identitas; hoodie spectrum/cyan dan headphones. Konsistensi sleeves pada walk masih perlu review.

Default slot roster: `slot_z08_desk_prism`. Map: Z08, (17,12), facing SE, action `sit_type`, capacity 1.

### Forge — `forge`

**Identitas:** The Blacksmith. **Peran profil:** Backend Specialist. **Department:** Core Engineering.

**Persona:** Kokoh, pragmatis, sangat menyukai integritas transaksi dan optimasi performa. **Keahlian:** Python 3.12, FastAPI, SQLite WAL, AsyncIO, ACID Persistence.

Aset ilustrasi user/Dot menjadi referensi identitas. Konsep awal: apron kerja, gloves, goggles dan hammer.

Default slot roster: `slot_z08_desk_forge`. Map: Z08, (17,14), facing SE, action `sit_type`, capacity 1.

### Nova — `nova`

**Identitas:** The Pathfinder. **Peran profil:** Junior Systems Engineer. **Department:** Client Engineering.

**Persona:** Energik, antusias tinggi, haus tantangan dan menyukai eksplorasi. **Keahlian:** Pathfinding A*, Simulasi Interaksi, State Coordination.

Aset ilustrasi user/Dot menjadi referensi identitas. Konsep awal: varsity berbintang, hairclip dan botol.

Default slot roster: `slot_z08_desk_nova`. Map: Z08, (17,16), facing SE, action `sit_type`, capacity 1.

**Perbedaan belum diselesaikan:** frontend menyebut “Ops & Automation”, profil menyebut “Junior Systems Engineer / The Pathfinder” dengan fokus pathfinding/simulasi. Jangan memilih salah satunya diam-diam atau menganggap role live Hermes sudah sama.

### Steward — `steward`

**Identitas:** The Worldbuilder. **Peran profil:** Graphics Lab Lead. **Department:** Creative Technology.

**Persona:** Kreatif, perfeksionis spasial, memastikan render tilemap tanpa cacat. **Keahlian:** Isometric Rendering, Blender Sprites, Pixel Art, Depth Sorting.

Konsep awal: coverall, VR gear dan tile belt.

Default slot roster: `slot_z09_desk_steward`. Map: Z09, (25,12), facing SE, action `sit_type`, capacity 1.

Steward berfungsi untuk graphics/engine: proyeksi, alignment, depth sorting dan konsistensi dunia; berbeda dari Muse yang fokus UI/UX dan estetika. Keputusan menghapus/menonaktifkan agent Hermes belum diambil dalam handoff ini. Blender/pixel-art pada specialties adalah metadata historis, bukan izin memulai batch render sekarang.

### Sentinel — `sentinel`

**Identitas:** The Guardian. **Peran profil:** QA Lead & Verifier. **Department:** Quality Assurance.

**Persona:** Tegas, skeptis objektif, tidak kompromi terhadap verifikasi independen. **Keahlian:** Automated Testing, Property Testing, E2E Playwright, Gate Audit.

Konsep awal: dark coat, visor dan clipboard/stamp.

Default slot roster: `slot_z10_desk_sentinel`. Map: Z10, (29,12), facing SE, action `sit_type`, capacity 1.

### Relay — `relay`

**Identitas:** The Courier. **Peran profil:** Release Engineer & Delivery. **Department:** DevOps & CI/CD.

**Persona:** Rapi, tepat waktu, memastikan hanya paket terverifikasi yang meluncur. **Keahlian:** CI/CD Pipelines, Git Automation, Package Delivery, Release Audit.

Konsep awal: courier cap/jacket dan paket.

Default slot roster: `slot_z11_desk_relay`. Map: Z11, (33,12), facing SE, action `sit_type`, capacity 1.

### Vector — `vector`

**Identitas:** The Data Master. **Peran profil:** Data Engineer. **Department:** Data & Analytics.

**Persona:** Teliti, terobsesi data bersih tanpa duplikasi dan skema terkelola. **Keahlian:** DuckDB, Data Pipelines, Lakehouse Architecture, Analytics.

Konsep awal: vest, motif arrows/cable dan tablet.

Default slot roster: `slot_z12_desk_vector`. Map: Z12, (37,13), facing SE, action `sit_type`, capacity 1.

### Bastion — `bastion`

**Identitas:** The Shield. **Peran profil:** Systems & Security Architect. **Department:** Security & SOC.

**Persona:** Waspada, security-first, memitigasi risiko sebelum insiden terjadi. **Keahlian:** Linux Hardening, Systemd Services, Zero-Write Enforcement, SOC.

Konsep awal: helmet/armor dan walkie-talkie.

Default slot roster: `slot_z12_desk_bastion`. Map: Z12, (41,13), facing SE, action `sit_type`, capacity 1.

### Warden — `warden`

**Identitas:** The Operator. **Peran profil:** Operations & Facilities Lead. **Department:** Office Operations.

**Persona:** Serbabisa, selalu siap sedia membantu dan menjaga kebersihan lobi. **Keahlian:** Facilities Management, System Health, Operational Troubleshooting.

Konsep awal: utility vest, tools dan keys.

Default slot roster: `slot_z13_desk_warden`. Map: Z13, (4,25), facing SE, action `sit_type`, capacity 1.

### Rifqi — `rifqi`

**Identitas:** The Founder. **Peran profil:** Founder & Human Lead. **Department:** Executive Leadership.

**Persona:** Visioner produk, memberikan arah, kontrol dan persetujuan gate. **Keahlian:** Product Vision, Final Sign-Off, Strategic Decision.

Founder manusia; konsep awal cream hoodie, cargo, phone dan crown.

Default slot roster: `slot_z14_lounge_1`. Slot ID ini tidak ada di map; fallback roster (14,28) SE. Perlu sinkronisasi pada tahap berikutnya.

### Tamu — `guest`

**Identitas:** tamu generik untuk interaksi kunjungan/hotdesk; tidak ada entry STATIC_AGENT_METADATA backend.

NPC tamu generik; bukan AI specialist Hermes dan belum ada artwork final.

Default slot roster: `slot_z08_desk_guest`. Map: Z08, (22,12), facing NE, action `sit_type`, capacity 1.

## Asset/action yang benar-benar ada

| Actor | Idle | Walk | sit_type | Total frame atlas |
| --- | --- | --- | --- | ---: |
| Prism | 1 tiap SE/SW/NE/NW | SE 4; SW/NE/NW masing-masing 2 | 2 tiap empat arah | 22 |
| Forge | 1 tiap empat arah | Belum ada | SE 2; tiga arah lain belum ada | 6 |
| Nova | 1 tiap empat arah | 4 tiap empat arah | 2 tiap empat arah | 28 |

Aksi lain yang belum ada menahan pose ilustrasi agent dan facing yang sama, mengutamakan pose duduk pada slot duduk. Itu substitute statis, bukan animasi game/special/talk/prayer/swim yang selesai. Tidak ada fallback karakter legacy, horizontal mirror untuk mengarang arah, atau izin produksi karakter lanjutan saat fokus foundation.

## Sumber dan ketidaksesuaian

- [Roster frontend](../frontend/src/world/simulation/roster.ts), [metadata profil backend](../backend/src/office/sources/profiles.py), [konsep karakter awal](blueprint/03-character-design-spec.md).
- [Actor render policy](../frontend/src/world/scene/ActorRoster.ts), [manifest aktif](../frontend/public/visual-migration/environment-foundation-v1/assets.json), [laporan konsistensi](visual-migration/CHARACTER_CONSISTENCY_FIX.md).
- [Snapshot JSON dari source](reference/office-facts-20261005.json): seluruh default slot, properties, source SHA dan hitungan atlas. Dapat diekspor ulang dengan `python scripts/export_office_handoff_facts.py`, tanpa memuat konfigurasi aplikasi/Hermes.
- Role Nova dan default slot Rifqi belum sinkron. Perubahan metadata/profile atau penghapusan agent di VPS memerlukan scope/instruksi terpisah; handoff ini tidak melakukannya.
