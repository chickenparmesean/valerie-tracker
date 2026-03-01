import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export const isDevMode = process.argv.includes('--dev');

// Migrate old db file from "Valerie Tracker" installs
function migrateDbIfNeeded(newPath: string): string {
  if (fs.existsSync(newPath)) return newPath;
  const oldPath = path.join(app.getPath('userData'), 'valerie-tracker.db');
  if (oldPath !== newPath && fs.existsSync(oldPath)) {
    try {
      fs.renameSync(oldPath, newPath);
      // Also migrate WAL/SHM files if present
      for (const ext of ['-wal', '-shm']) {
        if (fs.existsSync(oldPath + ext)) fs.renameSync(oldPath + ext, newPath + ext);
      }
      console.log('Tracker: migrated database from valerie-tracker.db to valerie-agent.db');
    } catch {
      return oldPath; // migration failed, use old path
    }
  }
  return newPath;
}

let _apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  get apiBaseUrl(): string {
    return _apiBaseUrl;
  },
  set apiBaseUrl(url: string) {
    _apiBaseUrl = url;
  },
  syncIntervalMs: 60_000,
  screenshotIntervalMs: 600_000,
  activityPollMs: 1_000,
  windowPollMs: 3_000,
  idlePollMs: 30_000,
  defaultIdleThresholdSec: 300,
  dbPath: migrateDbIfNeeded(path.join(app.getPath('userData'), 'valerie-agent.db')),
  screenshotsDir: path.join(app.getPath('userData'), 'screenshots'),
  tokenPath: path.join(app.getPath('userData'), 'auth-token'),
  cachedSettingsPath: path.join(app.getPath('userData'), 'cached-settings.json'),
  apiKeyCachePath: path.join(app.getPath('userData'), 'api-key-cache'),
};
