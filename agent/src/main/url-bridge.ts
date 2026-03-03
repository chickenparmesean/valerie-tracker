import http from 'http';
import { getTrackerSettings } from './tracker-config';

let server: http.Server | null = null;
let cachedUrl: string | null = null;
let cachedTimestamp = 0;

const PORT = 19876;
const HOST = '127.0.0.1';
const STALE_MS = 30_000;

export function getLastUrl(): string | null {
  const settings = getTrackerSettings();
  if (!settings?.trackUrls) return null;
  if (Date.now() - cachedTimestamp > STALE_MS) return null;
  return cachedUrl;
}

export function startUrlBridge(): void {
  const settings = getTrackerSettings();
  if (!settings?.trackUrls) {
    console.log('[URLBridge] trackUrls disabled — skipping');
    return;
  }

  server = http.createServer((req, res) => {
    if (req.url === '/url' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          cachedUrl = parsed.url ?? null;
          cachedTimestamp = Date.now();
        } catch {
          // ignore malformed JSON
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    if (req.url === '/url' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: cachedUrl, timestamp: cachedTimestamp }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[URLBridge] Port 19876 in use, URL tracking disabled');
      server = null;
      return;
    }
    console.error('[URLBridge] Server error:', err.message);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[URLBridge] Listening on ${HOST}:${PORT}`);
  });
}

export function stopUrlBridge(): void {
  if (server) {
    server.close();
    server = null;
    console.log('[URLBridge] Stopped');
  }
}
