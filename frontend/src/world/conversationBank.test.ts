import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  conversationPairs,
  getConversationPairs,
  getConversationById,
  getConversationsForAgent,
  getConversationsBetween,
  getRandomConversation,
} from './bubble/conversationBank';
import { BubbleManager } from './bubble/BubbleManager';
import { MAX_ACTIVE_BUBBLES } from './bubble/types';
import { createMockContainer } from './bubble/mockDom';
import { AGENT_SPAWN_DEFS } from './CharacterManager';

describe('T2.8 Obrolan Dua Arah Antar Agent (Fitur F27)', () => {
  const validAgentIds = new Set(AGENT_SPAWN_DEFS.map((d) => d.id));

  // =========================================================================
  // 1. VALIDASI DATASET: 20 Pasangan Percakapan Dua Arah
  // =========================================================================
  describe('Dataset 20 Pasangan Percakapan (conversations.id.json)', () => {
    it('memiliki tepat 20 pasangan percakapan dua arah yang terdaftar', () => {
      const allPairs = getConversationPairs();
      expect(allPairs.length).toBe(20);
      expect(conversationPairs.length).toBe(20);
    });

    it('setiap percakapan memiliki ID unik dan dua agen yang terdaftar di sistem', () => {
      const seenIds = new Set<string>();

      for (const conv of conversationPairs) {
        // ID unik
        expect(seenIds.has(conv.id)).toBe(false);
        seenIds.add(conv.id);

        // Dua agen valid
        expect(conv.agents.length).toBe(2);
        const [a1, a2] = conv.agents;
        expect(validAgentIds.has(a1)).toBe(true);
        expect(validAgentIds.has(a2)).toBe(true);
        expect(a1).not.toBe(a2);

        // Topik deskriptif
        expect(conv.topic).toBeDefined();
        expect(conv.topic.length).toBeGreaterThan(0);
      }
    });

    it('mencakup 3 contoh wajib dari spesifikasi blueprint: Prism-Muse, Forge-Vector, Sentinel-Nova', () => {
      const prismMuse = getConversationsBetween('prism', 'muse');
      expect(prismMuse.length).toBeGreaterThanOrEqual(1);
      expect(prismMuse[0].id).toBe('prism_muse_spacing');
      expect(prismMuse[0].topic.toLowerCase()).toContain('spacing');

      const forgeVector = getConversationsBetween('forge', 'vector');
      expect(forgeVector.length).toBeGreaterThanOrEqual(1);
      expect(forgeVector[0].id).toBe('forge_vector_skema');
      expect(forgeVector[0].topic.toLowerCase()).toContain('skema');

      const sentinelNova = getConversationsBetween('sentinel', 'nova');
      expect(sentinelNova.length).toBeGreaterThanOrEqual(1);
      expect(sentinelNova[0].id).toBe('sentinel_nova_testing');
      expect(sentinelNova[0].topic.toLowerCase()).toContain('pengujian');
    });

    it('setiap baris dialog dua arah memenuhi aturan <= 80 karakter dan persona spesifik', () => {
      for (const conv of conversationPairs) {
        expect(conv.turns.length).toBeGreaterThanOrEqual(2);

        // Pastikan ada pergantian giliran dua arah (agent A dan agent B)
        const turnAgents = conv.turns.map((t) => t.agent);
        expect(turnAgents).toContain(conv.agents[0]);
        expect(turnAgents).toContain(conv.agents[1]);

        for (const turn of conv.turns) {
          // Agen giliran harus salah satu dari kedua partisipan
          expect(conv.agents).toContain(turn.agent);

          // Teks tidak boleh kosong
          expect(turn.text.trim().length).toBeGreaterThan(0);

          // Batas karakter spec: <= 80 karakter
          expect(turn.text.length).toBeLessThanOrEqual(80);

          // Hanya placeholder yang sah jika ada
          const matches = turn.text.match(/\{[a-zA-Z0-9_]+\}/g);
          if (matches) {
            for (const match of matches) {
              expect(['{proyek}', '{n}', '{durasi}', '{agent}']).toContain(match);
            }
          }
        }
      }
    });
  });

  // =========================================================================
  // 2. QUERY API: Fungsi Pencarian dan Filter Percakapan
  // =========================================================================
  describe('Query API (conversationBank.ts)', () => {
    it('dapat mencari percakapan berdasarkan ID', () => {
      const conv = getConversationById('prism_muse_spacing');
      expect(conv).toBeDefined();
      expect(conv?.id).toBe('prism_muse_spacing');
      expect(conv?.agents).toEqual(['prism', 'muse']);

      const notFound = getConversationById('non_existent_id');
      expect(notFound).toBeUndefined();
    });

    it('dapat mengambil percakapan untuk agen tertentu', () => {
      const prismConvs = getConversationsForAgent('prism');
      expect(prismConvs.length).toBeGreaterThanOrEqual(3);
      for (const c of prismConvs) {
        expect(c.agents).toContain('prism');
      }
    });

    it('dapat mengambil percakapan antara dua agen secara simetris (A-B atau B-A)', () => {
      const direct = getConversationsBetween('forge', 'vector');
      const reversed = getConversationsBetween('vector', 'forge');

      expect(direct.length).toBe(1);
      expect(reversed.length).toBe(1);
      expect(direct[0].id).toBe(reversed[0].id);
    });

    it('dapat mengambil percakapan acak dengan filter opsional', () => {
      const randomGeneral = getRandomConversation();
      expect(randomGeneral).not.toBeNull();
      expect(conversationPairs).toContain(randomGeneral!);

      const randomSpecific = getRandomConversation('sentinel', 'nova');
      expect(randomSpecific?.id).toBe('sentinel_nova_testing');

      const nonExistent = getRandomConversation('jarvis', 'steward');
      // Jika tidak ada obrolan langsung jarvis-steward, mengembalikan null
      if (getConversationsBetween('jarvis', 'steward').length === 0) {
        expect(nonExistent).toBeNull();
      }
    });
  });

  // =========================================================================
  // 3. INTEGRASI BUBBLE MANAGER: Penayangan Berantai Dialog Dua Arah
  // =========================================================================
  describe('Integrasi BubbleManager dengan Percakapan Dua Arah', () => {
    let container: HTMLElement;
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      container = createMockContainer();
      bubbleManager = new BubbleManager({
        container,
        maxBubbles: MAX_ACTIVE_BUBBLES,
        bubbleDurationSec: 4.0,
        cooldownSec: 20.0,
      });
    });

    afterEach(() => {
      bubbleManager.destroy();
      vi.restoreAllMocks();
    });

    it('memulai giliran pertama saat playConversation dipanggil', () => {
      const conv = getConversationById('prism_muse_spacing')!;
      const onComplete = vi.fn();

      const started = bubbleManager.playConversation(conv, {
        turnDurationSec: 3.0,
        onComplete,
      });

      expect(started).toBe(true);
      expect(bubbleManager.getActiveCount()).toBe(1);

      // Giliran 1: Prism bicara
      const active = bubbleManager.getActiveBubbles();
      expect(active[0].agentId).toBe('prism');
      expect(active[0].text).toBe(conv.turns[0].text);

      const activeState = bubbleManager.getActiveConversation();
      expect(activeState).toEqual({
        id: 'prism_muse_spacing',
        currentTurnIndex: 0,
      });
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('melanjutkan ke giliran kedua setelah durasi giliran pertama berlalu via update()', () => {
      const conv = getConversationById('prism_muse_spacing')!;
      const onComplete = vi.fn();

      bubbleManager.playConversation(conv, {
        turnDurationSec: 3.0,
        onComplete,
      });

      // Ticker maju 3 detik: giliran 1 selesai, giliran 2 (Muse) muncul
      bubbleManager.update(3.0);

      const activeState = bubbleManager.getActiveConversation();
      expect(activeState).toEqual({
        id: 'prism_muse_spacing',
        currentTurnIndex: 1,
      });

      // Bubble aktif sekarang memuat Muse
      const activeBubbles = bubbleManager.getActiveBubbles();
      const hasMuse = activeBubbles.some(
        (b) => b.agentId === 'muse' && b.text === conv.turns[1].text,
      );
      expect(hasMuse).toBe(true);
      expect(onComplete).not.toHaveBeenCalled();

      // Ticker maju 3 detik lagi: giliran 2 selesai, onComplete terpanggil
      bubbleManager.update(3.0);

      expect(bubbleManager.getActiveConversation()).toBeNull();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('dapat dibatalkan dengan cancelConversation()', () => {
      const conv = getConversationById('forge_vector_skema')!;
      const onComplete = vi.fn();

      bubbleManager.playConversation(conv, {
        turnDurationSec: 2.0,
        onComplete,
      });

      expect(bubbleManager.getActiveConversation()).not.toBeNull();
      bubbleManager.cancelConversation();
      expect(bubbleManager.getActiveConversation()).toBeNull();

      // Update tidak memicu giliran selanjutnya
      bubbleManager.update(2.0);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('playConversation menerima string ID percakapan', () => {
      const started = bubbleManager.playConversation('sentinel_nova_testing');
      expect(started).toBe(true);
      expect(bubbleManager.getActiveConversation()?.id).toBe('sentinel_nova_testing');
    });

    it('mengembalikan false jika ID percakapan tidak ditemukan', () => {
      const started = bubbleManager.playConversation('invalid_id');
      expect(started).toBe(false);
    });
  });
});
