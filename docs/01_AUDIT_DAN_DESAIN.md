# 01 - Audit repository dan desain perbaikan

## Lingkup dan batas audit

File publik branch `main` dibaca pada 28 September 2026, termasuk ExecutionGraph, CustomAgentNode, MissionControl, App, server, dependency frontend/backend, Vite config, dan WORKFLOW_AND_DELEGATION. Audit ini bukan inspeksi filesystem VPS, runtime agent, maupun browser dashboard yang sedang live. Commit SHA checkout lokal belum ditetapkan.

## Temuan yang dapat dibuktikan dari kode

### A. Aktivitas node disalahartikan sebagai delegasi

`ExecutionGraph.tsx` lama menggunakan OR antara sumber/target, ditambah special case yang menyalakan edge root saat agen mana pun aktif. Satu status kerja tidak memuat siapa pemanggilnya. Karena itu, mengganti OR dengan AND pun tidak menyelesaikan masalah: dua agen bisa aktif pada tugas yang tidak berkaitan.

Perbaikan: edge adalah proyeksi invocation yang memiliki caller, callee, mission_id, task_id, span_id, parent_span_id, state dan lease. Status roster tidak digunakan sebagai bukti relasi.

### B. Ada overlap horizontal yang bisa dihitung

Pada posisi lama, `paperwright.x = 260`, `swe-verifier.x = 410`, pada baris yang sama; kartu lama memiliki lebar 260. Interval horizontalnya bertumpang tindih 110 unit. Ini perhitungan geometri dari sumber, bukan klaim hasil screenshot.

Tinggi kartu lama tidak tetap dan bertambah ketika teks aktivitas muncul. Jarak vertikal tech-mentor/devops hanya 165 unit. Hal ini menimbulkan risiko tambahan saat isi berubah; overlap aktual kedua kartu tersebut pada viewport tertentu belum diukur melalui browser.

### C. Hierarki informasi terlalu padat

Nama, judul, model, dan aktivitas memakai truncate; status ACTIVE dan RUNNING muncul bersamaan. `state !== 'idle'` juga menganggap state gagal/offline sebagai aktif. Hover membesarkan ukuran visual kartu, yang memperburuk ruang sempit.

### D. Vitals dan sinkronisasi dapat memberi kesan palsu

MissionControl lama menampilkan angka fallback load, RAM, uptime, serta label sinkronisasi statis. Pengganti menampilkan 'Tidak tersedia' bila nilai hilang dan menentukan freshness hanya dari snapshot yang tervalidasi.

### E. Telemetry lama belum menjadi bukti kausal yang memadai

Server telah mempunyai beberapa endpoint delegasi dan telemetry; ini bukan proyek tanpa collector. Namun broadcast `/ws` yang dipakai UI hanya membawa perubahan status agen, tanpa span parent/child yang dibutuhkan pencahayaan presisi. Endpoint `/chat` yang ditinjau membroadcast pesan, bukan membuktikan worker menerima dan menjalankan tugas. Hook delegasi baru harus ditempatkan pada dispatcher nyata atau event runtime terstruktur yang setara.

## Desain pengganti

### Dimensi dan grid

Semua kartu memakai width=264, height=124, border-box. Koordinat Y adalah `24 + level * 224`. Lebar antarcabang mengikuti slot tetap, bukan panjang konten. Nama singkat, mandat satu baris, dan satu status ditempatkan di kartu; model dan detail pekerjaan berada dalam inspector dengan wrapping.

Tidak ada emoji pada definisi node. `cleanText` membuang karakter pictographic, regional indicators, variation selector dan kontrol terkait pada teks dinamis. Tidak ada hover scale, model fiktif, atau duplikasi status.

### Routing Manhattan yang disengaja

Empat cabang Jarvis memiliki source handle berbeda. Cabang luar berbelok pada offset 32 dari sisi bawah kartu; cabang dalam pada offset 68. Ini bukan satu shared bus yang kebetulan menimpa jalur lainnya. Cabang Senku memakai dua port terpisah. Assistant menggunakan handle kanan Jarvis ke handle kiri assistant pada baris sama.

`CircuitEdge.tsx` membentuk polyline orthogonal lalu membulatkan sudut dengan kurva kuadratik radius 8. `BaseEdge` mempertahankan mekanisme SVG/marker React Flow. Tidak digunakan klaim bahwa `smoothstep` sendiri adalah obstacle-avoidance router.

Tes core memeriksa rectangle kartu beserta gutter, segmen yang masuk kartu lain, crossing, dan overlap antarsemen. Routing dihitung dari geometri yang sama dengan rendering. Browser masih harus mengonfirmasi hasil aktual, termasuk ukuran font dan pengukuran handle.

### Organisasi tidak sama dengan trace

Pohon organisasi menjawab 'siapa bertanggung jawab kepada siapa'. Trace menjawab 'siapa benar-benar memanggil siapa pada satu invocation'. Keduanya tidak selalu identik.

Contoh QA frontend adalah `swe-frontend -> swe-verifier`, bukan otomatis melalui swe-backend. Pengganti menampilkan relasi nyata itu pada bagian lintas divisi, tanpa menyalakan edge backend yang tidak terjadi. Untuk drill-down mendatang, gunakan tampilan trace terpisah yang node-nya invocation, bukan memaksakan semua interaksi ke pohon 14 aktor.

Rework QA ke implementer dapat menghasilkan siklus pada graf aktor, tetapi tidak pada ancestry invocation jika span baru dipakai. Algoritma layout statis ini sengaja menjamin pohon resmi, bukan sembarang graf lintas divisi.

### Responsif tanpa mengubah geometri

Canvas memenuhi sisa tinggi viewport. Sidebar desktop 336/300 px dan dapat scroll. Di bawah 900 px, sidebar berada di bawah canvas. Auto-fit mengikuti resize sampai pengguna pan/zoom; tombol 100% tersedia agar kartu dibaca tanpa memaksakan 14 kartu penuh pada layar telepon. Tidak ada klaim bahwa seluruh tree tetap terbaca sekaligus pada 390 px.

### Keputusan yang tidak diambil

Tidak menambah Redis, Kafka, Kubernetes, engine layout generik, database vector, agent baru, atau polling ulang crawler. Sistem ini membutuhkan causal event kecil dan state gate yang tegas; menambah komponen terdistribusi belum dibenarkan oleh roster 13 worker saja. Evaluasi skala berdasarkan ukuran event dan jumlah viewer, bukan jumlah ikon.

## Rujukan primer

- Audit graf: `https://raw.githubusercontent.com/Rifqi-Setiawan/Agentic_AI_Office/main/frontend/src/components/CommandCenter/ExecutionGraph.tsx`
- Audit kartu: `https://raw.githubusercontent.com/Rifqi-Setiawan/Agentic_AI_Office/main/frontend/src/components/CommandCenter/CustomAgentNode.tsx`
- Audit dashboard: `https://raw.githubusercontent.com/Rifqi-Setiawan/Agentic_AI_Office/main/frontend/src/components/CommandCenter/MissionControl.tsx`
- Audit server: `https://raw.githubusercontent.com/Rifqi-Setiawan/Agentic_AI_Office/main/src/server.py`
- Custom edges/handles: `https://reactflow.dev/learn/customization/custom-edges`
- Context propagation: `https://opentelemetry.io/docs/concepts/context-propagation/`

Semua keputusan dimensi, lane, dan bentuk UI di atas adalah rancangan paket ini, bukan kutipan standar universal desain.
