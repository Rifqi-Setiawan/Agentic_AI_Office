import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('T1.7 Environment Atlas, Floor Tiles & Furniture Verification', () => {
  const jsonPath = path.resolve(__dirname, '../public/sprites/environment.json');
  const webpPath = path.resolve(__dirname, '../public/sprites/environment.webp');
  const pngPath = path.resolve(__dirname, '../public/sprites/environment.png');
  const metricsPath = path.resolve(__dirname, '../../art/pipeline/dist/environment_render_metrics.json');
  const palettePath = path.resolve(__dirname, '../../art/pipeline/palette.json');

  it('generates a valid PixiJS environment spritesheet JSON and WebP atlas', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(webpPath)).toBe(true);
    expect(fs.existsSync(pngPath)).toBe(true);

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const atlas = JSON.parse(raw);

    expect(atlas.meta).toBeDefined();
    expect(atlas.meta.image).toBe('environment.webp');
    expect(atlas.frames).toBeDefined();

    const frameCount = Object.keys(atlas.frames).length;
    expect(frameCount).toBeGreaterThanOrEqual(100);
  });

  it('enforces Acceptance Criterion 2: Total atlas lingkungan <= 2.5 MB (WebP)', () => {
    expect(fs.existsSync(webpPath)).toBe(true);
    const stats = fs.statSync(webpPath);
    const sizeBytes = stats.size;
    const sizeMB = sizeBytes / (1024 * 1024);

    // Hard ceiling: 2.5 MB = 2,621,440 bytes
    const maxBytes = 2.5 * 1024 * 1024;
    expect(sizeBytes).toBeLessThanOrEqual(maxBytes);
    expect(sizeMB).toBeLessThanOrEqual(2.5);

    // Also assert it is compact (< 500 KB in actual WebP execution)
    expect(sizeBytes).toBeLessThan(500 * 1024);
  });

  it('enforces Acceptance Criterion 1: Semua furnitur di tabel zona spec bagian 4 tersedia di atlas', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const atlas = JSON.parse(raw);
    const frames = Object.keys(atlas.frames);

    // Table Section 4 furniture verification per zone:
    const requiredZoneFurniture = {
      // Z01 Ruang CEO (Jarvis): Meja eksekutif gelap, dinding 6 monitor status, sofa kulit, rak trofi
      Z01_CEO: [
        'furniture_desk_executive.png',
        'furniture_wall_monitors_ceo.png',
        'furniture_sofa_leather.png',
        'furniture_trophy_shelf.png',
      ],
      // Z02 Boardroom (Rapat): Meja oval 12 kursi, layar presentasi, dinding kaca
      Z02_Boardroom: [
        'furniture_boardroom_table.png',
        'furniture_presentation_screen.png',
        'furniture_glass_partition.png',
      ],
      // Z03 Ruang Arsitektur (Daedalus): Meja blueprint miring, maket sistem mini, rak gulungan
      Z03_Architecture: [
        'furniture_blueprint_table.png',
        'furniture_system_model_mini.png',
        'furniture_blueprint_rack.png',
      ],
      // Z04 Ruang Kelas (Merlin): Whiteboard besar, 6 kursi diskusi, karpet
      Z04_Classroom: [
        'furniture_whiteboard.png',
        'furniture_chair_cushion.png',
        'furniture_chair_rounded.png',
      ],
      // Z05 Perpustakaan (Scribe): Rak buku tinggi, meja tulis kayu, lampu baca hijau, mesin cetak kecil
      Z05_Library: [
        'furniture_bookcase_tall.png',
        'furniture_desk.png',
        'furniture_green_reading_lamp.png',
        'furniture_printing_press.png',
        'furniture_lounge_chair.png',
      ],
      // Z06 Lab Riset (Oracle): Meja lab kimia, mikroskop, rak tabung, whiteboard rumus, rak jurnal
      Z06_ResearchLab: [
        'furniture_lab_bench.png',
        'furniture_microscope.png',
        'furniture_test_tube_rack.png',
        'furniture_whiteboard_formula.png',
        'furniture_journal_shelf.png',
      ],
      // Z07 Studio Desain (Muse): Meja gambar dengan tablet besar, mood board, dinding swatch warna
      Z07_DesignStudio: [
        'furniture_drawing_desk_tablet.png',
        'furniture_moodboard.png',
        'furniture_swatch_wall.png',
      ],
      // Z08 Dev Pods (Prism, Forge, Nova): 3 workstation dual-monitor + 1 pod tamu, pair stand
      Z08_DevPods: [
        'furniture_workstation_dev.png',
        'furniture_workstation_guest.png',
        'furniture_pair_standing_desk.png',
      ],
      // Z09 Graphics Lab (Steward): Monitor besar preview office, tumpukan tile cadangan
      Z09_GraphicsLab: [
        'furniture_large_monitor_preview.png',
        'furniture_spare_tiles_pile.png',
      ],
      // Z10 QA Station (Sentinel): 3 layar hasil tes, meja stempel, lampu PASS/FAIL
      Z10_QAStation: [
        'furniture_qa_screens.png',
        'furniture_stamp_desk.png',
        'furniture_lamp_pass_fail.png',
      ],
      // Z11 Release Dock (Relay): Rak paket, konveyor pendek ke pintu "GitHub", papan changelog
      Z11_ReleaseDock: [
        'furniture_parcel_rack.png',
        'furniture_conveyor.png',
        'furniture_changelog_board.png',
      ],
      // Z12 Data Center & SOC (Vector, Bastion): 6 rak server LED, dinding peta SOC, konsol alert
      Z12_DataCenter: [
        'furniture_server_rack.png',
        'furniture_soc_map_wall.png',
        'furniture_alert_console.png',
      ],
      // Z13 Lobi (Warden): Meja resepsionis/utilitas, papan absen 15 agent, tanaman, pintu masuk
      Z13_Lobby: [
        'furniture_reception_desk.png',
        'furniture_attendance_board.png',
        'furniture_potted_plant.png',
        'furniture_entrance_door.png',
      ],
      // Z14 Kafetaria & Lounge (Semua): Counter marmer, mesin espresso, 4 meja bundar, sofa lounge, papan prestasi harian
      Z14_Cafeteria: [
        'furniture_marble_counter.png',
        'furniture_espresso_machine.png',
        'furniture_table_round.png',
        'furniture_lounge_sofa.png',
        'furniture_achievement_board.png',
        'furniture_kitchen_fridge.png',
      ],
      // Z15 Arcade (Semua): 3 kabinet arcade, meja biliar, bean bag, lampu neon
      Z15_Arcade: [
        'furniture_arcade_cabinet.png',
        'furniture_billiard_table.png',
        'furniture_beanbag.png',
        'furniture_neon_sign.png',
      ],
      // Z16 Musholla (Semua): Karpet sajadah hijau zamrud bergaris shaf, mihrab kayu, rak Al-Qur'an, tempat wudhu
      Z16_Musholla: [
        'furniture_prayer_rug_shaf.png',
        'furniture_mihrab.png',
        'furniture_quran_shelf.png',
        'furniture_wudhu_station.png',
        'furniture_shaf_partition.png',
      ],
      // Z17 Kolam luar (Semua): Kolam toska dengan coping, 3 kursi santai, payung, tanaman tropis
      Z17_Pool: [
        'furniture_pool_basin.png',
        'furniture_pool_coping.png',
        'furniture_pool_water.png',
        'furniture_pool_lounger.png',
        'furniture_pool_umbrella.png',
        'furniture_tropical_plant.png',
      ],
    };

    for (const [zone, items] of Object.entries(requiredZoneFurniture)) {
      for (const item of items) {
        expect(frames, `Missing furniture item "${item}" for zone ${zone}`).toContain(item);
      }
    }
  });

  it('provides night glowing emission variants for monitors, screens, neon, server rack, and lamps', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const atlas = JSON.parse(raw);
    const frames = Object.keys(atlas.frames);

    const requiredNightVariants = [
      'furniture_server_rack_night.png',
      'furniture_arcade_cabinet_night.png',
      'furniture_neon_sign_night.png',
      'furniture_drawing_desk_tablet_night.png',
      'furniture_large_monitor_preview_night.png',
      'furniture_qa_screens_night.png',
      'furniture_lamp_pass_fail_night.png',
      'furniture_soc_map_wall_night.png',
      'furniture_alert_console_night.png',
      'furniture_wall_monitors_ceo_night.png',
      'furniture_presentation_screen_night.png',
      'furniture_glass_partition_night.png',
      'furniture_green_reading_lamp_night.png',
      'furniture_workstation_dev_night.png',
      'furniture_workstation_guest_night.png',
      'furniture_screen_night.png',
      'furniture_lamp_floor_night.png',
      'wall_back_window_night.png',
    ];

    for (const variant of requiredNightVariants) {
      expect(frames, `Missing night emission variant: ${variant}`).toContain(variant);
    }
  });

  it('provides floor tiles for all 17 zones, corridor, water, and night variants', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const atlas = JSON.parse(raw);
    const frames = Object.keys(atlas.frames);

    const requiredFloorTiles = [
      'tile_floor_z01_ceo.png',
      'tile_floor_z02_boardroom.png',
      'tile_floor_z03_architecture.png',
      'tile_floor_z04_classroom.png',
      'tile_floor_z05_library.png',
      'tile_floor_z06_lab.png',
      'tile_floor_z07_design.png',
      'tile_floor_z08_dev_pods.png',
      'tile_floor_z09_graphics_lab.png',
      'tile_floor_z10_qa_station.png',
      'tile_floor_z11_release_dock.png',
      'tile_floor_z12_datacenter.png',
      'tile_floor_z13_lobby.png',
      'tile_floor_z14_cafeteria.png',
      'tile_floor_z15_arcade.png',
      'tile_floor_z16_musholla.png',
      'tile_floor_z17_pool_deck.png',
      'tile_floor_corridor.png',
      'tile_floor_pool_water.png',
      'tile_floor_night_corridor.png',
      'tile_floor_night_datacenter.png',
    ];

    for (const tile of requiredFloorTiles) {
      expect(frames, `Missing floor tile: ${tile}`).toContain(tile);
    }
  });

  it('provides full-height back walls and 8px cutaway front walls', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const atlas = JSON.parse(raw);
    const frames = Object.keys(atlas.frames);

    const requiredWalls = [
      'wall_back_nw.png',
      'wall_back_ne.png',
      'wall_back_corner_n.png',
      'wall_back_doorway.png',
      'wall_back_window_day.png',
      'wall_back_window_night.png',
      'wall_front_cutaway_sw.png',
      'wall_front_cutaway_se.png',
      'wall_front_cutaway_corner_s.png',
      'wall_front_cutaway_doorway.png',
    ];

    for (const wall of requiredWalls) {
      expect(frames, `Missing wall asset: ${wall}`).toContain(wall);
    }
  });

  it('validates 32-color palette used across environment assets', () => {
    expect(fs.existsSync(palettePath)).toBe(true);
    const palette = JSON.parse(fs.readFileSync(palettePath, 'utf-8'));
    expect(palette.colors.length).toBe(32);
  });

  it('records environment rendering benchmarks and timing metrics', () => {
    expect(fs.existsSync(metricsPath)).toBe(true);
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    expect(metrics.total_sprites_rendered).toBeGreaterThanOrEqual(100);
    expect(metrics.total_render_time_seconds).toBeGreaterThan(0);
    expect(metrics.samples_per_pixel).toBe(16);
  });
});
