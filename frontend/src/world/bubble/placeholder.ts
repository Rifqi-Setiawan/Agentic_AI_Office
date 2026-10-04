import type { PlaceholderContext } from './types';

const KNOWN_PEER_AGENTS: Record<string, string> = {
  jarvis: 'Merlin',
  daedalus: 'Forge',
  oracle: 'Merlin',
  merlin: 'Jarvis',
  muse: 'Prism',
  prism: 'Muse',
  forge: 'Daedalus',
  vector: 'Forge',
  sentinel: 'Relay',
  bastion: 'Sentinel',
  relay: 'Bastion',
  warden: 'Jarvis',
  steward: 'Muse',
  scribe: 'Daedalus',
  nova: 'Merlin',
  rifqi: 'Jarvis',
};

/**
 * Format durasi detik ke dalam representasi Bahasa Indonesia yang alami.
 */
export function formatDurationIndonesian(durationSec: number): string {
  if (durationSec <= 0) {
    return 'tempo singkat';
  }
  const sec = Math.round(durationSec);
  if (sec < 60) {
    return `${Math.max(1, sec)} detik`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min} menit`;
  }
  const hr = Math.floor(min / 60);
  const remainingMin = min % 60;
  if (remainingMin === 0) {
    return `${hr} jam`;
  }
  return `${hr} jam ${remainingMin} menit`;
}

/**
 * Menggantikan seluruh placeholder dalam template dialog dengan data aman
 * berdasarkan mode proyeksi (public vs founder).
 *
 * Sesuai Acceptance Criteria:
 * - Placeholder kosong tidak pernah tampil mentah ({proyek})
 * - Whitelist placeholder: {proyek}, {n}, {durasi}, {agent}
 */
export function resolvePlaceholders(
  template: string,
  context: PlaceholderContext = {},
): string {
  if (!template) return '';

  const mode = context.mode ?? 'public';
  const agentId = (context.agentId ?? '').toLowerCase();

  // 1. Resolusi {proyek}
  let resolvedProject = '';
  if (context.projectName && context.projectName.trim()) {
    resolvedProject = context.projectName.trim();
  } else if (context.task?.board && context.task.board.trim()) {
    resolvedProject = context.task.board.trim();
  }

  // Jika nama proyek kosong atau tidak tersedia, berikan fallback kontekstual yang aman
  if (!resolvedProject) {
    resolvedProject = mode === 'founder' ? 'office-v2' : 'proyek';
  }

  // 2. Resolusi {n} (jumlah tugas selesai hari ini)
  let resolvedN = '';
  if (typeof context.doneToday === 'number' && !isNaN(context.doneToday)) {
    resolvedN = String(context.doneToday);
  } else {
    resolvedN = 'beberapa';
  }

  // 3. Resolusi {durasi}
  let resolvedDuration = '';
  if (typeof context.duration === 'string' && context.duration.trim()) {
    resolvedDuration = context.duration.trim();
  } else if (typeof context.duration === 'number' && !isNaN(context.duration)) {
    resolvedDuration = formatDurationIndonesian(context.duration);
  } else {
    resolvedDuration = 'beberapa menit';
  }

  // 4. Resolusi {agent}
  let resolvedAgent = '';
  if (context.peerAgentName && context.peerAgentName.trim()) {
    resolvedAgent = context.peerAgentName.trim();
  } else {
    resolvedAgent = KNOWN_PEER_AGENTS[agentId] || 'Forge';
  }

  // Eksekusi penggantian string aman
  let result = template
    .replaceAll('{proyek}', resolvedProject)
    .replaceAll('{n}', resolvedN)
    .replaceAll('{durasi}', resolvedDuration)
    .replaceAll('{agent}', resolvedAgent);

  // Universal Sanitization Pass:
  // Memastikan tidak ada token kurung kurawal mentah {placeholder} yang bocor ke UI
  if (result.includes('{')) {
    result = result.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
      const lower = token.toLowerCase();
      if (lower === 'proyek') return resolvedProject || 'proyek';
      if (lower === 'n') return resolvedN || '1';
      if (lower === 'durasi') return resolvedDuration || 'beberapa menit';
      if (lower === 'agent') return resolvedAgent || 'rekan tim';
      return '';
    });
  }

  return result.trim();
}
