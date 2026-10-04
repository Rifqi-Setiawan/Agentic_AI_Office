import rawDialogData from '../../content/dialog.id.json';

export type DialogState =
  | 'working'
  | 'done'
  | 'blocked'
  | 'failed'
  | 'ambient'
  | 'collective';

export type DialogBankData = Record<string, Partial<Record<DialogState, string[]>>>;

export const dialogBank: DialogBankData = rawDialogData as unknown as DialogBankData;

/**
 * Mengambil seluruh variasi baris dialog untuk agen dan state tertentu.
 */
export function getDialogLines(agentId: string, state: DialogState | string): readonly string[] {
  const normalizedId = agentId.toLowerCase();
  const normalizedState = state.toLowerCase() as DialogState;

  const agentDialogs = dialogBank[normalizedId];
  if (agentDialogs && agentDialogs[normalizedState] && agentDialogs[normalizedState]!.length > 0) {
    return agentDialogs[normalizedState]!;
  }

  return [];
}

/**
 * Mengambil satu baris dialog acak untuk agen dan state yang diminta.
 * Jika tidak ditemukan, mengembalikan template fallback yang aman.
 */
export function getRandomDialogLine(
  agentId: string,
  state: DialogState | string,
  randomFn: () => number = Math.random,
): string {
  const lines = getDialogLines(agentId, state);
  if (lines.length > 0) {
    const idx = Math.floor(randomFn() * lines.length);
    return lines[Math.min(idx, lines.length - 1)];
  }

  // Fallback kontekstual aman jika agent atau state belum terdaftar
  switch (state) {
    case 'working':
      return 'Sedang mengerjakan tugas di {proyek}.';
    case 'done':
      return 'Tugas di {proyek} telah selesai dalam {durasi}.';
    case 'blocked':
      return 'Menunggu koordinasi dengan {agent}.';
    case 'failed':
      return 'Ada kendala pada eksekusi di {proyek}.';
    case 'collective':
      return 'Mengikuti kegiatan bersama tim di kantor.';
    case 'ambient':
    default:
      return 'Menjaga alur kerja tetap teratur.';
  }
}
