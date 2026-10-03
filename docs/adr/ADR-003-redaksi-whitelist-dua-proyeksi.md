# ADR-003: Redaksi Whitelist dengan Dua Proyeksi Data (Publik dan Founder)

- **Status:** Diterima (Accepted)
- **Tanggal:** 2026-10-03 (Asia/Jakarta / WIB)
- **Penulis:** Daedalus (Principal Systems & Data Architect)
- **Stakeholder:** Forge (Backend Specialist), Sentinel (QA Lead), Bastion (Security Architect), Prism (Frontend Lead)
- **Komponen:** Proyeksi Domain & Serialisasi API (`backend/src/office/projection/`)
- **Dokumen Acuan:** `docs/blueprint/01-master-architecture.md`, `docs/blueprint/08-risk-assessment.md` (Risiko R2, R4)

---

## 1. Konteks dan Pernyataan Masalah

Office v2 dirancang untuk dapat diakses secara terbuka oleh publik melalui jaringan internet (`https://office.rifqisetiawan.my.id`). Bersamaan dengan itu, backend office membaca data operasional langsung dari runtime Hermes Agent yang sedang aktif menjalankan tugas rekayasa internal, orkestrasi sistem, riset, serta pemeliharaan infrastruktur.

Data mentah dari Hermes mengandung beragam informasi berisiko tinggi (Risiko R2):
1. **Kredensial dan Rahasia Sistem:** Prompt agen, argumen command terminal, API keys, token autentikasi, dan environment variables yang mungkin tercatat di `tasks.body`, `task_runs.metadata`, atau `task_comments`.
2. **Detail Kerentanan dan Masalah Internal:** Ringkasan error (`task_runs.error`), stack trace kegagalan, dan log internal yang mengekspos topologi infrastruktur server.
3. **Struktur Sistem File & Metadata Mesin:** Lokasi direktori internal (`workspace_path`), nama branch rahasia, PID proses Linux (`worker_pid`), serta metrik host yang terperinci.
4. **Nama Proyek dan Rencana Strategis:** Nama board privat dan judul task rahasia.

Jika data disajikan secara mentah ke publik, potensi kebocoran informasi rahasia (*information disclosure*) sangat fatal. Di sisi lain, pemilik sistem (Founder / Rifqi) memerlukan visibilitas mendalam atas pekerjaan yang sedang berlangsung tanpa harus membuka terminal atau basis data SQLite secara manual.

---

## 2. Pendorong Keputusan (Decision Drivers)

1. **Kebijakan Nol Kebocoran (Zero-Leak Policy):** Jaminan mutlak bahwa tidak ada teks rahasia, prompt, kredensial, atau detail internal yang dapat diakses oleh publik.
2. **Keterbukaan yang Aman:** Publik tetap dapat menikmati visualisasi kantor yang hidup, interaktif, dan akurat mengenai kesibukan agen tanpa mengorbankan privasi sistem.
3. **Visibilitas Operasional bagi Founder:** Founder memiliki akses penuh terhadap judul task nyata, progres tugas, branch git, dan pemantauan sistem melalui mekanisme autentikasi yang aman.
4. **Stabilitas Arsitektur Terhadap Perubahan Skema:** Penambahan field baru di database Hermes di masa depan tidak boleh secara tidak sengaja tereskpos ke publik.

---

## 3. Pilihan yang Dipertimbangkan

### Opsi 1: Proyeksi Tunggal dengan Pemfilteran Berbasis Blacklist (Denylist)
- **Deskripsi:** Backend menggunakan satu model data umum, kemudian menghapus kunci-kunci sensitif (seperti `body`, `token`, `error`, `workspace_path`) sebelum dikirimkan ke klien publik.
- **Kelebihan:** Hanya memerlukan satu set model data di backend dan satu tipe data di frontend.
- **Kekurangan:** **Sangat Rawan Kebocoran (Fatal Flaw).** Pendekatan blacklist secara inheren tidak aman. Jika Hermes menambahkan kolom baru (misal `agent_notes`, `llm_prompt`, `debug_info`), kolom tersebut otomatis lolos ke publik sebelum tim pengembang sempat memperbarui daftar denylist.
- **Status:** Ditolak Keras.

### Opsi 2: Masking / Regex Sanitization Dinamis pada Teks Output
- **Deskripsi:** Menyaring seluruh representasi JSON menggunakan aturan ekspresi reguler untuk menyensor string sensitif.
- **Kelebihan:** Dapat menangkap pola token atau API key tertentu.
- **Kekurangan:** Sangat tidak deterministik; rentan terhadap bypass pengkodean (*encoding bypass*); membutuhkan komputasi CPU intensif pada setiap payload transmisi; berisiko merusak struktur JSON.
- **Status:** Ditolak.

### Opsi 3: Strict Whitelist Dual Projection (Proyeksi Terpisah: Publik vs. Founder)
- **Deskripsi:** Menerapkan dua jalur proyeksi yang terisolasi secara struktural (*structural separation*): `PublicProjection` dan `FounderProjection`. Objek publik dibangun secara eksplisit hanya dari atribut-atribut yang diizinkan (*allowlist inclusion*), sedangkan atribut internal tidak pernah disertakan dalam definisi skema publik.
- **Kelebihan:** 
  - *Security by Design*: Secara matematis dan struktural mustahil terjadi kebocoran field baru karena schema publik tidak mengenal field tersebut.
  - Memisahkan kontrak data publik dan privat secara tegas di spesifikasi OpenAPI.
  - Memungkinkan pengujian properti otomatis berbasis token canary (`LEAK-CANARY`).
- **Status:** **Dipilih**.

---

## 4. Keputusan Arsitektur dan Spesifikasi Teknis

Ditetapkan arsitektur **Strict Whitelist Dual Projection** pada seluruh lapisan backend (`domain/state.py` dan `projection/`):

```
                       ┌────────────────────────┐
                       │  Hermes Raw SQLite DB  │
                       └───────────┬────────────┘
                                   │
                                   ▼
                       ┌────────────────────────┐
                       │   Domain Normalizer    │
                       └───────────┬────────────┘
                                   │
                                   ▼
                       ┌────────────────────────┐
                       │   In-Memory Engine     │
                       └─────┬────────────┬─────┘
                             │            │
             Request Publik  │            │ Request Founder (Auth Cookie)
                             ▼            ▼
         ┌───────────────────────┐    ┌───────────────────────┐
         │   Public Projection   │    │  Founder Projection   │
         │  (Strict Whitelist)   │    │   (Full Telemetry)    │
         └───────────┬───────────┘    └───────────┬───────────┘
                     │                            │
                     ▼                            ▼
            REST / SSE Publik             REST / SSE Founder
```

### 4.1 Aturan Redaksi Proyeksi

| Atribut / Kategori Data | Proyeksi Publik (`projection=public`) | Proyeksi Founder (`projection=founder`) |
| :--- | :--- | :--- |
| **Identitas & Lokasi Agen** | ID, Nama, Role, Zona Ruangan, Status Kehadiran (`presence`), Status Kerja (`work`), Timestamp `since`. | Sama persis dengan Publik. |
| **Nama Board / Proyek** | Hanya ditampilkan jika nama board terdaftar di `public_boards` (allowlist config); selain itu diganti string statis: `"Proyek internal"`. | Nama board asli ditampilkan secara lengkap. |
| **Judul Task** | **Disamarkan (Masked):** Diganti label kategori umum berdasarkan peran agen (misal: *"Menulis endpoint API"*, *"Review keamanan sistem"*, *"Penyusunan aset visual"*). | Judul task asli ditampilkan tanpa perubahan. |
| **Detail Tekstual (`body`, `summary`, `result`, `error`, `comments`)** | **DITIADAKAN SAMA SEKALI (Null/Omitted):** Field-field ini tidak ada dalam skema JSON publik. | Ditampilkan, namun dipotong secara aman maksimal 500 karakter untuk mencegah pemborosan bandwidth. |
| **Metadata Sistem (`workspace_path`, `branch_name`, `worker_pid`)** | **DITIADAKAN SAMA SEKALI:** Tidak pernah dikirimkan ke publik. | Ditampilkan untuk keperluan inspeksi operasional. |
| **Vitals Host (CPU, RAM, Disk)** | Persentase penggunaan dibulatkan ke integer (misal: `CPU 15%`, `RAM 42%`, `Disk 68%`) beserta status kesehatan umum (`healthy`/`warning`/`critical`). | Metrik detail: pembagian memori (MB), beban load average (1m, 5m, 15m), core count, dan uptime server. |

### 4.2 Generator Judul Tugas Berbasis Peran (Public Task Title Masking)
Pada proyeksi publik, fungsi pemetaan deterministik menggantikan judul tugas asli berdasarkan profile agen:
- `forge` → *"Pengembangan modul backend dan database"*
- `prism` → *"Pembaruan antarmuka pengguna"*
- `steward` → *"Optimasi pipeline grafis dan rendering"*
- `sentinel` → *"Verifikasi kualitas dan validasi sistem"*
- `bastion` → *"Hardening infrastruktur dan keamanan"*
- `relay` → *"Automasi CI/CD dan rilis"*
- `daedalus` → *"Perancangan arsitektur dan spesifikasi data"*
- `muse` → *"Desain visual dan tinjauan gaya"*
- `jarvis` → *"Orkestrasi alur kerja agen"*
- Karakter lainnya → *"Operasi sistem dan komputasi rutin"*

### 4.3 Verifikasi Otomatis Anti-Bocor (Property-Based Canary Testing)
1. **Penyuntikan Token Canary:** Fixture pengujian (`backend/tests/fixtures/kanban_fixture.db`) diisi dengan teks sintetis yang disematkan token unik berformat:
   `LEAK-CANARY-<UUID/HASH>` pada kolom `body`, `summary`, `result`, `error`, dan isi komentar.
2. **Pengujian Invarian Properti (Hypothesis & Pytest):**
   - Test suite memanggil endpoint publik (`/api/v1/snapshot`, `/api/v1/stream`, `/api/v1/agents/{id}`) dan melakukan serialisasi menyeluruh ke format string mentah.
   - Assert invariant: String `"LEAK-CANARY"` tidak boleh ditemukan di bagian mana pun dari respons publik.
   - Assert invariant: Tidak ada substring jalur direktori `/srv/apps/hermes` yang muncul pada respons publik.

---

## 5. Konsekuensi

### Positif:
1. **Keamanan Struktural Terjamin:** Model data terpisah menghilangkan risiko kelalaian developer saat menambahkan field database baru.
2. **Kepatuhan Privasi Penuh:** Pengunjung umum dapat memantau aktivitas tanpa risiko membaca kode rahasia atau instruksi prompt.
3. **Pengalaman Pengguna Sesuai Peran:** Founder mendapatkan visibilitas lengkap melalui otorisasi cookie aman, sementara publik disajikan tampilan yang bersih dan aman.

### Negatif dan Risiko:
1. **Dualitas Model Data:** Mengharuskan pemeliharaan dua struktur model data di backend (`Public` vs `Founder`) dan pemetaan serialisasi.
2. **Kompleksitas UI Client:** Frontend HUD harus dapat menyesuaikan tampilan tergantung apakah pengguna melihat proyeksi publik atau login sebagai Founder.

### Mitigasi Risiko:
- Struktur model didefinisikan secara hierarkis menggunakan Pydantic v2 di backend, sehingga logika transformasi terpusat pada satu modul (`projection/`).
- Skema OpenAPI mendokumentasikan kedua varian secara eksplisit, memungkinkan generator kode frontend (`openapi-typescript`) menghasilkan tipe TypeScript yang aman (*type-safe*).

---

## 6. Kepatuhan Aturan Global & Validasi

- **Audit Kontrak oleh Sentinel:** Prosedur rilis pada setiap gate fase mewajibkan Sentinel memverifikasi kelulusan tes properti anti-bocor terhadap fixture `kanban_fixture.db`.
