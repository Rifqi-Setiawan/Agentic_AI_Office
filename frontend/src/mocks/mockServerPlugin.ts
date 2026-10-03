import type { Plugin } from 'vite';
import { getFreshMockSnapshot } from './fixtures';
import type { AgentState, HostVitals, OfficeEvent } from '../types/office';

export function mockOfficeApiPlugin(): Plugin {
  return {
    name: 'office-v2-mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

        // 1. Endpoint REST: GET /api/v1/snapshot
        if (url.pathname === '/api/v1/snapshot') {
          const snapshot = getFreshMockSnapshot();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(JSON.stringify(snapshot));
          return;
        }

        // 2. Endpoint SSE: GET /api/v1/stream
        if (url.pathname === '/api/v1/stream') {
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;

          // Snapshot awal segera dikirim saat koneksi terbuka
          const snapshot = getFreshMockSnapshot();
          let currentSeq = snapshot.seq;
          res.write(`event: snapshot\nid: ${currentSeq}\ndata: ${JSON.stringify(snapshot)}\n\n`);

          // Loop event simulasi berkala untuk pengembangan
          let tick = 0;
          const intervalId = setInterval(() => {
            tick++;
            currentSeq++;

            // Kirim keep-alive ping tiap 15 detik
            if (tick % 5 === 0) {
              res.write(`: ping\n\n`);
            }

            // Simulasi pembaruan vitals setiap 6 detik
            if (tick % 2 === 0) {
              const updatedVitals: HostVitals = {
                cpu_percent: Math.round((14 + Math.random() * 8) * 10) / 10,
                memory_percent: Math.round((40 + Math.random() * 4) * 10) / 10,
                disk_percent: 58.0,
                status: 'healthy',
                details: null,
              };
              res.write(`event: vitals\nid: ${currentSeq}\ndata: ${JSON.stringify(updatedVitals)}\n\n`);
            }

            // Simulasi aktivitas agent delta setiap 9 detik
            if (tick % 3 === 0) {
              const targetAgentId = 'forge';
              const agentDelta: AgentState = {
                id: targetAgentId,
                name: 'Forge',
                role: 'Backend Specialist',
                presence: 'on_duty',
                work: 'working',
                since: 1791028500,
                done_today: 5,
                zone: 'backend_den',
                action: `Mengoptimasi latensi query SQLite (#${tick})`,
                grid_x: 18,
                grid_y: 10,
                direction: 'SE',
                task: {
                  id: 't_f857a584',
                  title: 'Spike pembacaan SQLite read-only',
                  board: 'office-v2',
                  status: 'running',
                  block_kind: null,
                  started_at: 1791028500,
                  body: null,
                  summary: null,
                  result: null,
                  error: null,
                  workspace_path: null,
                  branch_name: null,
                  worker_pid: null,
                },
              };
              res.write(`event: agent\nid: ${currentSeq}\ndata: ${JSON.stringify(agentDelta)}\n\n`);

              const newOfficeEvent: OfficeEvent = {
                seq: currentSeq,
                ts: Math.floor(Date.now() / 1000),
                board: 'office-v2',
                kind: 'task_commented',
                agent: 'forge',
                actor: 'forge',
                message: `Forge mencatat benchmark p95 latensi 0.07 ms (iterasi ${tick})`,
                task: agentDelta.task,
              };
              res.write(`event: event\nid: ${currentSeq}\ndata: ${JSON.stringify(newOfficeEvent)}\n\n`);
            }
          }, 3000);

          req.on('close', () => {
            clearInterval(intervalId);
          });
          return;
        }

        next();
      });
    },
  };
}
