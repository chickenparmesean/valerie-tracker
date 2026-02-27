import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import { config } from './config';

/** Shape of C:\ProgramData\ValerieTracker\config.json */
interface TrackerConfigFile {
  apiBaseUrl: string;
  apiKey: string;
  vaId: string;
  screenshotFreq?: number;
  idleTimeoutMin?: number;
  blurScreenshots?: boolean;
  trackApps?: boolean;
  trackUrls?: boolean;
}

/** Merged settings (server config wins over local) */
export interface TrackerSettings {
  vaId: string;
  screenshotFreq: number;
  idleTimeoutMin: number;
  blurScreenshots: boolean;
  trackApps: boolean;
  trackUrls: boolean;
}

export type TrackerInitResult =
  | { status: 'ready'; settings: TrackerSettings }
  | { status: 'not-configured' }
  | { status: 'key-invalid' };

const CONFIG_JSON_PATH = path.join('C:', 'ProgramData', 'ValerieTracker', 'config.json');

let cachedApiKey: string | null = null;
let cachedSettings: TrackerSettings | null = null;
let lastError: 'not-configured' | 'key-invalid' | null = null;

/** Get the currently loaded API key (null if not initialized) */
export function getApiKey(): string | null {
  return cachedApiKey;
}

/** Get the merged tracker settings (null if not initialized) */
export function getTrackerSettings(): TrackerSettings | null {
  return cachedSettings;
}

/** Get the last error from init (for ErrorScreen) */
export function getTrackerError(): 'not-configured' | 'key-invalid' | null {
  return lastError;
}

/** Check if tracker config is ready for tracking */
export function isTrackerReady(): boolean {
  return cachedApiKey !== null && cachedSettings !== null;
}

/**
 * Initialize tracker config. Call after app.isReady().
 *
 * 1. Check safeStorage for cached API key + apiBaseUrl
 * 2. If not cached, read config.json from ProgramData
 * 3. Cache apiKey + apiBaseUrl in safeStorage
 * 4. Ping server to validate key
 * 5. Fetch server config, merge with local (server wins)
 * 6. Cache merged settings for offline starts
 * 7. Handle offline: use cached settings if available
 */
export async function initTrackerConfig(): Promise<TrackerInitResult> {
  lastError = null;

  // Always read config.json first — it's the source of truth when present.
  // This ensures admin changes to config.json (e.g. new apiBaseUrl) take
  // effect immediately instead of being masked by stale safeStorage cache.
  let localConfig: TrackerConfigFile | null = readConfigFile();
  let apiKey: string | null = null;
  let apiBaseUrl: string | null = null;

  if (localConfig) {
    // config.json exists — use its values (overrides any cache)
    apiKey = localConfig.apiKey;
    apiBaseUrl = localConfig.apiBaseUrl;
  } else {
    // No config.json — fall back to safeStorage cache (admin may have
    // deleted config.json after first run for security)
    apiKey = loadCachedApiKey();
    apiBaseUrl = loadCachedApiBaseUrl();
  }

  if (!apiKey) {
    lastError = 'not-configured';
    return { status: 'not-configured' };
  }

  // At this point apiKey is guaranteed non-null
  const resolvedKey: string = apiKey;
  const resolvedUrl: string = apiBaseUrl || 'http://localhost:3000';

  // Step 3: Cache in safeStorage
  cacheApiKey(resolvedKey);
  cacheApiBaseUrl(resolvedUrl);

  // Update the global config with the apiBaseUrl
  cachedApiKey = resolvedKey;
  config.apiBaseUrl = resolvedUrl;

  // Step 4: Ping server to validate key
  const pingOk = await pingServer(resolvedUrl, resolvedKey);

  if (pingOk === 'unauthorized') {
    lastError = 'key-invalid';
    cachedApiKey = null;
    clearCachedApiKey();
    return { status: 'key-invalid' };
  }

  if (pingOk === 'offline') {
    // OFFLINE BEHAVIOR: use cached settings if available
    const offlineSettings = loadCachedSettings();
    if (offlineSettings) {
      cachedSettings = offlineSettings;
      console.log('Tracker: offline, using cached settings');
      return { status: 'ready', settings: offlineSettings };
    }
    // No cached settings and can't reach server — use local config defaults
    if (localConfig) {
      const fallback = buildSettingsFromLocal(localConfig);
      cachedSettings = fallback;
      saveCachedSettings(fallback);
      return { status: 'ready', settings: fallback };
    }
    // Have a key but no settings and can't reach server — still start with defaults
    const defaults = getDefaultSettings();
    cachedSettings = defaults;
    return { status: 'ready', settings: defaults };
  }

  // Step 5: Fetch server config
  const serverSettings = await fetchServerConfig(resolvedUrl, resolvedKey);

  // Step 6: Merge settings (server wins over local config.json)
  if (!localConfig) {
    localConfig = readConfigFile();
  }
  const localSettings = localConfig ? buildSettingsFromLocal(localConfig) : getDefaultSettings();
  const merged = serverSettings
    ? mergeSettings(localSettings, serverSettings)
    : localSettings;

  cachedSettings = merged;

  // Cache merged settings for offline starts
  saveCachedSettings(merged);

  return { status: 'ready', settings: merged };
}

// --- SafeStorage helpers ---

function loadCachedApiKey(): string | null {
  try {
    if (!fs.existsSync(config.apiKeyCachePath)) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const encrypted = fs.readFileSync(config.apiKeyCachePath);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

function cacheApiKey(apiKey: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    const encrypted = safeStorage.encryptString(apiKey);
    fs.writeFileSync(config.apiKeyCachePath, encrypted);
  } catch {
    // safeStorage may not be available
  }
}

function clearCachedApiKey(): void {
  try {
    if (fs.existsSync(config.apiKeyCachePath)) {
      fs.unlinkSync(config.apiKeyCachePath);
    }
  } catch {
    // ignore
  }
}

function loadCachedApiBaseUrl(): string | null {
  try {
    const raw = readCachedSettingsRaw();
    return raw?.apiBaseUrl ?? null;
  } catch {
    return null;
  }
}

function cacheApiBaseUrl(apiBaseUrl: string): void {
  // Stored in the cached settings file alongside settings
  try {
    const raw = readCachedSettingsRaw() ?? {};
    raw.apiBaseUrl = apiBaseUrl;
    fs.writeFileSync(config.cachedSettingsPath, JSON.stringify(raw, null, 2));
  } catch {
    // ignore
  }
}

// --- Config file reading ---

function readConfigFile(): TrackerConfigFile | null {
  try {
    if (!fs.existsSync(CONFIG_JSON_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.apiKey || !parsed.apiBaseUrl) return null;
    return parsed as TrackerConfigFile;
  } catch {
    return null;
  }
}

// --- Cached settings ---

interface CachedSettingsFile {
  apiBaseUrl?: string;
  settings?: TrackerSettings;
}

function readCachedSettingsRaw(): CachedSettingsFile | null {
  try {
    if (!fs.existsSync(config.cachedSettingsPath)) return null;
    const raw = fs.readFileSync(config.cachedSettingsPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadCachedSettings(): TrackerSettings | null {
  const raw = readCachedSettingsRaw();
  return raw?.settings ?? null;
}

function saveCachedSettings(settings: TrackerSettings): void {
  try {
    const existing = readCachedSettingsRaw() ?? {};
    existing.settings = settings;
    fs.writeFileSync(config.cachedSettingsPath, JSON.stringify(existing, null, 2));
  } catch {
    // ignore
  }
}

// --- Server communication ---

async function pingServer(
  apiBaseUrl: string,
  apiKey: string
): Promise<'ok' | 'unauthorized' | 'offline'> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/tracker/ping`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'unauthorized';
    return 'offline';
  } catch {
    return 'offline';
  }
}

async function fetchServerConfig(
  apiBaseUrl: string,
  apiKey: string
): Promise<Partial<TrackerSettings> | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/tracker/config`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      screenshotFreq: data.screenshotFreq,
      idleTimeoutMin: data.idleTimeoutMin,
      blurScreenshots: data.blurScreenshots,
      trackApps: data.trackApps,
      trackUrls: data.trackUrls,
    };
  } catch {
    return null;
  }
}

// --- Settings helpers ---

function getDefaultSettings(): TrackerSettings {
  return {
    vaId: '',
    screenshotFreq: 1,
    idleTimeoutMin: 5,
    blurScreenshots: false,
    trackApps: true,
    trackUrls: true,
  };
}

function buildSettingsFromLocal(localConfig: TrackerConfigFile): TrackerSettings {
  return {
    vaId: localConfig.vaId ?? '',
    screenshotFreq: localConfig.screenshotFreq ?? 1,
    idleTimeoutMin: localConfig.idleTimeoutMin ?? 5,
    blurScreenshots: localConfig.blurScreenshots ?? false,
    trackApps: localConfig.trackApps ?? true,
    trackUrls: localConfig.trackUrls ?? true,
  };
}

function mergeSettings(
  local: TrackerSettings,
  server: Partial<TrackerSettings>
): TrackerSettings {
  return {
    vaId: local.vaId,
    screenshotFreq: server.screenshotFreq ?? local.screenshotFreq,
    idleTimeoutMin: server.idleTimeoutMin ?? local.idleTimeoutMin,
    blurScreenshots: server.blurScreenshots ?? local.blurScreenshots,
    trackApps: server.trackApps ?? local.trackApps,
    trackUrls: server.trackUrls ?? local.trackUrls,
  };
}
