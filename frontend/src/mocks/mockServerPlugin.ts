import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAgentDetailFixture, getFounderMockSnapshot, getFreshMockSnapshot } from './fixtures';

interface ParsedSseBlock {
  event: string;
  id?: number;
  data: string;
}

function parseSseFile(filePath: string): ParsedSseBlock[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split(/\n\n+/);
  const result: ParsedSseBlock[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let id: number | undefined = undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.replace('event:', '').trim();
      } else if (line.startsWith('id:')) {
        const parsedId = parseInt(line.replace('id:', '').trim(), 10);
        if (!isNaN(parsedId)) {
          id = parsedId;
        }
      } else if (line.startsWith('data:')) {
        dataLines.push(line.replace('data:', '').trim());
      }
    }

    if (dataLines.length > 0) {
      result.push({
        event,
        id,
        data: dataLines.join('\n'),
      });
    }
  }

  return result;
}

export function mockOfficeApiPlugin(): Plugin {
  // Simpan klien SSE yang sedang aktif
  const activeSseClients = new Set<ServerResponse>();
  // Ring buffer event terakhir untuk resume Last-Event-ID
  const eventHistory: Array<{ seq: number; event: string; data: string }> = [];

  const recordEvent = (seq: number, event: string, data: string) => {
    eventHistory.push({ seq, event, data });
    if (eventHistory.length > 100) {
      eventHistory.shift();
    }
  };

  const broadcastEvent = (event: string, data: unknown, seq?: number): number => {
    const eventSeq = seq ?? (eventHistory.length > 0 ? eventHistory[eventHistory.length - 1].seq + 1 : 200);
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    recordEvent(eventSeq, event, dataStr);

    for (const client of activeSseClients) {
      try {
        client.write(`event: ${event}\nid: ${eventSeq}\ndata: ${dataStr}\n\n`);
      } catch (err) {
        console.warn('[MockServer] Gagal menulis ke klien SSE:', err);
      }
    }
    return eventSeq;
  };

  const handleRequest = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

    // Helper CORS
    const setCors = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Office-Intent, Last-Event-ID');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    };

    if (req.method === 'OPTIONS') {
      setCors();
      res.statusCode = 204;
      res.end();
      return;
    }

    // Helper Founder Auth Check
    const isFounderAuth = () => {
      const cookieHeader = req.headers.cookie || '';
      return cookieHeader.includes('office_founder_session=true');
    };

    // 1. Endpoint REST: GET /api/v1/snapshot
    if (url.pathname === '/api/v1/snapshot') {
      setCors();
      const wantFounder = url.searchParams.get('projection') === 'founder';
      const isAuth = isFounderAuth();

      if (wantFounder && !isAuth) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.statusCode = 401;
        res.end(JSON.stringify({ code: 'UNAUTHORIZED', error: 'Sesi Founder dibutuhkan' }));
        return;
      }

      const snapshot = wantFounder && isAuth ? getFounderMockSnapshot() : getFreshMockSnapshot();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      res.end(JSON.stringify(snapshot));
      return;
    }

    // 2. Endpoint REST: GET /api/v1/agents/:id
    if (url.pathname.startsWith('/api/v1/agents/')) {
      setCors();
      const agentId = url.pathname.replace('/api/v1/agents/', '').trim();
      if (!agentId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Agent ID wajib diisi' }));
        return;
      }

      const isFounder = isFounderAuth();
      const agentDetail = getAgentDetailFixture(agentId, isFounder);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      res.end(JSON.stringify(agentDetail));
      return;
    }

    // 3. Endpoint SSE: GET /api/v1/stream
    if (url.pathname === '/api/v1/stream') {
      setCors();
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.statusCode = 200;

      activeSseClients.add(res);

      // Tangani Last-Event-ID jika klien menghubungkan kembali (reconnect)
      const lastEventIdHeader = req.headers['last-event-id'] as string | undefined;
      const lastEventIdQuery = url.searchParams.get('last_event_id');
      const lastSeq = parseInt(lastEventIdHeader || lastEventIdQuery || '0', 10);

      // Snapshot awal segera dikirim saat koneksi pertama kali dibuka (jika bukan reconnect event catch-up)
      const snapshot = isFounderAuth() ? getFounderMockSnapshot() : getFreshMockSnapshot();
      let currentSeq = snapshot.seq;

      if (!lastSeq || lastSeq <= 0) {
        res.write(`event: snapshot\nid: ${currentSeq}\ndata: ${JSON.stringify(snapshot)}\n\n`);
        recordEvent(currentSeq, 'snapshot', JSON.stringify(snapshot));
      } else {
        // Klien melakukan resume dengan last_event_id: kirim event yang terlewat jika ada di buffer
        const missed = eventHistory.filter((e) => e.seq > lastSeq);
        if (missed.length > 0) {
          for (const ev of missed) {
            res.write(`event: ${ev.event}\nid: ${ev.seq}\ndata: ${ev.data}\n\n`);
          }
        } else {
          // Jika buffer kosong atau gap terlalu jauh, kirim snapshot terkini sebagai pemulihan
          res.write(`event: snapshot\nid: ${currentSeq}\ndata: ${JSON.stringify(snapshot)}\n\n`);
        }
      }

      // Replay mode dari file rekaman jika diminta (mis. ?replay=1 atau ?stream_file=...)
      const replayParam = url.searchParams.get('replay') || url.searchParams.get('recorded');
      if (replayParam === '1' || replayParam === 'true') {
        const fixturePath = path.resolve(__dirname, '../../e2e/fixtures/recorded_stream.sse');
        const recordedBlocks = parseSseFile(fixturePath);
        // Kirim event delta yang terekam (skip snapshot awal yang sudah dikirim di atas)
        for (const block of recordedBlocks) {
          if (block.event !== 'snapshot') {
            const bSeq = block.id ?? ++currentSeq;
            res.write(`event: ${block.event}\nid: ${bSeq}\ndata: ${block.data}\n\n`);
            recordEvent(bSeq, block.event, block.data);
          }
        }
      }

      // Keep-alive ping berkala
      const pingInterval = setInterval(() => {
        try {
          res.write(`: ping\n\n`);
        } catch {
          // Klien terputus
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(pingInterval);
        activeSseClients.delete(res);
      });
      return;
    }

    // 4. Endpoint REST: POST /api/v1/auth/login
    if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
      setCors();
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let password = '';
        try {
          const parsed = JSON.parse(body);
          password = parsed.password || '';
        } catch {
          // ignore
        }

        if (!password.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Kata sandi tidak boleh kosong' }));
          return;
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Set-Cookie',
          'office_founder_session=true; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800',
        );
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            role: 'founder',
            expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
          }),
        );
      });
      return;
    }

    // 5. Endpoint REST: POST /api/v1/auth/logout
    if (url.pathname === '/api/v1/auth/logout' && req.method === 'POST') {
      setCors();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Set-Cookie',
        'office_founder_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict',
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 6. Endpoint REST: POST /api/v1/collective
    if (url.pathname === '/api/v1/collective' && req.method === 'POST') {
      setCors();
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let parsed = { kind: 'rapat', title: undefined };
        try {
          parsed = JSON.parse(body);
        } catch {
          // ignore
        }
        const now = Math.floor(Date.now() / 1000);
        const titles: Record<string, string> = {
          rapat: 'Rapat Mendadak',
          break: 'Break Time',
          sholat: 'Sholat Berjamaah',
        };
        const title = parsed.title || titles[parsed.kind] || 'Event Kolektif';
        const responseData = {
          id: `coll_${now}_${parsed.kind}`,
          kind: parsed.kind,
          title,
          active: true,
          started_at: now,
          expires_at: now + 300,
          participants: ['jarvis', 'daedalus', 'forge', 'prism'],
        };

        // Siarkan event collective ke semua klien SSE yang aktif
        broadcastEvent('collective', responseData);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.statusCode = 200;
        res.end(JSON.stringify(responseData));
      });
      return;
    }

    // 7. Endpoint Kontrol Pengujian: POST /api/v1/test/emit-event
    // Memungkinkan pengujian E2E menyiarkan event kustom langsung ke klien SSE
    if (url.pathname === '/api/v1/test/emit-event' && req.method === 'POST') {
      setCors();
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const eventName = parsed.event || 'event';
          let eventData = parsed.data || {};
          // Rekaman historis mempertahankan TTL saat diputar dalam server uji.
          // Endpoint ini hanya milik mock Vite, tidak ada di backend produksi.
          if (eventName === 'collective' && eventData.active &&
              Number.isFinite(eventData.started_at) && Number.isFinite(eventData.expires_at)) {
            const now = Math.floor(Date.now() / 1000);
            if (eventData.expires_at < now && eventData.expires_at > eventData.started_at) {
              eventData = { ...eventData, started_at: now,
                expires_at: now + (eventData.expires_at - eventData.started_at) };
            }
          }
          const seq = parsed.id ? parseInt(parsed.id, 10) : undefined;
          const assignedSeq = broadcastEvent(eventName, eventData, seq);

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              seq: assignedSeq,
              activeClients: activeSseClients.size,
            }),
          );
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // 8. Endpoint Kontrol Pengujian: POST /api/v1/test/disconnect-stream
    // Memutus seluruh koneksi klien SSE aktif untuk menguji skenario reconnect SSE
    if (url.pathname === '/api/v1/test/disconnect-stream' && req.method === 'POST') {
      setCors();
      const count = activeSseClients.size;
      for (const client of activeSseClients) {
        try {
          client.end();
        } catch {
          // ignore
        }
      }
      activeSseClients.clear();

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, disconnectedCount: count }));
      return;
    }

    // 9. Endpoint REST: GET /healthz
    if (url.pathname === '/healthz' || url.pathname === '/api/v1/healthz') {
      setCors();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'ok', app: 'office-v2' }));
      return;
    }

    next();
  };

  return {
    name: 'office-v2-mock-api',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}
