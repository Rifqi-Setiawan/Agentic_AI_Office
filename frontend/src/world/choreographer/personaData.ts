import type { PersonaAmbientConfig } from './types';

/**
 * Bobot ambient persona sesuai spesifikasi blueprint bagian 3 (Tabel Persona dan Perilaku).
 * Menentukan ke mana agen pergi saat idle. Angka adalah bobot relatif.
 */
export const PERSONA_AMBIENT_CONFIGS: Record<string, PersonaAmbientConfig> = {
  jarvis: {
    agentId: 'jarvis',
    personaName: 'Jarvis',
    activities: [
      {
        key: 'patrol_pod',
        name: 'Patroli ke pod',
        weight: 4,
        zone: 'Z08',
        slotTypes: ['dev_gaming_seat'],
        anim: 'sit_type',
      },
      {
        key: 'espresso',
        name: 'Espresso kafetaria',
        weight: 3,
        zone: 'Z14',
        slotTypes: ['counter_queue', 'cafe_seat'],
        anim: 'drink',
      },
      {
        key: 'chat_merlin',
        name: 'Ngobrol dengan Merlin',
        weight: 2,
        zone: 'Z04',
        slotTypes: ['class_seat', 'whiteboard'],
        anim: 'stand_talk',
      },
    ],
  },

  daedalus: {
    agentId: 'daedalus',
    personaName: 'Daedalus',
    activities: [
      {
        key: 'blueprint',
        name: 'Review blueprint',
        weight: 4,
        zone: 'Z03',
        slotTypes: ['blueprint_table'],
        anim: 'sit_type',
      },
      {
        key: 'pod_discuss',
        name: 'Diskusi di pod Forge/Prism',
        weight: 3,
        zone: 'Z08',
        slotTypes: ['dev_gaming_seat'],
        anim: 'sit_type',
      },
      {
        key: 'cafe',
        name: 'Kafetaria',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['cafe_seat', 'lounge_sofa'],
        anim: 'sit_type',
      },
    ],
  },

  oracle: {
    agentId: 'oracle',
    personaName: 'Oracle',
    activities: [
      {
        key: 'experiment',
        name: 'Eksperimen lab',
        weight: 5,
        zone: 'Z06',
        slotTypes: ['lab_bench'],
        anim: 'stand_talk',
      },
      {
        key: 'library',
        name: 'Rak jurnal perpustakaan',
        weight: 3,
        zone: 'Z05',
        slotTypes: ['bookshelf_browse', 'reading_chair'],
        anim: 'stand_talk',
      },
      {
        key: 'whiteboard',
        name: 'Whiteboard rumus',
        weight: 2,
        zone: 'Z06',
        slotTypes: ['whiteboard'],
        anim: 'stand_talk',
      },
    ],
  },

  merlin: {
    agentId: 'merlin',
    personaName: 'Merlin',
    activities: [
      {
        key: 'teaching',
        name: 'Mengajar di whiteboard',
        weight: 4,
        zone: 'Z04',
        slotTypes: ['whiteboard'],
        anim: 'stand_talk',
      },
      {
        key: 'library',
        name: 'Perpustakaan',
        weight: 3,
        zone: 'Z05',
        slotTypes: ['bookshelf_browse', 'reading_chair'],
        anim: 'sit_type',
      },
      {
        key: 'lounge_tea',
        name: 'Teh di lounge',
        weight: 3,
        zone: 'Z14',
        slotTypes: ['lounge_sofa', 'cafe_seat'],
        anim: 'drink',
      },
    ],
  },

  muse: {
    agentId: 'muse',
    personaName: 'Muse',
    activities: [
      {
        key: 'moodboard',
        name: 'Mood board studio',
        weight: 4,
        zone: 'Z07',
        slotTypes: ['moodboard'],
        anim: 'stand_talk',
      },
      {
        key: 'cafe',
        name: 'Kafe',
        weight: 3,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'drink',
      },
      {
        key: 'decor',
        name: 'Mengomentari dekor',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['lounge_sofa'],
        anim: 'stand_talk',
      },
    ],
  },

  prism: {
    agentId: 'prism',
    personaName: 'Prism',
    activities: [
      {
        key: 'arcade',
        name: 'Arcade game',
        weight: 4,
        zone: 'Z15',
        slotTypes: ['arcade', 'billiard', 'beanbag'],
        anim: 'stand_talk',
      },
      {
        key: 'cafe',
        name: 'Kafe santai',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'sit_type',
      },
      {
        key: 'screen_peek',
        name: 'Mengintip layar Muse',
        weight: 2,
        zone: 'Z07',
        slotTypes: ['moodboard'],
        anim: 'stand_talk',
      },
      {
        key: 'dev_pod_game',
        name: 'Main console di Dev Pod',
        weight: 2,
        zone: 'Z08',
        slotTypes: ['dev_gaming_seat'],
        anim: 'game',
      },
    ],
  },

  forge: {
    agentId: 'forge',
    personaName: 'Forge',
    activities: [
      {
        key: 'cafe',
        name: 'Kafetaria santai',
        weight: 4,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'sit_type',
      },
      {
        key: 'water_cooler',
        name: 'Angkat galon air',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['counter_queue'],
        anim: 'drink',
      },
      {
        key: 'discuss_vector',
        name: 'Diskusi dengan Vector',
        weight: 2,
        zone: 'Z12',
        slotTypes: ['rack_inspect'],
        anim: 'stand_talk',
      },
    ],
  },

  vector: {
    agentId: 'vector',
    personaName: 'Vector',
    activities: [
      {
        key: 'server_rack',
        name: 'Pemeriksaan rak server',
        weight: 4,
        zone: 'Z12',
        slotTypes: ['rack_inspect'],
        anim: 'stand_talk',
      },
      {
        key: 'data_dashboard',
        name: 'Dashboard data',
        weight: 3,
        zone: 'Z12',
        slotTypes: ['rack_inspect'],
        anim: 'sit_type',
      },
      {
        key: 'cafe',
        name: 'Kafe',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'sit_type',
      },
    ],
  },

  sentinel: {
    agentId: 'sentinel',
    personaName: 'Sentinel',
    activities: [
      {
        key: 'pod_inspect',
        name: 'Inspeksi diam-diam ke pod',
        weight: 4,
        zone: 'Z08',
        slotTypes: ['dev_gaming_seat'],
        anim: 'sit_type',
      },
      {
        key: 'library',
        name: 'Perpustakaan audit',
        weight: 2,
        zone: 'Z05',
        slotTypes: ['reading_chair', 'bookshelf_browse'],
        anim: 'sit_type',
      },
      {
        key: 'cafe',
        name: 'Kafe observasi',
        weight: 1,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'sit_type',
      },
    ],
  },

  bastion: {
    agentId: 'bastion',
    personaName: 'Bastion',
    activities: [
      {
        key: 'corridor_patrol',
        name: 'Patroli koridor & lobi',
        weight: 5,
        zone: 'Z13',
        slotTypes: ['attendance_board', 'spawn'],
        anim: 'stand_talk',
      },
      {
        key: 'soc',
        name: 'SOC & Server Security',
        weight: 4,
        zone: 'Z12',
        slotTypes: ['rack_inspect'],
        anim: 'stand_talk',
      },
      {
        key: 'pool_guard',
        name: 'Jaga keamanan kolam',
        weight: 1,
        zone: 'Z17',
        slotTypes: ['pool_lounger'],
        anim: 'sit_type',
      },
    ],
  },

  relay: {
    agentId: 'relay',
    personaName: 'Relay',
    activities: [
      {
        key: 'parcel_rack',
        name: 'Menata paket rilis',
        weight: 4,
        zone: 'Z11',
        slotTypes: ['parcel_rack'],
        anim: 'stand_talk',
      },
      {
        key: 'cafe',
        name: 'Kafe kopi cepat',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'drink',
      },
      {
        key: 'qa_dock',
        name: 'Jalan cepat ke QA',
        weight: 2,
        zone: 'Z10',
        slotTypes: ['inspect_stand'],
        anim: 'stand_talk',
      },
    ],
  },

  warden: {
    agentId: 'warden',
    personaName: 'Warden',
    activities: [
      {
        key: 'help_blocked',
        name: 'Membantu agen di pod',
        weight: 4,
        zone: 'Z08',
        slotTypes: ['dev_gaming_seat'],
        anim: 'sit_type',
      },
      {
        key: 'sweep_lobby',
        name: 'Menyapu lobi',
        weight: 2,
        zone: 'Z13',
        slotTypes: ['attendance_board'],
        anim: 'stand_talk',
      },
      {
        key: 'cafe',
        name: 'Kafe',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'sit_type',
      },
    ],
  },

  steward: {
    agentId: 'steward',
    personaName: 'Steward',
    activities: [
      {
        key: 'tile_repair',
        name: 'Memperbaiki tile glitch',
        weight: 4,
        zone: 'Z09',
        slotTypes: ['tile_repair'],
        anim: 'sit_type',
      },
      {
        key: 'graphics_lab',
        name: 'Graphics Lab inspeksi',
        weight: 3,
        zone: 'Z09',
        slotTypes: ['desk:steward'],
        anim: 'sit_type',
      },
      {
        key: 'arcade',
        name: 'Arcade istirahat',
        weight: 2,
        zone: 'Z15',
        slotTypes: ['arcade', 'billiard'],
        anim: 'stand_talk',
      },
    ],
  },

  scribe: {
    agentId: 'scribe',
    personaName: 'Scribe',
    activities: [
      {
        key: 'reading',
        name: 'Membaca buku',
        weight: 5,
        zone: 'Z05',
        slotTypes: ['reading_chair'],
        anim: 'sit_type',
      },
      {
        key: 'cafe_tea',
        name: 'Teh hangat kafe',
        weight: 2,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'drink',
      },
      {
        key: 'tidy_shelf',
        name: 'Merapikan rak buku',
        weight: 2,
        zone: 'Z05',
        slotTypes: ['bookshelf_browse'],
        anim: 'stand_talk',
      },
    ],
  },

  nova: {
    agentId: 'nova',
    personaName: 'Nova',
    activities: [
      {
        key: 'arcade',
        name: 'Arcade seru',
        weight: 4,
        zone: 'Z15',
        slotTypes: ['arcade', 'billiard', 'beanbag'],
        anim: 'stand_talk',
      },
      {
        key: 'pool',
        name: 'Kolam renang santai',
        weight: 3,
        zone: 'Z17',
        slotTypes: ['pool_swim', 'pool_lounger'],
        anim: 'sit_type',
      },
      {
        key: 'high_five',
        name: 'Main console di Dev Pod',
        weight: 3,
        zone: 'Z08',
        slotTypes: ['dev_gaming_seat'],
        anim: 'game',
      },
    ],
  },

  rifqi: {
    agentId: 'rifqi',
    personaName: 'Rifqi',
    activities: [
      {
        key: 'pool',
        name: 'Bersantai di kolam',
        weight: 4,
        zone: 'Z17',
        slotTypes: ['pool_swim', 'pool_lounger'],
        anim: 'sit_type',
      },
      {
        key: 'arcade',
        name: 'Main arcade',
        weight: 3,
        zone: 'Z15',
        slotTypes: ['arcade', 'billiard', 'beanbag'],
        anim: 'stand_talk',
      },
      {
        key: 'chat_merlin',
        name: 'Diskusi dengan Merlin',
        weight: 2,
        zone: 'Z04',
        slotTypes: ['whiteboard', 'class_seat'],
        anim: 'stand_talk',
      },
      {
        key: 'check_jarvis',
        name: 'Cek Ruang Jarvis',
        weight: 2,
        zone: 'Z01',
        slotTypes: ['sofa'],
        anim: 'sit_type',
      },
    ],
  },

  guest: {
    agentId: 'guest',
    personaName: 'Tamu',
    activities: [
      {
        key: 'cafe',
        name: 'Kafe pengunjung',
        weight: 4,
        zone: 'Z14',
        slotTypes: ['cafe_seat'],
        anim: 'sit_type',
      },
      {
        key: 'lobby',
        name: 'Lobi penerima tamu',
        weight: 3,
        zone: 'Z13',
        slotTypes: ['attendance_board'],
        anim: 'stand_talk',
      },
      {
        key: 'library',
        name: 'Melihat perpustakaan',
        weight: 2,
        zone: 'Z05',
        slotTypes: ['bookshelf_browse', 'reading_chair'],
        anim: 'sit_type',
      },
    ],
  },
};
