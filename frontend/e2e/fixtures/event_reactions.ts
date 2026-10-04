import type { OfficeEvent } from '../../src/types/office';

export const EVENT_REACTIONS_FIXTURES = {
  // Reaksi 1: task_commented oleh jarvis → Jarvis berjalan ke meja assignee dan stand_talk
  reactionTaskCommented: {
    event: {
      seq: 201,
      ts: 1791030010,
      board: 'office-v2',
      kind: 'task_commented' as const,
      actor: 'jarvis',
      agent: 'forge',
      message: 'Jarvis menambahkan komentar: Tolong pastikan validasi payload API tuntas sesuai spec.',
      task: {
        id: 't_f857a584',
        title: 'Spike pembacaan SQLite read-only',
        board: 'office-v2',
        status: 'running' as const,
        block_kind: null,
        started_at: 1791030000,
        body: null,
        summary: null,
        result: null,
        error: null,
        workspace_path: null,
        branch_name: null,
        worker_pid: null,
        assignee: 'forge',
      },
    } as OfficeEvent,
  },

  // Reaksi 2: task_blocked setelah run Sentinel → stempel merah FAIL
  reactionTaskBlockedSentinel: {
    event: {
      seq: 202,
      ts: 1791030030,
      board: 'office-v2',
      kind: 'task_blocked' as const,
      actor: 'sentinel',
      agent: 'steward',
      message: 'Sentinel: REQUEST CHANGES — NOT RELEASE READY. Ditemukan regresi P1 pada sprite pipeline.',
      task: {
        id: 't_95dd45f9',
        title: 'Animasi aktivitas lengkap',
        board: 'office-v2',
        status: 'blocked' as const,
        block_kind: 'needs_input',
        started_at: 1791030010,
        body: null,
        summary: null,
        result: 'REQUEST_CHANGES',
        error: 'P1: Regresi pada integrasi atlas',
        workspace_path: null,
        branch_name: null,
        worker_pid: null,
        reviewer: 'sentinel',
      },
    } as OfficeEvent,
  },

  // Reaksi 3: task_done dengan branch_name → Relay membawa paket ke konveyor
  reactionTaskDoneBranch: {
    event: {
      seq: 203,
      ts: 1791030050,
      board: 'office-v2',
      kind: 'task_done' as const,
      actor: 'relay',
      agent: 'relay',
      message: 'Task t_f20_release tuntas dengan branch release/v2.1.0',
      task: {
        id: 't_f20_release',
        title: 'Paket rilis v2.1.0',
        board: 'office-v2',
        status: 'done' as const,
        block_kind: null,
        started_at: 1791030020,
        body: null,
        summary: 'Paket rilis branch release/v2.1.0 siap diverifikasi',
        result: 'PASS',
        error: null,
        workspace_path: null,
        branch_name: 'release/v2.1.0',
        worker_pid: null,
      },
    } as OfficeEvent,
  },

  // Reaksi 4: task_failed → Bastion mengecek
  reactionTaskFailedBastion: {
    event: {
      seq: 204,
      ts: 1791030070,
      board: 'office-v2',
      kind: 'task_failed' as const,
      actor: 'vector',
      agent: 'vector',
      message: 'Vector mengalami kegagalan eksekusi worker crash SIGSEGV pada pipeline metrik',
      task: {
        id: 't_data_pipeline',
        title: 'Pipeline agregasi metrik',
        board: 'office-v2',
        status: 'failed' as const,
        block_kind: 'capability',
        started_at: 1791030040,
        body: null,
        summary: null,
        result: null,
        error: 'Worker crash with exit code 139 (SIGSEGV)',
        workspace_path: null,
        branch_name: null,
        worker_pid: null,
        assignee: 'vector',
      },
    } as OfficeEvent,
  },
};
