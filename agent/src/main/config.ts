import path from 'path';
import { app } from 'electron';

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  syncIntervalMs: 60_000,
  screenshotIntervalMs: 600_000,
  activityPollMs: 1_000,
  windowPollMs: 3_000,
  idlePollMs: 30_000,
  defaultIdleThresholdSec: 300,
  dbPath: path.join(app.getPath('userData'), 'valerie-tracker.db'),
  screenshotsDir: path.join(app.getPath('userData'), 'screenshots'),
  tokenPath: path.join(app.getPath('userData'), 'auth-token'),
};
