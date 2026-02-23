import Database from 'better-sqlite3';
import { config } from './config';

let db: Database.Database;

export function initDatabase(): void {
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS screenshot_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      file_path TEXT NOT NULL,
      metadata TEXT NOT NULL,
      uploaded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      uploaded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS active_time_entry (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      idempotency_key TEXT NOT NULL,
      project_id TEXT NOT NULL,
      task_id TEXT,
      started_at TEXT NOT NULL,
      status TEXT DEFAULT 'RUNNING'
    );
  `);
}

export function getDb(): Database.Database {
  return db;
}

export function queueForSync(
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey: string
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sync_outbox (type, payload, idempotency_key, synced)
    VALUES (?, ?, ?, 0)
  `);
  stmt.run(type, JSON.stringify(payload), idempotencyKey);
}

export function getUnsyncedItems(limit = 100): Array<{
  type: string;
  payload: string;
  idempotency_key: string;
}> {
  const stmt = db.prepare(
    'SELECT type, payload, idempotency_key FROM sync_outbox WHERE synced = 0 ORDER BY id ASC LIMIT ?'
  );
  return stmt.all(limit) as Array<{
    type: string;
    payload: string;
    idempotency_key: string;
  }>;
}

export function markSynced(idempotencyKeys: string[]): void {
  const stmt = db.prepare(
    `UPDATE sync_outbox SET synced = 1, synced_at = datetime('now') WHERE idempotency_key = ?`
  );
  const transaction = db.transaction((keys: string[]) => {
    for (const key of keys) {
      stmt.run(key);
    }
  });
  transaction(idempotencyKeys);
}

export function queueScreenshot(
  idempotencyKey: string,
  filePath: string,
  metadata: Record<string, unknown>
): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO screenshot_queue (idempotency_key, file_path, metadata)
    VALUES (?, ?, ?)
  `);
  stmt.run(idempotencyKey, filePath, JSON.stringify(metadata));
}

export function getUnuploadedScreenshots(limit = 5): Array<{
  idempotency_key: string;
  file_path: string;
  metadata: string;
}> {
  const stmt = db.prepare(
    'SELECT idempotency_key, file_path, metadata FROM screenshot_queue WHERE uploaded = 0 ORDER BY id ASC LIMIT ?'
  );
  return stmt.all(limit) as Array<{
    idempotency_key: string;
    file_path: string;
    metadata: string;
  }>;
}

export function markScreenshotUploaded(idempotencyKey: string): void {
  const stmt = db.prepare(
    `UPDATE screenshot_queue SET uploaded = 1, uploaded_at = datetime('now') WHERE idempotency_key = ?`
  );
  stmt.run(idempotencyKey);
}

export function saveActiveTimeEntry(entry: {
  idempotencyKey: string;
  projectId: string;
  taskId?: string;
  startedAt: string;
}): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO active_time_entry (id, idempotency_key, project_id, task_id, started_at, status)
    VALUES (1, ?, ?, ?, ?, 'RUNNING')
  `);
  stmt.run(entry.idempotencyKey, entry.projectId, entry.taskId ?? null, entry.startedAt);
}

export function getActiveTimeEntry(): {
  idempotency_key: string;
  project_id: string;
  task_id: string | null;
  started_at: string;
  status: string;
} | undefined {
  const stmt = db.prepare('SELECT * FROM active_time_entry WHERE id = 1');
  return stmt.get() as {
    idempotency_key: string;
    project_id: string;
    task_id: string | null;
    started_at: string;
    status: string;
  } | undefined;
}

export function clearActiveTimeEntry(): void {
  db.prepare('DELETE FROM active_time_entry WHERE id = 1').run();
}
