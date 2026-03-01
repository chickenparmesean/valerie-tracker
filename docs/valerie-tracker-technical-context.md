# Valerie Tracker -- Technical Context

> Comprehensive reference for anyone (human or AI) integrating the Valerie Agent into va-platform.
> Based on actual source code as of v0.2.0, branch: staging.

---

## 1. Architecture Overview

### Process Model

Valerie Agent is an Electron 34 desktop app with three process types:

- **Main process** (`agent/src/main/index.ts`) -- Node.js runtime. Runs all data collection, sync, auth, and system integration. 15 modules.
- **Renderer process** (`agent/src/renderer/App.tsx`) -- Chromium-based React UI. 4 screens: Loading, LoginScreen (dev-only), MainScreen, ErrorScreen. Plus IdleDialog overlay.
- **Preload process** (`agent/src/preload/index.ts`) -- Bridge between main and renderer via `contextBridge.exposeInMainWorld('electronAPI', ...)`. Enforces `contextIsolation: true` and `nodeIntegration: false`.

### Startup Sequence

1. Load `.env` via dotenv (tries 3 paths)
2. Disable GPU acceleration (`app.disableHardwareAcceleration()` + 5 Chromium flags -- required for AWS WorkSpaces)
3. `app.whenReady()` fires
4. Initialize SQLite database (`initDatabase()`)
5. **Normal mode** (no `--dev` flag):
   - `initAuth()` (no-op in normal mode)
   - `registerIpcHandlers()`
   - `createWindow()` (380x640 BrowserWindow)
   - `initTrackerConfig()` -- reads config.json, validates API key, fetches server config
   - If `status === 'ready'`: send `config:ready` to renderer, `startEngines()`, `resumeTimer()`
   - If failed: send `config:error` to renderer (shows ErrorScreen)
6. **Dev mode** (`--dev` flag):
   - Full Supabase Auth flow (LoginScreen)
   - `restoreSession()` from safeStorage
   - If restored: `startAutoRefresh()`, `startEngines()`, `resumeTimer()`
7. `enableAutoLaunch()` -- writes Registry Run key
8. `initAutoUpdater()` -- checks GitHub Releases (non-dev only)

### Auto-Start

The agent registers itself in the Windows Registry at `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` with key `ValerieAgent` pointing to the exe path. This ensures the agent starts on Windows login.

### System Tray vs BrowserWindow

- The BrowserWindow is the main UI (380x640, resizable, frame: true)
- On close, the window hides to tray instead of quitting (`event.preventDefault()` + `mainWindow.hide()`)
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
| Renderer -> Main | `idle:respond` | send | User's idle dialog choice |
| Main -> Renderer | `timer:update` | send | Every-second timer tick |
| Main -> Renderer | `timer:stopped` | send | Timer was stopped |
| Main -> Renderer | `idle:prompt` | send | Idle threshold exceeded |
| Main -> Renderer | `screenshot:captured` | send | Screenshot was taken |
| Main -> Renderer | `config:ready` | send | Config loaded successfully |
| Main -> Renderer | `config:error` | send | Config load failed |

---

## 2. Data Collection

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
- **Logic**: On start, generates UUID, persists to SQLite `active_time_entry` table (single-row, id=1). Immediately queues a RUNNING sync. Every 1s, recalculates `elapsedSec` and emits `timer:update` to renderer. On stop, queues a STOPPED sync with final `durationSec`, `activeSec`, `idleSec`, and `stoppedAt`. Clears `active_time_entry`. On app restart, `resumeTimer()` reads `active_time_entry` and resumes if status is RUNNING.

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
- **Logic**: Capture PNG via `screenshot-desktop`, compress to WebP quality 75 via `sharp`, save to `%APPDATA%/Valerie Agent/screenshots/{uuid}.webp`. Queue in `screenshot_queue` SQLite table. Sync engine uploads via presigned URL, then queues metadata for `/api/tracker/sync`. After successful upload, deletes local file. Shows desktop notification: "Screenshot captured".
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
    durationSec: number;      // how long this app was in foreground
    timeEntryId: string;      // parent TimeEntry's idempotencyKey
  }
  ```
- **Logic**: Uses heartbeat pattern via `@miniben90/x-win`. Every 3s, gets active window. If same app as current, extends `durationSec`. If different app, finalizes previous window sample (adds to pending list), starts new one. Every 60s, flushes all pending samples to sync queue. On engine stop, flushes remaining samples.

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
  status TEXT DEFAULT 'RUNNING'
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
    "windowSamples": [...],
    "screenshots": [...]
  }
  ```
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

#### 8. `GET /api/time-entries?date={yyyy-MM-dd}`

- **When**: MainScreen polls today's total every 30 seconds
- **Headers**: `Authorization: Bearer vt_...`
- **Response 200**: Array of time entry objects

---

## 5. Authentication

### config.json Location and Fields

**Primary**: `C:\ProgramData\ValerieAgent\config.json`
**Fallback**: `C:\ProgramData\ValerieTracker\config.json`

```json
{
  "apiBaseUrl": "https://valerie-tracker-web.vercel.app",
  "apiKey": "vt_a1b2c3d4e5f6...",
  "vaId": "test-va-001",
  "screenshotFreq": 1,
  "idleTimeoutMin": 5,
  "blurScreenshots": false,
  "trackApps": true,
  "trackUrls": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| apiBaseUrl | string | Yes | -- | URL of the API server |
| apiKey | string | Yes | -- | Must start with `vt_`, maps to `trackerApiKey` on User model |
| vaId | string | No | `''` | Informational VA identifier |
| screenshotFreq | number | No | 1 | Screenshots per 10-min interval |
| idleTimeoutMin | number | No | 5 | Minutes before idle dialog |
| blurScreenshots | boolean | No | false | Whether to blur captures |
| trackApps | boolean | No | true | Track foreground app names |
| trackUrls | boolean | No | true | Track browser URLs |

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
| blurScreenshots | config.json + server | Server wins |
| trackApps | config.json + server | Server wins |
| trackUrls | config.json + server | Server wins |

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
- Header: Valerie Agent logo + brand name (dark nav bar `#1A1A2E`)
- Project list: expandable projects with nested tasks, play buttons, inline task creation
- Timer section: status dot (green/gray), current project/task name, `HH : MM : SS` display, STOP button
- Note input: text field for adding notes (visible when timer is running)
- Today total: "Today: Xh Xm" footer (polls API every 30s)

**ErrorScreen** (`agent/src/renderer/screens/ErrorScreen.tsx`):
- Two states: "Tracker not configured" (no config.json) and "API key is invalid or revoked"
- Retry button that re-runs `initTrackerConfig()`

**IdleDialog** (`agent/src/renderer/screens/IdleDialog.tsx`):
- Modal overlay shown when idle threshold exceeded
- Three buttons: "Keep Time & Resume", "Discard Idle Time & Resume", "Discard & Stop Timer"

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

1. **Auto-update unreliable** -- electron-updater detects and downloads updates from GitHub Releases, but NSIS install-on-restart does not consistently work. Current deployment method: download latest installer from GitHub Releases and run manually (overwrites previous install).

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

8. **activeTitle not populated** -- WindowSample's `activeTitle` field in screenshot metadata is always empty string (`''`).

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
