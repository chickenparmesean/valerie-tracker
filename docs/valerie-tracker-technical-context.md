# Valerie Tracker -- Technical Context

> Comprehensive reference for anyone (human or AI) integrating the Valerie Agent into va-platform.
> Based on actual source code as of v0.3.7, branch: staging.

---

## 1. Architecture Overview

### Process Model

Valerie Agent is an Electron 34 desktop app with three process types:

- **Main process** (`agent/src/main/index.ts`) -- Node.js runtime. Runs all data collection, sync, auth, and system integration. 16 modules.
- **Renderer process** (`agent/src/renderer/App.tsx`) -- Chromium-based React UI. 4 screens: Loading, LoginScreen (dev-only), MainScreen, ErrorScreen. Plus IdleDialog overlay.
- **Preload process** (`agent/src/preload/index.ts`) -- Bridge between main and renderer via `contextBridge.exposeInMainWorld('electronAPI', ...)`. Enforces `contextIsolation: true` and `nodeIntegration: false`.

### Single Instance Lock (v0.2.3)

Before `app.whenReady()`, the agent calls `app.requestSingleInstanceLock()`. If another instance is already running, the new instance quits immediately. The existing instance receives a `second-instance` event and focuses/restores its main window. This prevents duplicate agents from running simultaneously.

### Graceful Shutdown (v0.2.3)

The `before-quit` event handler calls cleanup/stop on all engine modules: activity detection, URL bridge, window tracking, screenshot schedule, idle detection, sync engine, auto-updater, and tray. This ensures timers are flushed, pending data is saved, and resources are released on quit.

### Startup Sequence

1. Load `.env` via dotenv (tries 3 paths)
2. Disable GPU acceleration (`app.disableHardwareAcceleration()` + 5 Chromium flags -- required for AWS WorkSpaces)
3. Request single instance lock -- if another instance is running, focus it and quit (v0.2.3)
4. `app.whenReady()` fires
4. Initialize SQLite database (`initDatabase()`)
5. **Normal mode** (no `--dev` flag):
   - `initAuth()` (no-op in normal mode)
   - `registerIpcHandlers()`
   - `createWindow()` (380x640 BrowserWindow)
   - `initTrackerConfig()` -- reads config.json, validates API key, fetches server config
   - If `status === 'ready'`: send `config:ready` to renderer, `startEngines()` (includes `startUrlBridge()` for Chrome extension communication), `resumeTimer()`
   - If failed: send `config:error` to renderer (shows ErrorScreen)
6. **Dev mode** (`--dev` flag):
   - Full Supabase Auth flow (LoginScreen)
   - `restoreSession()` from safeStorage
   - If restored: `startAutoRefresh()`, `startEngines()`, `resumeTimer()`
7. `enableAutoLaunch()` -- writes HKLM Run key (machine-wide), falls back to HKCU if not elevated (v0.3.7)
8. `initAutoUpdater()` -- checks GitHub Releases (non-dev only)

### Auto-Start

The agent auto-launch uses a two-tier strategy (v0.3.7). The NSIS installer writes a machine-wide key at `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` with key `ValerieAgent` pointing to the exe path. This persists across all user profiles in golden images. At runtime, `enableAutoLaunch()` tries HKLM first (requires elevation), falls back to HKCU if not elevated, and cleans up the old HKCU key on successful HKLM write.

### System Tray vs BrowserWindow

- The BrowserWindow is the main UI (380x640, resizable, frame: true)
- On close while timer is NOT running, the window hides to tray instead of quitting (`event.preventDefault()` + `mainWindow.hide()`)
- On close while timer IS running, a native dialog appears via `dialog.showMessageBox`: "Stop tracking? Closing Valerie Agent will stop your timer and end the current work session. Any time tracked so far will be saved." with buttons "Keep Working" (cancels close) and "Stop & Close" (calls stopTimer() then app.quit()). Added in v0.2.8.
- Tray "Quit" always quits immediately without showing the close warning dialog
- The system tray icon is a programmatically-generated 16x16 colored square (green `#2D6A4F` when tracking, gray `#8E8E9A` when idle)
- Tray click toggles window visibility
- Tray tooltip updates every 1s with elapsed time
- Context menu: status label, elapsed time, Start/Stop Timer, Open Dashboard, Check for Updates, Quit

### IPC Communication

All renderer-to-main communication goes through the preload bridge. Channels:

| Direction | Channel | Type | Purpose |
|-----------|---------|------|---------|
| Renderer -> Main | `auth:login` | invoke | Sign in (dev mode) |
| Renderer -> Main | `auth:logout` | invoke | Sign out |
| Renderer -> Main | `auth:session` | invoke | Get auth state |
| Renderer -> Main | `timer:start` | invoke | Start timer (projectId, taskId?) |
| Renderer -> Main | `timer:stop` | invoke | Stop timer |
| Renderer -> Main | `timer:status` | invoke | Get current timer state |
| Renderer -> Main | `projects:list` | invoke | Fetch projects from API |
| Renderer -> Main | `config:retry` | invoke | Re-run initTrackerConfig |
| Renderer -> Main | `config:state` | invoke | Get config ready/error state |
| Renderer -> Main | `time:getTodayTotal` | invoke | Fetch today's total seconds from API |
| Renderer -> Main | `tasks:create` | invoke | Create task under project |
| Renderer -> Main | `app:version` | invoke | Get app version string |
| Renderer -> Main | `timer:setNote` | invoke | Set note text on current running time entry (v0.2.8) |
| Renderer -> Main | `idle:respond` | send | User's idle dialog choice |
| Main -> Renderer | `timer:update` | send | Every-second timer tick |
| Main -> Renderer | `timer:stopped` | send | Timer was stopped |
| Main -> Renderer | `idle:prompt` | send | Idle threshold exceeded |
| Main -> Renderer | `idle:dismissed` | send | Idle prompt auto-dismissed after autoStopIdleMin timeout (v0.2.7) |
| Main -> Renderer | `screenshot:captured` | send | Screenshot was taken |
| Main -> Renderer | `config:ready` | send | Config loaded successfully |
| Main -> Renderer | `config:error` | send | Config load failed |

---

## 2. Data Collection

> **Timer-gated collection (v0.2.2):** As of v0.2.2, all data collection (activity polling, window tracking, screenshot capture) is gated behind the timer running state. When the timer is not running, engines skip their poll cycles. This prevents any data capture when the VA is not actively tracking time.

### TimeEntry

- **What**: Tracks a continuous work session on a project/task
- **Trigger**: User clicks play button in MainScreen or tray menu
- **Interval**: Ticks every 1 second (UI update), syncs every 60 seconds
- **Data shape**:
  ```typescript
  {
    idempotencyKey: string;    // UUID v4, generated at start
    startedAt: string;         // ISO 8601 datetime
    stoppedAt?: string;        // ISO 8601 datetime (set on stop)
    durationSec?: number;      // elapsed seconds
    activeSec?: number;        // seconds with input activity
    idleSec?: number;          // seconds without input
    activityPct?: number;      // Math.round(activeSec / durationSec * 100)
    status: 'RUNNING' | 'STOPPED';
    projectId: string;         // cuid from server
    taskId?: string | null;    // cuid from server, null if taskless
  }
  ```
- **Logic**: On start, generates UUID, persists to SQLite `active_time_entry` table (single-row, id=1). Immediately queues a RUNNING sync. Every 1s, recalculates `elapsedSec` and emits `timer:update` to renderer. Every 60s, writes `last_tick_at` timestamp to `active_time_entry` for stale detection. On stop, queues a STOPPED sync with final `durationSec`, `activeSec`, `idleSec`, and `stoppedAt`. Clears `active_time_entry`. On app restart, `resumeTimer()` reads `active_time_entry` and checks if status is RUNNING. If the gap between now and `last_tick_at` (or `startedAt` if no tick recorded) exceeds the idle threshold, the timer is auto-stopped with `durationSec` reflecting actual work time up to the last known activity -- not including reboot/downtime gap. If the gap is within threshold, the timer resumes normally (v0.2.7). Note state: `currentNote` string managed via `setTimerNote()` export; note is included in the sync payload when queueing time entries. Note is reset to empty on stop (v0.2.8).

### ActivitySnapshot

- **What**: Per-minute activity percentage (input vs idle)
- **Trigger**: Automatic while timer is running
- **Interval**: Polls `powerMonitor.getSystemIdleTime()` every 1 second (`config.activityPollMs = 1000`). Creates snapshot every 60 seconds.
- **Data shape**:
  ```typescript
  {
    idempotencyKey: string;  // UUID v4
    timestamp: string;       // ISO 8601
    intervalSec: number;     // always 60
    activityPct: number;     // 0-100, round(activeSeconds / windowSeconds * 100)
    timeEntryId: string;     // parent TimeEntry's idempotencyKey
  }
  ```
- **Logic**: Each second, checks `powerMonitor.getSystemIdleTime()`. If < 1 second, marks as active. Also calls `incrementActivity(isActive)` on the timer to accumulate `activeSec`/`idleSec`. After 60 seconds, calculates percentage and queues for sync.
- **Threshold**: `idleTime < 1` second = active (no keylogging, no hook installation)

### Screenshot

- **What**: Full-screen capture compressed to WebP
- **Trigger**: Randomized within each 10-minute window
- **Interval**: Random offset between 30s and 570s (9.5 min) within each 10-min window (`config.screenshotIntervalMs = 600_000`)
- **Data shape** (metadata queued for sync):
  ```typescript
  {
    idempotencyKey: string;    // UUID v4
    capturedAt: string;        // ISO 8601
    activityPct: number;       // current activity % at capture time
    activeApp: string;         // current foreground app name
    activeTitle: string;       // always '' (not populated in current code)
    fileSizeBytes: number;     // WebP file size
    timeEntryId: string;       // parent TimeEntry's idempotencyKey
    // After upload, these are added:
    storageUrl: string;        // Supabase public URL
    storagePath: string;       // bucket path
  }
  ```
- **Logic**: Capture PNG via `screenshot-desktop`, compress to WebP quality 75 via `sharp`, save to `%APPDATA%/Valerie Agent/screenshots/{uuid}.webp`. Queue in `screenshot_queue` SQLite table. Sync engine uploads via presigned URL, then queues metadata (with `storageUrl` and `storagePath` set before outbox insert, fixed in v0.2.6) for `/api/tracker/sync`. After successful upload, deletes local file. Screenshots are captured silently (desktop notification removed in v0.2.6).
- **Compression**: WebP quality 75, typical size 73-96 KB per 1080p screenshot
- **Single monitor only**: `screenshot-desktop` captures primary monitor by default

### WindowSample

- **What**: Active foreground application tracking
- **Trigger**: Automatic while timer is running
- **Interval**: Polls every 3 seconds (`config.windowPollMs = 3000`). Flushes to sync queue every 60 seconds.
- **Data shape**:
  ```typescript
  {
    idempotencyKey: string;   // UUID v4
    timestamp: string;        // ISO 8601 (when app was first detected)
    appName: string;          // e.g. "Google Chrome"
    windowTitle: string;      // e.g. "GitHub - Google Chrome"
    processPath: string;      // e.g. "chrome.exe"
    pageTitle: string | null; // extracted Chrome page title (e.g. "GitHub") or null for non-Chrome apps
    url: string | null;       // full URL from Chrome extension (v0.3.0) or null for non-Chrome apps / extension not installed
    durationSec: number;      // how long this app was in foreground
    timeEntryId: string;      // parent TimeEntry's idempotencyKey
  }
  ```
- **Logic**: Uses heartbeat pattern via `@miniben90/x-win`. Every 3s, gets active window. If same app as current, extends `durationSec`. If different app, finalizes previous window sample (adds to pending list), starts new one. Every 60s, flushes all pending samples to sync queue. On engine stop, flushes remaining samples.
- **Page title extraction (v0.2.4)**: For Chrome windows, the agent strips the " - Google Chrome" suffix from the window title to extract the page title (e.g. "Gmail - Inbox - Google Chrome" becomes "Gmail - Inbox"). This is sent as the `pageTitle` field in the sync payload.
- **URL tracking via Chrome extension (v0.3.0)**: A Manifest V3 Chrome extension (`agent/chrome-extension/`) tracks the active tab URL via `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`. On every tab switch or page load, the extension POSTs `{ url: "https://..." }` to the agent's localhost HTTP bridge at `http://127.0.0.1:19876/url`. Internal Chrome pages (`chrome://`, `about:`, `devtools://`, `chrome-extension://`) are filtered to null by the extension. The agent's `url-bridge.ts` module caches the last received URL in memory with a timestamp. The window tracker calls `getLastUrl()` on each poll -- if the active app is Chrome and `trackUrls` is enabled, the cached URL is attached to the window sample; otherwise `url` is null. A 30-second staleness check ensures stale URLs are not reported if Chrome stops sending updates. The extension is invisible to the VA (no popup, no browser action, no content scripts). Degrades gracefully: if the extension is not installed or the bridge port is unavailable, `url` is simply null.

---

## 3. Local Storage

### SQLite Database

- **Engine**: better-sqlite3 with WAL mode
- **Location**: `%APPDATA%/Valerie Agent/valerie-agent.db` (migrates from `valerie-tracker.db` if found)
- **Tables**:

```sql
-- Outbox for all sync data (time entries, activity snapshots, window samples, screenshot metadata)
CREATE TABLE sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- 'time_entry' | 'activity_snapshot' | 'window_sample' | 'screenshot'
  payload TEXT NOT NULL,        -- JSON string
  idempotency_key TEXT UNIQUE NOT NULL,
  synced INTEGER DEFAULT 0,    -- 0 = pending, 1 = synced
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

-- Queue for screenshot files awaiting upload
CREATE TABLE screenshot_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,      -- local path to WebP file
  metadata TEXT NOT NULL,       -- JSON string with capture metadata
  uploaded INTEGER DEFAULT 0,   -- 0 = pending, 1 = uploaded
  created_at TEXT DEFAULT (datetime('now')),
  uploaded_at TEXT
);

-- Singleton row for crash recovery of running timer
CREATE TABLE active_time_entry (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  idempotency_key TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT,
  started_at TEXT NOT NULL,
  status TEXT DEFAULT 'RUNNING',
  last_tick_at TEXT              -- updated every 60s, used for stale timer detection on resume (v0.2.7)
);
```

- **Retention**: No automatic cleanup. Synced rows remain in `sync_outbox` with `synced = 1`.
- **Screenshot files**: Saved as `{uuid}.webp` in `%APPDATA%/Valerie Agent/screenshots/`. Deleted after successful upload.

---

## 4. Data Sync

### Sync Engine

- **Interval**: Every 60 seconds (`config.syncIntervalMs = 60_000`)
- **Batch size**: Up to 100 unsynced items per cycle (`getUnsyncedItems(100)`)
- **Screenshot uploads**: Up to 5 per cycle (`getUnuploadedScreenshots(5)`)
- **Retry**: Increments `retryCount` on failure. Max backoff defined as 300s but not currently applied to interval.
- **Offline behavior**: Items stay in SQLite outbox until connectivity returns. Timer continues locally.

### Endpoints Called by Agent

#### 1. `GET /api/tracker/ping`

- **When**: Startup (validates API key)
- **Headers**: `Authorization: Bearer vt_...`
- **Timeout**: 10 seconds (AbortSignal)
- **Response 200**: `{ "status": "ok", "userId": "clu..." }`
- **Response 401**: Key is invalid/revoked
- **Network error**: Treated as offline

#### 2. `GET /api/tracker/config`

- **When**: Startup (after successful ping)
- **Headers**: `Authorization: Bearer vt_...`
- **Timeout**: 10 seconds
- **Response 200**:
  ```json
  {
    "userId": "clu...",
    "orgId": "clu...",
    "screenshotFreq": 1,
    "idleTimeoutMin": 5,
    "blurScreenshots": false,
    "trackApps": true,
    "trackUrls": true
  }
  ```
- **Response 404**: `{ "error": "No active organization" }`

#### 3. `GET /api/tracker/projects`

- **When**: MainScreen loads, fetches project list
- **Headers**: `Authorization: Bearer vt_...`
- **Response 200**: Array of projects with nested tasks:
  ```json
  [
    {
      "id": "clu...",
      "name": "Project Name",
      "description": "...",
      "status": "ACTIVE",
      "requireTask": false,
      "color": "#4F46E5",
      "tasks": [
        { "id": "clu...", "title": "Task Name", "description": "...", "status": "OPEN", "sortOrder": 1 }
      ]
    }
  ]
  ```

#### 4. `POST /api/tracker/projects/{id}/tasks`

- **When**: User creates a task from MainScreen
- **Headers**: `Authorization: Bearer vt_...`, `Content-Type: application/json`
- **Request**: `{ "title": "Task Name" }`
- **Response 201**: Created task object

#### 5. `POST /api/tracker/sync`

- **When**: Every 60 seconds
- **Headers**: `Authorization: Bearer vt_...`, `Content-Type: application/json`
- **Request**:
  ```json
  {
    "timeEntries": [...],
    "activitySnapshots": [...],
    "windowSamples": [
      {
        "idempotencyKey": "uuid",
        "timestamp": "ISO 8601",
        "appName": "Google Chrome",
        "windowTitle": "GitHub - Google Chrome",
        "processPath": "chrome.exe",
        "pageTitle": "GitHub",
        "url": "https://github.com/...",
        "durationSec": 45,
        "timeEntryIdempotencyKey": "uuid"
      }
    ],
    "screenshots": [...]
  }
  ```
- **Note**: The `url` field on windowSamples was added in v0.3.0 via Chrome extension tracking. It is `null` for non-Chrome apps or when the extension is not installed.
- **Response 200**: `{ "synced": true, "counts": { "timeEntries": N, "activitySnapshots": N, "windowSamples": N, "screenshots": N } }`
- **Response 401**: Unauthorized

#### 6. `POST /api/tracker/screenshots/presign`

- **When**: Before uploading each screenshot file
- **Headers**: `Authorization: Bearer vt_...`, `Content-Type: application/json`
- **Request**: `{ "fileName": "{uuid}.webp", "contentType": "image/webp", "orgId": "default" }`
- **Response 200**:
  ```json
  {
    "uploadUrl": "https://...supabase.co/storage/v1/...?token=...",
    "storagePath": "default/{userId}/{yyyy-MM-dd}/{uuid}.webp",
    "publicUrl": "https://...supabase.co/storage/v1/object/public/screenshots/..."
  }
  ```

#### 7. `PUT {uploadUrl}` (Supabase Storage direct upload)

- **When**: After getting presigned URL
- **Headers**: `Content-Type: image/webp`
- **Body**: Raw WebP file buffer

#### 8. `GET /api/tracker/time-entries?date={yyyy-MM-dd}`

- **When**: MainScreen polls today's total every 30 seconds
- **Headers**: `Authorization: Bearer vt_...`
- **Response 200**: Array of time entry objects with `durationSec` field. Agent sums all `durationSec` values and adds elapsed seconds for any currently RUNNING entry.
- **Response 200**: Returns `{ entries: [{ id, idempotencyKey, startedAt, stoppedAt, durationSec, status, projectId, taskId }] }`. Built on va-platform as of 2026-03-03.
- **Response 404**: Agent falls back to summing local SQLite time entries from the sync outbox (legacy fallback, should no longer occur).

---

## 5. Authentication

### config.json Location and Fields

**Primary**: `C:\ProgramData\ValerieAgent\config.json`
**Fallback**: `C:\ProgramData\ValerieTracker\config.json`

**Only `apiKey` and `apiBaseUrl` are required.** The server resolves `orgId` and `userId` from the API key via `/api/tracker/ping` and `/api/tracker/config`. All other settings are optional -- the server provides them automatically.

**Production provisioning:** In production, va-platform provisions config.json automatically via AWS SSM RunCommand. When a VA is hired and their WorkSpace becomes AVAILABLE, the `sync-activity` cron calls `deployTrackerConfig()` which uses SSM to write config.json (containing only `apiKey` and `apiBaseUrl`) to this path. Zero manual setup required.

**Minimum required config:**
```json
{
  "apiBaseUrl": "https://staging.hirevalerie.com",
  "apiKey": "vt_a1b2c3d4e5f6..."
}
```

**Full example (all optional fields shown):**
```json
{
  "apiBaseUrl": "https://staging.hirevalerie.com",
  "apiKey": "vt_a1b2c3d4e5f6...",
  "screenshotFreq": 1,
  "idleTimeoutMin": 5,
  "autoStopIdleMin": 15,
  "blurScreenshots": false,
  "trackApps": true,
  "trackUrls": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| apiBaseUrl | string | **Yes** | -- | URL of the API server. The agent syncs to va-platform at staging.hirevalerie.com. |
| apiKey | string | **Yes** | -- | Must start with `vt_`, maps to `trackerApiKey` on User model. The server resolves `orgId` and `userId` from this key -- they do NOT need to be in config.json. |
| screenshotFreq | number | No | server-provided or 1 | Screenshots per 10-min interval |
| idleTimeoutMin | number | No | server-provided or 5 | Minutes before idle dialog |
| autoStopIdleMin | number | No | server-provided or 15 | Minutes before unanswered idle prompt auto-stops timer (v0.2.7) |
| blurScreenshots | boolean | No | server-provided or false | Whether to blur captures |
| trackApps | boolean | No | server-provided or true | Track foreground app names |
| trackUrls | boolean | No | server-provided or true | Controls Chrome extension URL tracking. If true, url-bridge.ts starts listening on port 19876 and window-tracker attaches URLs from the extension to Chrome window samples. If false, url-bridge does not start and url is always null. |

### SafeStorage Caching

- API key cached at: `%APPDATA%/Valerie Agent/api-key-cache` (encrypted via Windows DPAPI)
- Settings + apiBaseUrl cached at: `%APPDATA%/Valerie Agent/cached-settings.json`
- Legacy paths checked as fallback: `%APPDATA%/Valerie Tracker/` (from pre-rebrand installs)

### Startup Auth Sequence (11 steps)

1. **Read config.json** -- check primary path, then legacy fallback
2. **If config.json found**: use its `apiKey` and `apiBaseUrl` (overrides any cache)
3. **If config.json NOT found**: fall back to safeStorage cached API key and cached apiBaseUrl
4. **If no key anywhere**: return `not-configured` (ErrorScreen shows)
5. **Cache API key** in safeStorage (encrypted)
6. **Cache apiBaseUrl** in cached-settings.json
7. **Ping server** (`GET /api/tracker/ping` with 10s timeout)
8. **If 401**: return `key-invalid` (ErrorScreen shows), clear cached key
9. **If offline**: use cached settings if available, otherwise build from config.json defaults, start tracking
10. **If 200**: fetch server config (`GET /api/tracker/config`), merge with local settings (server wins)
11. **Cache merged settings** for future offline starts, return `ready`

### Offline Fallback Behavior

When the server is unreachable but a valid API key exists:
- If cached settings exist: use them, start tracking normally
- If config.json exists but no cached settings: build settings from config.json defaults, start tracking
- If only a cached key (no settings, no config.json): use hardcoded defaults, start tracking
- All data queues in SQLite outbox for later sync

---

## 6. Task/Project Model

### Server-Side Structure

- **Organization** owns **Projects** (via `orgId`)
- **Project** contains **Tasks** (via `projectId`)
- **Project** has `requireTask: boolean` -- if true, user must select a task before starting timer
- **Task** has `status` (OPEN, IN_PROGRESS, COMPLETED, ARCHIVED) and `sortOrder`
- **TaskAssignment** links Users to Tasks (many-to-many)

### Agent Behavior

- On MainScreen load, fetches `GET /api/tracker/projects` which returns projects with nested tasks
- Projects display as expandable list. Each project shows tasks when expanded.
- If `project.requireTask === false`, the project row itself has a play button (taskless tracking)
- Each task row has a play button
- User can create tasks inline via "+ Add task" UI
- Timer associates the `projectId` and optional `taskId` with the time entry

### Timer-to-Task Association

When `timer.start(projectId, taskId?)` is called:
- `projectId` is always set
- `taskId` is null if tracking at the project level (taskless)
- Both IDs are included in every time entry sync payload
- The server stores `projectId` (required FK) and `taskId` (nullable FK) on the TimeEntry record

---

## 7. Configuration

### Agent Config (config.ts)

All values are constants in `agent/src/main/config.ts`:

| Property | Value | Description |
|----------|-------|-------------|
| `syncIntervalMs` | 60,000 (1 min) | How often the sync engine runs |
| `screenshotIntervalMs` | 600,000 (10 min) | Screenshot window size |
| `activityPollMs` | 1,000 (1 sec) | Activity detection polling rate |
| `windowPollMs` | 3,000 (3 sec) | Window tracking polling rate |
| `idlePollMs` | 30,000 (30 sec) | Idle detection polling rate |
| `defaultIdleThresholdSec` | 300 (5 min) | Idle time before prompt shows |
| `dbPath` | `%APPDATA%/Valerie Agent/valerie-agent.db` | SQLite database |
| `screenshotsDir` | `%APPDATA%/Valerie Agent/screenshots/` | Local screenshot storage |
| `tokenPath` | `%APPDATA%/Valerie Agent/auth-token` | Supabase refresh token (dev mode) |
| `cachedSettingsPath` | `%APPDATA%/Valerie Agent/cached-settings.json` | Cached server settings |
| `apiKeyCachePath` | `%APPDATA%/Valerie Agent/api-key-cache` | Encrypted API key |
| `apiBaseUrl` | Dynamic getter/setter | Set from config.json or env `API_BASE_URL` |
| `supabaseUrl` | From env | Supabase URL (dev mode only) |
| `supabaseAnonKey` | From env | Supabase anon key (dev mode only) |

### Server-Side Config Merge

The server returns org-level settings via `GET /api/tracker/config`. These override local config.json values:

| Setting | Source | Priority |
|---------|--------|----------|
| vaId | config.json only | Local only |
| screenshotFreq | config.json + server | Server wins |
| idleTimeoutMin | config.json + server | Server wins |
| autoStopIdleMin | config.json + server | Server wins |
| blurScreenshots | config.json + server | Server wins |
| trackApps | config.json + server | Server wins |
| trackUrls | config.json + server | Server wins. Controls whether url-bridge.ts starts and whether window-tracker attaches Chrome URLs to window samples (v0.3.0). |

### Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `API_BASE_URL` | Agent (fallback) | Default apiBaseUrl if no config.json |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Agent (dev mode) | Supabase project URL |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Agent (dev mode) | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Web API | For presigned URLs and admin operations |
| `DATABASE_URL` | Web API (Prisma) | Postgres connection (PgBouncer) |
| `DIRECT_URL` | Web API (Prisma) | Postgres direct connection (migrations) |
| `GH_TOKEN` | Build only | GitHub token for `npm run publish:agent` |

---

## 8. UI Components

### Screens

**Loading** -- Centered "Loading..." text. Shown during startup while config is being validated.

**LoginScreen** (`agent/src/renderer/screens/LoginScreen.tsx`) -- Email/password form for Supabase Auth. Only shown in `--dev` mode. Not part of normal production flow.

**MainScreen** (`agent/src/renderer/screens/MainScreen.tsx`):
- Header: Valerie Agent logo + brand name (dark nav bar `#1A1A2E`), project refresh button (v0.2.2)
- Project list: expandable projects with nested tasks, play buttons, inline task creation
- Timer section: status dot (green/gray), status text ("Working -- [task]" or "Not tracking"), `HH : MM : SS` display, STOP button
- Note input: text field + submit button visible while timer is running. VA types a note, clicks submit, note is sent to main process via `timer:setNote` IPC and attached to the current time entry. Input clears after submit; VA does not see the note again. Note is included in the next sync payload (v0.2.8).
- Today total display: "Today: Xh Xm" footer, polls every 30s via time:getTodayTotal IPC, refreshes on timer start/stop, falls back to local SQLite sum if API returns 404 (v0.2.4)
- Fonts: DM Sans (body text), DM Mono (timer display)

**ErrorScreen** (`agent/src/renderer/screens/ErrorScreen.tsx`):
- Two states: "Tracker not configured" (no config.json) and "API key is invalid or revoked"
- Retry button that re-runs `initTrackerConfig()`

**IdleDialog** (`agent/src/renderer/screens/IdleDialog.tsx`):
- Modal overlay shown when idle threshold exceeded
- Three buttons: "Keep Time & Resume", "Discard Idle Time & Resume", "Discard & Stop Timer"
- If unanswered for `autoStopIdleMin` minutes (default 15), the dialog is auto-dismissed, timer is stopped, and idle time is discarded (v0.2.7)

### System Tray Menu Items

1. Status label: "Tracking: {projectId}" or "Not tracking" (disabled)
2. Elapsed time: "Elapsed: HH:MM:SS" (visible only when tracking, disabled)
3. Separator
4. Start/Stop Timer button
5. Separator
6. Open Dashboard (shows/focuses main window)
7. Check for Updates (triggers manual update check)
8. Separator
9. Quit (destroys tray and window)

---

## 9. Dependencies

### Native Modules (require rebuild for Electron)

| Module | Purpose | Why Native |
|--------|---------|-----------|
| `better-sqlite3` | Local SQLite database for sync outbox, screenshot queue, timer persistence | C++ SQLite binding, rebuilt for Electron 34.5.8 via `@electron/rebuild` |
| `sharp` | Screenshot WebP compression (quality 75) | Wraps libvips C library. Uses prebuilt `sharp-win32-x64` binary. |
| `@miniben90/x-win` | Active window detection (app name, title, process path) | Rust via napi-rs. Uses prebuilt `x-win.win32-x64-msvc` binary. |
| `screenshot-desktop` | Full-screen capture (PNG buffer) | Shells out to bundled .NET utility (`screenCapture_1.3.2.bat`) on Windows |

All native modules are listed in `asarUnpack` in `electron-builder.yml` so their `.node` binaries are extracted from the asar archive at runtime.

### Zero-Dependency Modules

| Module | Purpose |
|--------|---------|
| `url-bridge.ts` | Localhost HTTP server (127.0.0.1:19876) for Chrome extension communication. Uses Node.js built-in `http` module -- no new npm dependencies (v0.3.0). |
| `chrome-extension/` | Manifest V3 Chrome extension (background.js + manifest.json). Plain JavaScript, no npm dependencies, no build step (bundled as extraResource). |
| `build/pack-extension.js` | Packs chrome-extension/ into CRX3 binary by shelling out to `chrome.exe --pack-extension`. Build machine must have Chrome installed. Runs automatically before electron-builder (v0.3.2). No npm dependencies. |
| `build/generate-extension-key.js` | One-time RSA key generation for CRX signing. Node.js built-in `crypto` module. No npm dependencies. |

### Key Non-Native Dependencies

| Module | Purpose |
|--------|---------|
| `electron-updater` | Auto-update from GitHub Releases (checks every 4h) |
| `uuid` | Generate idempotency keys (v4 UUIDs) |
| `@supabase/supabase-js` | Supabase Auth client (dev mode only) |
| `dotenv` | Load .env file |
| `react` / `react-dom` | Renderer UI (React 19) |
| `vite` | Renderer bundler + dev server |

---

## 10. Known Limitations

1. **Auto-update unreliable** -- `electron-updater` detects and downloads updates from GitHub Releases, but NSIS install-on-restart does not consistently work. The only reliable deployment method is golden image rebuild with the updated installer. Do not rely on auto-update for production deployments.

2. **No code signing** -- `sign: false` in electron-builder.yml. `signAndEditExecutable: true` allows rcedit to embed the icon in the .exe without signing. SmartScreen may warn on untrusted machines, but this is not an issue for managed AWS WorkSpaces.

3. **Windows-only** -- The agent targets Windows x64 only. Native modules (`x-win`, `screenshot-desktop`, `better-sqlite3`, `sharp`) have Windows prebuilds. Registry Run key auto-launch is Windows-specific.

4. **Single-monitor screenshots** -- `screenshot-desktop` captures the primary monitor by default. Multi-monitor support exists in the library (`listDisplays()`) but is not implemented.

5. **WorkSpaces require Chromium flags** -- The following must be set before `app.whenReady()` in `index.ts`:
   - `app.disableHardwareAcceleration()`
   - `--disable-gpu`
   - `--no-sandbox`
   - `--disable-gpu-sandbox`
   - `--disk-cache-dir` (redirect to userData/Cache)
   - `--lang=en-US`
   Removing these will cause white screen / renderer crashes on AWS WorkSpaces.

6. **No automated tests** -- All testing was manual on AWS WorkSpace.

7. **No disk space guard** -- No logic to reduce screenshot quality or frequency when local storage is low.

8. **Full URLs captured with query params** -- Chrome extension captures full URLs including query parameters (e.g., LinkedIn authwall URLs with `?trk=...&session_redirect=...` tracking tokens). Future enhancement: URL truncation or query parameter stripping for privacy and storage efficiency.

9. **va-platform drops `url` field** -- Agent sends `url` in WindowSample sync payload as of v0.3.0, but va-platform's WindowSample model is missing the `url` column, so the sync Zod schema silently strips it. This is a va-platform task, not an agent limitation.

---

## 11. v0.3.5 End-to-End Test Results (2026-03-03)

Full chain verified on AWS WorkSpace:

- Extension force-installs via Chrome enterprise policy (ExtensionInstallForcelist), cannot be disabled by user
- URLs captured from Chrome active tab, sent through localhost HTTP bridge (127.0.0.1:19876), attached to WindowSample sync payloads
- Sync to staging.hirevalerie.com succeeds for all record types (time entries, activity snapshots, window samples, screenshots)
- Stale URL expiry works -- getLastUrl() returns null after 30s of no extension updates
- Screenshots capture, compress to WebP, queue for upload
- Activity polling, idle detection, timer start/stop all correct
- config.json only requires `apiKey` and `apiBaseUrl` -- server resolves `orgId` and `userId` from the API key
- Production provisioning via AWS SSM RunCommand confirmed working (va-platform `deployTrackerConfig()`)

8. **activeTitle not populated** -- WindowSample's `activeTitle` field in screenshot metadata is always empty string (`''`).

9. **URL extraction requires Chrome extension (v0.3.0)** -- Full URL tracking is implemented via a Manifest V3 Chrome extension that POSTs the active tab URL to the agent's localhost HTTP bridge. Requirements: (1) the Chrome extension must be installed (auto-installed via enterprise force-install policy from v0.3.5, or manually loaded unpacked), (2) Chrome must be the active foreground app, (3) port 19876 must be free on localhost, (4) `trackUrls` must be true in config. If any requirement is not met, the `url` field on window samples is null (graceful degradation). The extension is invisible to the VA. Force-install verified working on WorkSpace (2026-02-27).

10. **Debug logging in all engine modules** -- Console.log statements present in all engine modules (activity, window tracker, screenshot, sync, timer, IPC). Should be gated behind a `--verbose` flag before production release.

### Implemented Since v0.2.0

- **Single instance lock (v0.2.3)** -- `app.requestSingleInstanceLock()` prevents duplicate agent windows.
- **Graceful shutdown (v0.2.3)** -- `before-quit` handler stops all engines cleanly.
- **Timer-gated data collection (v0.2.2)** -- Activity, window tracking, and screenshots only run while timer is active.
- **Chrome page title extraction (v0.2.4)** -- `pageTitle` field derived from Chrome window titles.
- **Today total display (v0.2.4)** -- MainScreen shows cumulative tracked time for the day.
- **Project refresh button (v0.2.2)** -- Manual refresh in header.
- **Screenshot metadata fix (v0.2.6)** -- `storageUrl`/`storagePath` now set on metadata before outbox insert.
- **Screenshot notification removed (v0.2.6)** -- Screenshots captured silently, no desktop notification.
- **Stale timer detection on resume (v0.2.7)** -- `last_tick_at` persisted every 60s; on resume, gap check auto-stops stale timers with correct `durationSec`.
- **Auto-stop on prolonged unanswered idle (v0.2.7)** -- If idle prompt goes unanswered for `autoStopIdleMin` (default 15 min), timer auto-stops and idle time is discarded.
- **Close warning dialog (v0.2.8)** -- When window X is clicked while timer is running, native `dialog.showMessageBox` warns and offers "Keep Working" or "Stop & Close". If timer is not running, window hides to tray as before.
- **Note input wired end-to-end (v0.2.8)** -- `timer:setNote` IPC channel, `setTimerNote()` in timer.ts, note included in sync payload (previously always null).
- **Chrome extension URL tracking (v0.3.0)** -- Manifest V3 extension tracks active tab URL, POSTs to localhost HTTP bridge (127.0.0.1:19876). Window tracker attaches URL to Chrome window samples. NSIS installer bundles extension and writes Chrome registry keys. Gated behind `trackUrls` config flag.
- **CORS headers on URL bridge (v0.3.1)** -- Access-Control-Allow-Origin/Methods/Headers on all responses + OPTIONS preflight handler. Fixes extension fetch() being blocked.
- **App display name fix (v0.3.1)** -- package.json description shortened to "Valerie Agent" (was leaking into Task Manager and dashboard as display name).
- **CRX extension packaging (v0.3.1)** -- Persistent RSA signing key (extension.pem). Chrome extension packed as CRX binary via build/pack-extension.js. Extension ID changed to `lpdlfbkigloncemklhgcclimjfbglfkk`. Old registry keys cleaned up on install/uninstall.
- **CRX build pipeline fix (v0.3.2)** -- pack-extension.js now runs automatically before electron-builder in both build:agent and publish:agent scripts. Previously required manual CRX generation.
- **CRX2 to CRX3 format fix (v0.3.3)** -- Chrome 145 rejects CRX2 with CRX_HEADER_INVALID. pack-extension.js rewritten to use `chrome.exe --pack-extension` which always outputs CRX3. Same PEM key, same extension ID.
- **URL debug logging (v0.3.4)** -- url-bridge.ts logs incoming POSTs, cache updates, and getLastUrl() results with age. window-tracker.ts logs URL lookup and attachment status for Chrome samples.
- **Enterprise force-install policy (v0.3.5)** -- Chrome 145 blocks sideloaded CRX extensions with "can't verify" error. Switched to ExtensionInstallForcelist policy. NSIS installer writes update.xml manifest to C:\ProgramData\ValerieAgent\ and sets HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist. Old CRX registry keys (HKLM\SOFTWARE\Google\Chrome\Extensions\) removed. Reboot persistence verified on WorkSpace.

---

## Appendix A: Full API Route Reference

All routes require `Authorization: Bearer vt_...` header. Auth middleware: `web/src/lib/auth.ts` (`validateApiKey` -> looks up `trackerApiKey` on User model).

### Auth & Config

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create Supabase Auth user + Prisma User + Membership. Body: `{ email, name?, orgId, role, password }`. Response 201: `{ userId, email, supabaseId }` |
| GET | `/api/tracker/ping` | Validate API key. Response 200: `{ status: "ok", userId }` |
| GET | `/api/tracker/config` | Get org settings for authenticated VA. Response 200: `{ userId, orgId, screenshotFreq, idleTimeoutMin, blurScreenshots, trackApps, trackUrls }`. Response 404: no active membership. |

### Sync & Data

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/tracker/sync` | Receive batched data. Body: `{ timeEntries[], activitySnapshots[], windowSamples[], screenshots[] }`. Uses Zod validation. TimeEntries are upserted (idempotencyKey). Child records use `createMany` with `skipDuplicates`. Response 200: `{ synced: true, counts }` |
| GET | `/api/time-entries` | Query time entries. Params: `userId?`, `startDate?`, `endDate?`, `projectId?`, `date?`. VA can only query self. Response 200: array of entries with project/task includes. Limit 200. |
| GET | `/api/activity` | Query activity snapshots + window samples. Params: `userId?`, `date`. Response 200: `{ snapshots[], windowSamples[] }` |
| GET | `/api/dashboard/live` | Live VA tracking status. Returns all active VA members in org with: isTracking, currentProject, currentTask, elapsedSec, activityPct, currentApp, lastSyncAt. |

### Screenshots

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/tracker/screenshots/presign` | Get presigned upload URL. Body: `{ fileName, contentType, orgId }`. Response 200: `{ uploadUrl, storagePath, publicUrl }`. Storage path format: `{orgId}/{userId}/{yyyy-MM-dd}/{uuid}.webp` |
| GET | `/api/screenshots` | Query screenshot metadata. Params: `userId?`, `date`, `page`, `limit` (max 50). Response 200: `{ screenshots[], total, page, limit }`. Excludes soft-deleted. |
| DELETE | `/api/screenshots/[id]` | Soft-delete screenshot. VA can only delete own screenshots. 24-hour window from capture. Removes file from Supabase Storage. |

### Projects & Tasks

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tracker/projects` | List org projects with tasks. Params: `status?` (default ACTIVE). Includes tasks ordered by sortOrder. |
| POST | `/api/tracker/projects` | Create project. Body: `{ name, description?, requireTask?, color? }`. Response 201. |
| POST | `/api/tracker/projects/[id]/tasks` | Create task. Body: `{ title, description? }`. Auto-increments sortOrder. Response 201. |
| PATCH | `/api/tasks/[id]` | Update task. Body: `{ title?, status?, description? }`. Verifies org ownership. |
| GET | `/api/tracker/time-entries` | Fetch today's time entries for total display. Params: `date` (YYYY-MM-DD). Called every 30s while MainScreen is mounted. Returns `{ entries: [{ id, idempotencyKey, startedAt, stoppedAt, durationSec, status, projectId, taskId }] }`. Built on va-platform 2026-03-03. |

---

## Appendix B: Complete Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum UserRole {
  ADMIN
  CLIENT
  MANAGER
  VA
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  ARCHIVED
}

enum TimeEntryStatus {
  RUNNING
  STOPPED
  IDLE_PAUSED
  SYNCED
}

enum MembershipStatus {
  ACTIVE
  DEACTIVATED
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  supabaseId    String    @unique
  trackerApiKey String?   @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  memberships   Membership[]
  timeEntries   TimeEntry[]
  screenshots   Screenshot[]
  activitySnaps ActivitySnapshot[]
  windowSamples WindowSample[]
  taskAssignees TaskAssignment[]
}

model Organization {
  id              String    @id @default(cuid())
  name            String
  timezone        String    @default("UTC")
  screenshotFreq  Int       @default(1)
  idleTimeoutMin  Int       @default(5)
  trackUrls       Boolean   @default(true)
  trackApps       Boolean   @default(true)
  blurScreenshots Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  members         Membership[]
  projects        Project[]
}

model Membership {
  id            String           @id @default(cuid())
  role          UserRole
  status        MembershipStatus @default(ACTIVE)
  weeklyLimitHrs Float?
  payRate       Float?
  billRate      Float?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  userId        String
  user          User             @relation(fields: [userId], references: [id])
  orgId         String
  organization  Organization     @relation(fields: [orgId], references: [id])

  @@unique([userId, orgId])
  @@index([orgId, role])
}

model Project {
  id            String        @id @default(cuid())
  name          String
  description   String?
  status        ProjectStatus @default(ACTIVE)
  requireTask   Boolean       @default(false)
  color         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  orgId         String
  organization  Organization  @relation(fields: [orgId], references: [id])
  tasks         Task[]
  timeEntries   TimeEntry[]

  @@index([orgId, status])
}

model Task {
  id            String     @id @default(cuid())
  title         String
  description   String?
  status        TaskStatus @default(OPEN)
  sortOrder     Int        @default(0)
  isRecurring   Boolean    @default(false)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  projectId     String
  project       Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)

  assignees     TaskAssignment[]
  timeEntries   TimeEntry[]

  @@index([projectId, status])
}

model TaskAssignment {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([userId, taskId])
}

model TimeEntry {
  id              String          @id @default(cuid())
  startedAt       DateTime
  stoppedAt       DateTime?
  durationSec     Int?
  activeSec       Int?
  idleSec         Int?
  activityPct     Int?
  status          TimeEntryStatus @default(RUNNING)
  note            String?
  idempotencyKey  String          @unique
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  userId          String
  user            User            @relation(fields: [userId], references: [id])
  projectId       String
  project         Project         @relation(fields: [projectId], references: [id])
  taskId          String?
  task            Task?           @relation(fields: [taskId], references: [id])

  activitySnaps   ActivitySnapshot[]
  screenshots     Screenshot[]
  windowSamples   WindowSample[]

  @@index([userId, startedAt])
  @@index([projectId, startedAt])
  @@index([userId, status])
}

model ActivitySnapshot {
  id            String    @id @default(cuid())
  timestamp     DateTime
  intervalSec   Int       @default(60)
  activityPct   Int
  keyboardPct   Int?
  mousePct      Int?
  idempotencyKey String   @unique

  userId        String
  user          User      @relation(fields: [userId], references: [id])
  timeEntryId   String
  timeEntry     TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)

  @@index([userId, timestamp])
  @@index([timeEntryId, timestamp])
}

model Screenshot {
  id              String    @id @default(cuid())
  capturedAt      DateTime
  storageUrl      String
  storagePath     String
  activityPct     Int?
  activeApp       String?
  activeTitle     String?
  fileSizeBytes   Int?
  deletedByUser   Boolean   @default(false)
  deletedAt       DateTime?
  idempotencyKey  String    @unique

  userId          String
  user            User      @relation(fields: [userId], references: [id])
  timeEntryId     String
  timeEntry       TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)

  @@index([userId, capturedAt])
  @@index([timeEntryId, capturedAt])
}

model WindowSample {
  id            String    @id @default(cuid())
  timestamp     DateTime
  appName       String
  windowTitle   String?
  pageTitle     String?
  processPath   String?
  durationSec   Int
  idempotencyKey String   @unique

  userId        String
  user          User      @relation(fields: [userId], references: [id])
  timeEntryId   String
  timeEntry     TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)

  @@index([userId, timestamp])
  @@index([timeEntryId, timestamp])
}
```

---

## Appendix C: Screenshot Storage Architecture

### Supabase Storage Bucket

- **Bucket name**: `screenshots`
- **Access**: Private (not public)
- **Presigned URLs**: Used for both upload (agent) and viewing (dashboard)

### Path Format

```
{orgId}/{userId}/{yyyy-MM-dd}/{uuid}.webp
```

Example: `default/clu1234abc/2026-03-01/550e8400-e29b-41d4-a716-446655440000.webp`

Note: The agent currently sends `orgId: "default"` in the presign request. The server generates the actual path using `{orgId}/{userId}/{dateFolder}/{fileId}.webp` where `fileId` is a new UUID generated server-side (not the agent's idempotency key).

### Upload Flow

1. Agent captures screenshot (PNG via `screenshot-desktop`)
2. Agent compresses to WebP quality 75 via `sharp`
3. Agent saves to local disk: `%APPDATA%/Valerie Agent/screenshots/{idempotencyKey}.webp`
4. Agent queues in `screenshot_queue` SQLite table
5. Sync engine picks up unuploaded screenshots (max 5 per cycle)
6. Agent calls `POST /api/tracker/screenshots/presign` with `{ fileName, contentType, orgId }`
7. Server generates storage path, creates presigned upload URL via `supabase.storage.from('screenshots').createSignedUploadUrl(path)`
8. Server also gets public URL via `getPublicUrl(path)`
9. Agent uploads WebP buffer directly to Supabase Storage via `PUT {uploadUrl}`
10. Agent queues screenshot metadata (with `storageUrl` and `storagePath`) for sync
11. Agent marks screenshot as uploaded in SQLite
12. Agent deletes local WebP file

### Viewing Flow

Screenshots are stored in a private bucket. Viewing requires either:
- A signed URL (generated on demand by the dashboard backend)
- The public URL if the bucket is configured with public read access (not recommended)

The `storageUrl` field on the Screenshot model stores the public URL format. The `storagePath` field stores the bucket-relative path for operations like deletion.

### Deletion

`DELETE /api/screenshots/[id]`:
1. Soft-delete in Postgres (sets `deletedByUser: true`, `deletedAt: now()`)
2. Hard-delete from Supabase Storage via `supabase.storage.from('screenshots').remove([storagePath])`
3. Only the screenshot owner (VA) can delete, within 24 hours of capture

---

## Appendix D: Chrome Extension Architecture (v0.3.0 / v0.3.1)

### Purpose

Captures the full URL of the active Chrome tab and delivers it to the Electron agent for inclusion in WindowSample sync payloads. This supplements page title extraction (v0.2.4) with the actual URL.

### File Locations

| Location | Path | Description |
|----------|------|-------------|
| Extension source | `agent/chrome-extension/manifest.json` + `background.js` | Manifest V3 extension. Committed to repo. |
| RSA signing key | `agent/build/extension.pem` | 2048-bit RSA private key for CRX signing. Committed for reproducible builds. |
| CRX build script | `agent/build/pack-extension.js` | Packs chrome-extension/ into CRX3 binary via `chrome.exe --pack-extension`. No npm deps. Build machine needs Chrome. |
| Key generator | `agent/build/generate-extension-key.js` | One-time script (already run). Generates extension.pem + computes extension ID. |
| CRX output | `agent/build/valerie-url-bridge.crx` | Build artifact, not committed. Generated by pack-extension.js before electron-builder runs. |
| Installed (unpacked) | `C:\ProgramData\ValerieAgent\chrome-extension\` | Copied by NSIS installer. For Load Unpacked debugging. |
| Installed (CRX) | `C:\ProgramData\ValerieAgent\valerie-url-bridge.crx` | Copied by NSIS installer. Referenced by update.xml for force-install policy. |
| Update manifest | `C:\ProgramData\ValerieAgent\update.xml` | gupdate-format manifest pointing to local CRX file. Written by NSIS installer (v0.3.5). |
| Agent bridge module | `agent/src/main/url-bridge.ts` | Node.js HTTP server on 127.0.0.1:19876. Receives URLs from extension. |

### Extension Details

- **Manifest version**: 3 (MV3)
- **Permissions**: `tabs`, `activeTab`
- **Background**: Service worker (`background.js`)
- **Extension ID**: `lpdlfbkigloncemklhgcclimjfbglfkk` (derived from committed PEM key)
- **Previous ID**: `pdnlbaclbmfbipieaeknjkopdcafeepf` (v0.3.0, before CRX packaging)
- **manifest.json `key` field**: Contains the base64-encoded DER public key from extension.pem. This ensures the extension ID is stable across installs.
- **No popup, no browser action, no content scripts**: The extension is invisible to the VA.

### Communication Flow

```
Chrome Extension (background.js)
  |
  |  POST http://127.0.0.1:19876/url  { "url": "https://example.com/page" }
  |  (on every tab switch via chrome.tabs.onActivated)
  |  (on every page load via chrome.tabs.onUpdated, status === 'complete')
  |
  v
url-bridge.ts (Node.js http server)
  |
  |  Caches: cachedUrl = "https://example.com/page", cachedTimestamp = Date.now()
  |
  v
window-tracker.ts (every 3s poll)
  |
  |  if (activeApp is Chrome && trackUrls enabled):
  |    url = getLastUrl()   // returns cachedUrl if < 30s old, else null
  |  else:
  |    url = null
  |
  v
WindowSample sync payload: { ..., url: "https://example.com/page" }
```

### Internal Page Filtering

The extension filters these URL prefixes to null before POSTing:
- `chrome://`
- `chrome-extension://`
- `about:`
- `devtools://`

### Registry-Based Auto-Install

The NSIS installer writes Chrome external extension registry keys for automatic installation:

```
(v0.3.5 -- enterprise force-install policy, replaces CRX registry approach from v0.3.1-v0.3.4)

HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist
  1 = "lpdlfbkigloncemklhgcclimjfbglfkk;file:///C:/ProgramData/ValerieAgent/update.xml"

Old CRX registry keys (HKLM\SOFTWARE\Google\Chrome\Extensions\) cleaned up on install.
```

Both WOW6432Node (64-bit Chrome) and direct path (32-bit fallback) are written. On uninstall, both new and old (pdnlbaclbmfbipieaeknjkopdcafeepf) registry keys are cleaned up.

### CORS (v0.3.1)

The Chrome extension's `fetch()` call to `http://127.0.0.1:19876/url` is subject to CORS policy. The URL bridge sets these headers on all responses:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

An explicit `OPTIONS` preflight handler returns 204. Without these headers, Chrome blocks the extension's fetch with a CORS error.

### Debugging

1. **Check if extension is installed**: Open `chrome://extensions/` on the WorkSpace. Look for "Valerie Agent URL Bridge".
2. **Load Unpacked (manual install)**: Enable Developer mode in `chrome://extensions/`, click "Load unpacked", browse to `C:\ProgramData\ValerieAgent\chrome-extension\`.
3. **Check bridge is running**: From PowerShell: `Invoke-RestMethod -Uri http://127.0.0.1:19876/url`. Should return `{ url: "...", timestamp: ... }` if Chrome has reported a URL recently.
4. **Check agent logs**: Look for `[URLBridge] Listening on 127.0.0.1:19876` in agent stdout. If port is in use: `[URLBridge] Port 19876 in use, URL tracking disabled`.

### WorkSpace Persistence

- **Extension files**: Stored in `C:\ProgramData\ValerieAgent\` (C: drive, system volume). Survives WorkSpace image capture.
- **CRX file + update.xml**: Same location. Survives image capture.
- **Force-install policy**: Written to `HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist` (machine-wide). Survives image capture.
- **Golden image deployment**: Install the agent on a fresh WorkSpace, verify Chrome loads the extension (chrome://extensions shows it as force-installed by enterprise policy), then capture the image. All new WorkSpaces from this bundle will have the extension auto-installed and cannot be disabled by the user.

### Config Gating

The `trackUrls` config flag (default: `true`) controls whether the URL bridge starts:
- **If `trackUrls` is true**: `startUrlBridge()` creates the HTTP server on port 19876. `getLastUrl()` returns the cached URL (if < 30s old and Chrome is active).
- **If `trackUrls` is false**: `startUrlBridge()` is a no-op (logs "[URLBridge] trackUrls disabled -- skipping"). `getLastUrl()` always returns null. The Chrome extension still runs and POSTs, but nobody is listening (connection refused, silently caught by extension).
