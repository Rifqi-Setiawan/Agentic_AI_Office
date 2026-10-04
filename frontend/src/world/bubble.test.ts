import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BubbleManager } from './bubble/BubbleManager';
import { BubblePriority, MAX_ACTIVE_BUBBLES } from './bubble/types';
import { createMockContainer } from './bubble/mockDom';
import { resolvePlaceholders, formatDurationIndonesian } from './bubble/placeholder';
import { dialogBank, getDialogLines, getRandomDialogLine } from './bubble/dialogBank';
import { AGENT_SPAWN_DEFS } from './CharacterManager';
import type { Character } from './Character';
import type { CharacterManager } from './CharacterManager';
import type { CameraManager } from './camera';

describe('T1.15 Bubble Manager & Dialog Bank (Fitur F13)', () => {
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

  // =========================================================================
  // ACCEPTANCE CRITERION 1: Tidak pernah ada lebih dari 3 bubble tampil
  // =========================================================================
  describe('Kriteria Penerimaan 1: Tidak pernah ada lebih dari 3 bubble tampil (test)', () => {
    it('memastikan maksimal 3 bubble aktif di BubbleManager dan di DOM', () => {
      // Tampilkan 3 bubble awal dengan agen berbeda
      const res1 = bubbleManager.showBubble({ agentId: 'jarvis', text: 'Pesan 1', kind: 'working' });
      const res2 = bubbleManager.showBubble({ agentId: 'forge', text: 'Pesan 2', kind: 'working' });
      const res3 = bubbleManager.showBubble({ agentId: 'prism', text: 'Pesan 3', kind: 'working' });

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);
      expect(bubbleManager.getActiveCount()).toBe(3);

      // Cek jumlah elemen DOM yang aktif
      const visibleElements = container.querySelectorAll('.agent-bubble-wrapper[style*="display: block"]');
      expect(visibleElements.length).toBe(3);

      // Permintaan ke-4 dengan prioritas sama/rendah harus ditolak
      const res4 = bubbleManager.showBubble({ agentId: 'nova', text: 'Pesan 4', kind: 'working' });
      expect(res4).toBe(false);
      expect(bubbleManager.getActiveCount()).toBe(3);

      // Jumlah elemen DOM aktif tetap 3 (tidak pernah > 3)
      const visibleAfter4 = container.querySelectorAll('.agent-bubble-wrapper[style*="display: block"]');
      expect(visibleAfter4.length).toBe(3);
    });

    it('menggusur (evict) bubble berprioritas rendah jika slot penuh dan prioritas baru lebih tinggi, tetap <= 3', () => {
      // Isi 3 bubble prioritas working (prioritas 2)
      bubbleManager.showBubble({ agentId: 'jarvis', text: 'Sedang kerja 1', kind: 'working' });
      bubbleManager.showBubble({ agentId: 'forge', text: 'Sedang kerja 2', kind: 'working' });
      bubbleManager.showBubble({ agentId: 'prism', text: 'Sedang kerja 3', kind: 'working' });
      expect(bubbleManager.getActiveCount()).toBe(3);

      // Permintaan bubble 'failed' (prioritas 6) dari Bastion
      const resFailed = bubbleManager.showBubble({
        agentId: 'bastion',
        text: 'Ada insiden!',
        kind: 'failed',
      });

      expect(resFailed).toBe(true);
      // Jumlah bubble tetap <= 3
      expect(bubbleManager.getActiveCount()).toBe(3);

      // Pastikan bubble failed ada di antara bubble aktif
      const activeBubbles = bubbleManager.getActiveBubbles();
      const hasFailed = activeBubbles.some((b) => b.agentId === 'bastion' && b.kind === 'failed');
      expect(hasFailed).toBe(true);

      // Verifikasi di level DOM: tepat 3 elemen yang ditampilkan
      const visibleInDom = container.querySelectorAll('.agent-bubble-wrapper[style*="display: block"]');
      expect(visibleInDom.length).toBe(3);
    });

    it('menangani serangan puluhan request konkuren acak: jumlah tampil tidak pernah melampaui 3', () => {
      const agentIds = AGENT_SPAWN_DEFS.map((d) => d.id);

      for (let i = 0; i < 50; i++) {
        const randomAgent = agentIds[i % agentIds.length];
        const kinds: ('working' | 'done' | 'blocked' | 'failed' | 'founder' | 'ambient')[] = [
          'working', 'done', 'blocked', 'failed', 'founder', 'ambient'
        ];
        const randomKind = kinds[i % kinds.length];

        bubbleManager.showBubble({
          agentId: randomAgent,
          text: `Pesan stresstest ${i}`,
          kind: randomKind,
          force: true, // force bypass cooldown untuk menguji kapasitas pool ekstrem
        });

        // Invarian: aktif di manager tidak boleh > 3
        expect(bubbleManager.getActiveCount()).toBeLessThanOrEqual(3);

        // Invarian: elemen DOM yang tampil tidak boleh > 3
        const activeDom = container.querySelectorAll('.agent-bubble-wrapper[style*="display: block"]');
        expect(activeDom.length).toBeLessThanOrEqual(3);
      }
    });
  });

  // =========================================================================
  // ACCEPTANCE CRITERION 2: Placeholder kosong tidak pernah tampil mentah ({proyek})
  // =========================================================================
  describe('Kriteria Penerimaan 2: Placeholder kosong tidak pernah tampil mentah ({proyek})', () => {
    it('mengganti {proyek} dengan nama proyek atau fallback aman saat context kosong', () => {
      const template = 'Pipeline {proyek} berjalan sesuai timeline eksekutif.';

      // Kasus 1: context sama sekali tidak memberikan proyek
      const resEmpty = resolvePlaceholders(template, {});
      expect(resEmpty).not.toContain('{proyek}');
      expect(resEmpty).toContain('proyek'); // fallback publik 'proyek'
      expect(resEmpty).toBe('Pipeline proyek berjalan sesuai timeline eksekutif.');

      // Kasus 2: mode founder tanpa nama proyek
      const resFounder = resolvePlaceholders(template, { mode: 'founder' });
      expect(resFounder).not.toContain('{proyek}');
      expect(resFounder).toBe('Pipeline office-v2 berjalan sesuai timeline eksekutif.');

      // Kasus 3: projectName berupa string kosong atau spasi
      const resBlank = resolvePlaceholders(template, { projectName: '   ' });
      expect(resBlank).not.toContain('{proyek}');
      expect(resBlank).toBe('Pipeline proyek berjalan sesuai timeline eksekutif.');

      // Kasus 4: task dengan board null/kosong
      const resNullTask = resolvePlaceholders(template, {
        task: { id: 't1', title: 'Task', board: '', status: 'running' },
      });
      expect(resNullTask).not.toContain('{proyek}');
      expect(resNullTask).toBe('Pipeline proyek berjalan sesuai timeline eksekutif.');
    });

    it('mengaudit seluruh 576 baris dialog di dialog.id.json: zero placeholder mentah saat context kosong', () => {
      const allAgents = Object.keys(dialogBank);
      expect(allAgents.length).toBe(16);

      let auditedLines = 0;

      for (const agentId of allAgents) {
        const agentStates = dialogBank[agentId]!;
        for (const lines of Object.values(agentStates)) {
          for (const line of lines!) {
            auditedLines++;

            // Resolusi dengan context kosong (worst case)
            const resolved = resolvePlaceholders(line, { agentId });

            // Assert: TIDAK ADA {proyek}, {n}, {durasi}, {agent}, atau kurung kurawal apapun!
            expect(resolved).not.toContain('{proyek}');
            expect(resolved).not.toContain('{n}');
            expect(resolved).not.toContain('{durasi}');
            expect(resolved).not.toContain('{agent}');
            expect(resolved).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
            expect(resolved.length).toBeGreaterThan(0);
          }
        }
      }

      expect(auditedLines).toBe(576);
    });

    it('memvalidasi substitusi seluruh jenis placeholder dengan data nyata', () => {
      const template = 'Di {proyek}, {agent} telah menyelesaikan {n} tugas dalam {durasi}.';

      const resolved = resolvePlaceholders(template, {
        projectName: 'office-v2',
        peerAgentName: 'Daedalus',
        doneToday: 7,
        duration: 125, // 125 detik -> '2 menit'
      });

      expect(resolved).toBe('Di office-v2, Daedalus telah menyelesaikan 7 tugas dalam 2 menit.');
      expect(resolved).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
    });

    it('memvalidasi format durasi alami dalam Bahasa Indonesia', () => {
      expect(formatDurationIndonesian(0)).toBe('tempo singkat');
      expect(formatDurationIndonesian(15)).toBe('15 detik');
      expect(formatDurationIndonesian(60)).toBe('1 menit');
      expect(formatDurationIndonesian(150)).toBe('2 menit');
      expect(formatDurationIndonesian(3600)).toBe('1 jam');
      expect(formatDurationIndonesian(5400)).toBe('1 jam 30 menit');
    });
  });

  // =========================================================================
  // ATURAN DURASI BUBBLE: Masing-masing 4 detik
  // =========================================================================
  describe('Aturan Durasi Bubble: 4 detik per bubble', () => {
    it('menghilangkan bubble secara otomatis setelah durasi 4 detik terlewati', () => {
      bubbleManager.showBubble({ agentId: 'jarvis', text: 'Halo tim', kind: 'working' });
      expect(bubbleManager.getActiveCount()).toBe(1);

      // Maju 2.0 detik (belum habis)
      bubbleManager.update(2.0);
      expect(bubbleManager.getActiveCount()).toBe(1);

      // Maju 2.1 detik lagi (total 4.1 detik > 4.0)
      bubbleManager.update(2.1);
      expect(bubbleManager.getActiveCount()).toBe(0);

      // DOM harus disembunyikan
      const visible = container.querySelectorAll('.agent-bubble-wrapper[style*="display: block"]');
      expect(visible.length).toBe(0);
    });
  });

  // =========================================================================
  // ATURAN COOLDOWN: 20 detik per agent
  // =========================================================================
  describe('Aturan Cooldown: 20 detik per agent', () => {
    it('menerapkan cooldown 20 detik untuk agen yang sama, tetapi membolehkan agen lain', () => {
      // Jarvis bicara pada t = 0
      const res1 = bubbleManager.showBubble({ agentId: 'jarvis', text: 'Briefing pagi', kind: 'working' });
      expect(res1).toBe(true);
      expect(bubbleManager.isAgentOnCooldown('jarvis')).toBe(true);

      // Jarvis coba bicara lagi pada t = 5 detik -> ditolak
      bubbleManager.update(5.0);
      const res2 = bubbleManager.showBubble({ agentId: 'jarvis', text: 'Update cepat', kind: 'working' });
      expect(res2).toBe(false);

      // Forge bicara pada t = 5 detik -> diterima (cooldown independen per agen)
      const resForge = bubbleManager.showBubble({ agentId: 'forge', text: 'Backend jalan', kind: 'working' });
      expect(resForge).toBe(true);

      // Maju waktu hingga t = 19.9 detik dari awal -> Jarvis masih cooldown
      bubbleManager.update(14.9);
      expect(bubbleManager.isAgentOnCooldown('jarvis')).toBe(true);
      expect(bubbleManager.showBubble({ agentId: 'jarvis', text: 'Tes 19.9s', kind: 'working' })).toBe(false);

      // Maju waktu melewati t = 20 detik (misal t = 20.5 detik) -> Jarvis bisa bicara lagi
      bubbleManager.update(0.6);
      expect(bubbleManager.isAgentOnCooldown('jarvis')).toBe(false);
      const resJarvisAfterCooldown = bubbleManager.showBubble({
        agentId: 'jarvis',
        text: 'Briefing selesai',
        kind: 'working',
      });
      expect(resJarvisAfterCooldown).toBe(true);
    });
  });

  // =========================================================================
  // HIERARKI PRIORITAS: Founder > Gagal > Blocked > Selesai > Mulai Kerja > Ambient
  // =========================================================================
  describe('Hierarki Prioritas sesuai Spec 03', () => {
    it('memvalidasi urutan nilai prioritas', () => {
      expect(BubblePriority.FOUNDER).toBeGreaterThan(BubblePriority.FAILED);
      expect(BubblePriority.FAILED).toBeGreaterThan(BubblePriority.BLOCKED);
      expect(BubblePriority.BLOCKED).toBeGreaterThan(BubblePriority.DONE);
      expect(BubblePriority.DONE).toBeGreaterThan(BubblePriority.COLLECTIVE);
      expect(BubblePriority.COLLECTIVE).toBeGreaterThan(BubblePriority.WORKING);
      expect(BubblePriority.WORKING).toBeGreaterThan(BubblePriority.AMBIENT);
    });

    it('menggusur bubble prioritas terendah saat kapasitas penuh', () => {
      // Slot 1: Working (prio 2)
      bubbleManager.showBubble({ agentId: 'jarvis', text: 'Kerja', kind: 'working' });
      // Slot 2: Done (prio 4)
      bubbleManager.showBubble({ agentId: 'forge', text: 'Selesai', kind: 'done' });
      // Slot 3: Blocked (prio 5)
      bubbleManager.showBubble({ agentId: 'prism', text: 'Tertahan', kind: 'blocked' });

      expect(bubbleManager.getActiveCount()).toBe(3);

      // Datang bubble Founder (prio 7)
      const resFounder = bubbleManager.showBubble({
        agentId: 'rifqi',
        text: 'Mantap semua!',
        kind: 'founder',
      });

      expect(resFounder).toBe(true);
      expect(bubbleManager.getActiveCount()).toBe(3);

      // Bubble terendah (jarvis, working) harus tergusur
      const activeIds = bubbleManager.getActiveBubbles().map((b) => b.agentId);
      expect(activeIds).not.toContain('jarvis');
      expect(activeIds).toContain('rifqi');
      expect(activeIds).toContain('forge');
      expect(activeIds).toContain('prism');
    });
  });

  // =========================================================================
  // AREA PANDANG KAMERA (VIEWPORT CULLING UNTUK AMBIENT)
  // =========================================================================
  describe('Batas Pandang Kamera: Bubble ambient hanya muncul jika agent di area pandang', () => {
    it('menolak bubble ambient jika agen berada di luar viewport kamera', () => {
      // Mock CameraManager
      const mockCamera = {
        getViewport: () => ({
          getVisibleBounds: () => ({
            x: 0,
            y: 0,
            width: 500,
            height: 500,
          }),
        }),
      };

      // Mock CharacterManager dengan 2 agen: satu di dalam, satu di luar
      const mockCharIn = { x: 200, y: 200 };
      const mockCharOut = { x: 1200, y: 1500 };

      const mockCharManager = {
        getCharacter: (id: string) => {
          if (id === 'jarvis') return mockCharIn as unknown as Character;
          if (id === 'nova') return mockCharOut as unknown as Character;
          return undefined;
        },
      };

      const managerWithCam = new BubbleManager({
        container,
        camera: mockCamera as unknown as CameraManager,
        characterManager: mockCharManager as unknown as CharacterManager,
      });

      // Jarvis di dalam viewport -> ambient diterima
      const resIn = managerWithCam.showBubble({
        agentId: 'jarvis',
        text: 'Kopi dulu...',
        kind: 'ambient',
      });
      expect(resIn).toBe(true);

      // Nova di luar viewport -> ambient DITOLAK
      const resOut = managerWithCam.showBubble({
        agentId: 'nova',
        text: 'Balapan yuk!',
        kind: 'ambient',
      });
      expect(resOut).toBe(false);

      // Tetapi jika Nova mengalami error (failed), bubble tetap diizinkan (tidak dibatasi kamera)
      const resFailed = managerWithCam.showBubble({
        agentId: 'nova',
        text: 'Crash fatal!',
        kind: 'failed',
      });
      expect(resFailed).toBe(true);

      managerWithCam.destroy();
    });
  });

  // =========================================================================
  // INTEGRASI DIALOG BANK & STORE TRANSLATION
  // =========================================================================
  describe('Integrasi Dialog Bank & Helper', () => {
    it('mengambil baris dialog acak dan memverifikasi ketersediaannya', () => {
      const lines = getDialogLines('prism', 'working');
      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(lines).toContain('Re-render tiga kali per frame? Tidak di jam kerjaku.');

      const randomLine = getRandomDialogLine('prism', 'working');
      expect(typeof randomLine).toBe('string');
      expect(randomLine.length).toBeGreaterThan(0);
    });

    it('memicu dialog lewat method triggerDialog dan menampilkan metadata visual agen', () => {
      const success = bubbleManager.triggerDialog('prism', 'working', {
        projectName: 'office-v2',
      });

      expect(success).toBe(true);
      expect(bubbleManager.getActiveCount()).toBe(1);

      const bubble = bubbleManager.getActiveBubbles()[0];
      expect(bubble.agentName).toBe('Prism');
      expect(bubble.signatureColor).toBe('#2BB3C0');
      expect(bubble.text).not.toContain('{proyek}');

      // Cek elemen DOM
      const dot = container.querySelector('.agent-bubble-dot') as HTMLElement;
      expect(dot).toBeDefined();
    });

    it('merespons event ChoreographerBubbleEvent dengan benar', () => {
      const handled = bubbleManager.handleChoreographerBubble({
        agentId: 'forge',
        text: 'Nyusul setelah task ini',
        kind: 'collective',
      });

      expect(handled).toBe(true);
      const active = bubbleManager.getActiveBubbles();
      expect(active.length).toBe(1);
      expect(active[0].text).toBe('Nyusul setelah task ini');
      expect(active[0].kind).toBe('collective');
    });
  });

  // =========================================================================
  // DOM POSITIONING PER FRAME (Tanpa React)
  // =========================================================================
  describe('Pembaruan Posisi DOM Per Frame (Tanpa React)', () => {
    it('memperbarui transform elemen DOM saat karakter berpindah posisi', () => {
      const mockChar = {
        x: 100,
        y: 150,
      };

      const mockCharManager = {
        getCharacter: (id: string) => (id === 'jarvis' ? (mockChar as unknown as Character) : undefined),
      };

      const manager = new BubbleManager({
        container,
        characterManager: mockCharManager as unknown as CharacterManager,
      });

      manager.showBubble({ agentId: 'jarvis', text: 'Saya sedang jalan', kind: 'working' });

      const activeBubble = manager.getActiveBubbles()[0];
      expect(activeBubble).toBeDefined();
      const el = activeBubble.element;
      expect(el.style.display).toBe('block');

      // Update frame awal
      manager.update(0.016);
      const initialTransform = el.style.transform;
      expect(initialTransform).toContain('translate3d');

      // Karakter bergeser ke koordinat baru
      mockChar.x = 450;
      mockChar.y = 300;

      // Update frame berikutnya
      manager.update(0.016);
      const updatedTransform = el.style.transform;

      expect(updatedTransform).toContain('translate3d');
      expect(updatedTransform).not.toBe(initialTransform);

      manager.destroy();
    });
  });
});
