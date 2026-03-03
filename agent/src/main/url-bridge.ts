import http from 'http';
import { getTrackerSettings } from './tracker-config';

let server: http.Server | null = null;
let cachedUrl: string | null = null;
let cachedTimestamp = 0;

const PORT = 19876;
const HOST = '127.0.0.1';
const STALE_MS = 30_000;

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function getLastUrl(): string | null {
  const settings = getTrackerSettings();
  if (!settings?.trackUrls) return null;
  const age = Date.now() - cachedTimestamp;
  if (age > STALE_MS) {
    console.log(`[URLBridge] getLastUrl() → null (stale: ${Math.round(age / 1000)}s old)`);
    return null;
  }
  if (!cachedUrl) {
    console.log('[URLBridge] getLastUrl() → null (no recent URL)');
    return null;
  }
  console.log(`[URLBridge] getLastUrl() → ${cachedUrl} (age: ${Math.round(age / 1000)}s)`);
  return cachedUrl;
}

export function startUrlBridge(): void {
  const settings = getTrackerSettings();
  if (!settings?.trackUrls) {
    console.log('[URLBridge] trackUrls disabled — skipping');
    return;
  }

  server = http.createServer((req, res) => {
    setCorsHeaders(res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/url' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          cachedUrl = parsed.url ?? null;
          cachedTimestamp = Date.now();
          console.log(`[URLBridge] Received URL: ${cachedUrl}`);
          console.log('[URLBridge] Cached URL updated (age: 0s)');
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
