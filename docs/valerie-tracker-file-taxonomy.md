# Valerie Tracker -- File Taxonomy

> Complete file tree with annotations. Tags indicate primary concern:
> - [DATA] -- Data collection logic
> - [SYNC] -- Sync/API logic
> - [AUTH] -- Authentication and identity
> - [UI] -- UI rendering
> - [TASK] -- Task/project management
> - [INTEGRATION] -- Critical for va-platform integration

---

## agent/src/main/ -- Electron Main Process (15 modules)

| File | Tags | Description |
|------|------|-------------|
| `index.ts` | [AUTH] [INTEGRATION] | App entry point. Dual startup (--dev vs normal mode), GPU flags for WorkSpaces, creates window, starts all engines. Single instance lock via app.requestSingleInstanceLock() -- second instance focuses existing window instead of launching duplicate (v0.2.3). Graceful shutdown: before-quit handler calls cleanup on all engine modules -- timer, activity, window tracker, screenshot, idle detector, sync, auto-updater, tray (v0.2.3). Close warning dialog: BrowserWindow close handler uses dialog.showMessageBox when timer is running -- "Stop tracking? Closing will stop your timer." with "Keep Working" and "Stop & Close" buttons. If timer is not running, window hides to tray as before (v0.2.8). |
| `config.ts` | [AUTH] [INTEGRATION] | Global config constants (intervals, paths, URLs). `isDevMode` flag. Dynamic `apiBaseUrl` getter/setter. DB path migration from old "Valerie Tracker" name. |
| `tracker-config.ts` | [AUTH] [INTEGRATION] | Reads config.json from ProgramData, safeStorage caching, pings server to validate API key, fetches + merges server config, offline fallback. Core auth module for production mode. TrackerSettings includes autoStopIdleMin (default 15) for prolonged idle auto-stop (v0.2.7). |
| `auth.ts` | [AUTH] [INTEGRATION] | `getAuthHeaders()` -- returns Bearer token for API calls. Dev mode: Supabase JWT. Normal mode: API key from tracker-config. Also handles Supabase signIn/signOut/restoreSession (dev-only). |
| `database.ts` | [DATA] [SYNC] | SQLite via better-sqlite3. Creates 3 tables (sync_outbox, screenshot_queue, active_time_entry). CRUD for outbox items, screenshots, and timer persistence. |
| `timer.ts` | [DATA] [TASK] | Timer state machine (start/stop/resume). Generates idempotency keys. Tracks elapsed/active/idle seconds. Queues time entries for sync. Persists to SQLite for crash recovery. Writes last_tick_at to active_time_entry every 60s. On resumeTimer(), detects stale timers by checking gap between now and last_tick_at -- if gap exceeds idle threshold, auto-stops with durationSec reflecting actual work time (v0.2.7). Manages currentNote state via setTimerNote() export; note is included in queueForSync payload and reset on stop (v0.2.8). |
| `activity.ts` | [DATA] | Activity detection via powerMonitor.getSystemIdleTime(). 1s polling, 60s snapshot aggregation. Feeds activityPct to timer and sync outbox. Data collection gated behind timer running state -- skips polls with "[Activity] Skipping -- timer not running" log when timer is not running (v0.2.2). |
| `window-tracker.ts` | [DATA] | Foreground app tracking via @miniben90/x-win. 3s polling, heartbeat pattern (extends duration for same app). 60s flush to sync outbox. Chrome page title extraction: strips " - Google Chrome" suffix from window titles to derive pageTitle field sent in sync payload alongside appName and windowTitle (v0.2.4). Timer-gated -- skips polls when timer not running (v0.2.2). |
| `screenshot.ts` | [DATA] | Screenshot capture via screenshot-desktop + sharp WebP compression. Randomized within 10-min windows. Saves locally, queues for upload. Captures silently (notification removed in v0.2.6). Capture only occurs while timer is running -- skips with log when timer stopped (v0.2.2). |
| `idle-detector.ts` | [DATA] [UI] | Idle detection via powerMonitor. 30s polling + lock-screen event. Shows idle prompt dialog to renderer when threshold exceeded. If idle prompt goes unanswered for autoStopIdleMin (default 15 min, configurable), auto-stops timer and discards idle time (v0.2.7). |
| `sync.ts` | [SYNC] [INTEGRATION] | Sync engine. Runs every 60s. Batches unsynced items from SQLite, POSTs to /api/tracker/sync. Uploads screenshots via presigned URLs. Marks items as synced. Screenshot metadata now includes storageUrl/storagePath set before outbox insert (v0.2.6). |
| `tray.ts` | [UI] | System tray icon (green/gray), tooltip with elapsed time, context menu (status, start/stop, open, update check, quit). |
| `auto-launch.ts` | | Windows Registry Run key for auto-start on login. Writes to HKCU\...\Run. |
| `auto-updater.ts` | | electron-updater integration. Checks GitHub Releases on startup + every 4h. Downloads silently, installs on quit. Non-fatal error handling. |
| `ipc.ts` | [UI] [INTEGRATION] | IPC handler registration. Maps renderer API calls to main process functions: auth, timer, projects, config, idle, tasks, app version, today total, timer:setNote (v0.2.8). |

## agent/src/preload/ -- Preload Bridge

| File | Tags | Description |
|------|------|-------------|
| `index.ts` | [UI] [INTEGRATION] | contextBridge.exposeInMainWorld('electronAPI', ...). Typed API surface: auth, timer, projects, config, time, tasks, app, idle. Event listeners for timer updates, screenshots, config changes. Exposes timerSetNote() bridge method for note input (v0.2.8). |

## agent/src/renderer/ -- Renderer Process (React UI)

| File | Tags | Description |
|------|------|-------------|
| `App.tsx` | [UI] | Root component. Screen routing (loading/login/main/error). Listens for config:ready, config:error, idle:prompt events. |
| `main.tsx` | [UI] | React DOM render entry point. |
| `index.html` | [UI] | HTML shell for renderer. |
| `screens/MainScreen.tsx` | [UI] [TASK] | Primary UI. Project/task list with play buttons, inline task creation, timer display (HH:MM:SS), stop button. Note input: text field + submit button visible while timer is running; VA types a note, clicks submit, note is attached to current time entry via timer:setNote IPC, input clears after submit (v0.2.8). Today total display ("Today: Xh Xm") near footer, polls every 30s via time:getTodayTotal IPC, refreshes on timer start/stop, falls back to local SQLite sum if API returns 404 (v0.2.4). Project refresh button in header (v0.2.2). Status text shows "Working -- [task]" when tracking, "Not tracking" when idle. Fonts: DM Sans for body text, DM Mono for timer display. |
| `screens/ErrorScreen.tsx` | [UI] [AUTH] | Error states: "not-configured" and "key-invalid". Retry button. |
| `screens/IdleDialog.tsx` | [UI] | Modal: "You've been idle for X minutes" with keep/discard-resume/discard-stop options. |
| `screens/LoginScreen.tsx` | [UI] [AUTH] | Email/password login form. Dev mode only (--dev flag). Not shown in production. |
| `fonts/DMMono-Light.woff2` | [UI] | Timer display font. |
| `fonts/dm-sans-latin.woff2` | [UI] | Body text font. |

## web/src/ -- Next.js API Server

### web/src/lib/ -- Shared Libraries

| File | Tags | Description |
|------|------|-------------|
| `auth.ts` | [AUTH] [INTEGRATION] | `validateApiKey()` -- reads Bearer token, looks up `trackerApiKey` on User model via Prisma. Returns AuthContext (user, membership, orgId). `AuthError` class + `handleApiError()`. |
| `prisma.ts` | [SYNC] | Prisma client singleton. |
| `supabase-server.ts` | [SYNC] | Supabase service client (service role key). Used for presigned URLs and admin auth operations. |

### web/src/app/api/ -- API Routes (13 routes)

| File | Tags | Description |
|------|------|-------------|
| `auth/register/route.ts` | [AUTH] | POST -- Create Supabase Auth user + Prisma User + Membership. Admin-only. |
| `tracker/ping/route.ts` | [AUTH] [INTEGRATION] | GET -- API key validation. Returns { status, userId }. Called by agent on startup. |
| `tracker/config/route.ts` | [AUTH] [INTEGRATION] | GET -- Returns org settings (screenshotFreq, idleTimeoutMin, etc.) for authenticated VA. Called by agent on startup. |
| `tracker/sync/route.ts` | [SYNC] [INTEGRATION] | POST -- Receives batched data (time entries, activity snapshots, window samples, screenshots). Zod validation. Upserts time entries, createMany for child records with skipDuplicates. Maps idempotency keys to DB IDs. |
| `tracker/projects/route.ts` | [TASK] [INTEGRATION] | GET -- List org projects with tasks. POST -- Create project. |
| `tracker/projects/[id]/tasks/route.ts` | [TASK] | POST -- Create task under project. Auto-increments sortOrder. |
| `tracker/screenshots/presign/route.ts` | [SYNC] [INTEGRATION] | POST -- Generate presigned upload URL for Supabase Storage. Returns uploadUrl, storagePath, publicUrl. |
| `screenshots/route.ts` | [SYNC] | GET -- Query screenshot metadata (paginated, date-filtered, org-scoped). |
| `screenshots/[id]/route.ts` | [SYNC] | DELETE -- Soft-delete screenshot (VA only, 24h window). Also removes from Supabase Storage. |
| `time-entries/route.ts` | [SYNC] | GET -- Query time entries with date/user/project filters. VA can only query self. Limit 200. |
| `activity/route.ts` | [DATA] | GET -- Query activity snapshots + window samples for a date. |
| `dashboard/live/route.ts` | [SYNC] | GET -- Live tracking status for all VAs in org. |
| `tasks/[id]/route.ts` | [TASK] | PATCH -- Update task title, status, or description. |

### web/src/app/ -- Next.js App Shell

| File | Tags | Description |
|------|------|-------------|
| `layout.tsx` | | Bare skeleton root layout. No UI components. |
| `page.tsx` | | Stub page ("Valerie Tracker API"). No dashboard. |
| `globals.css` | | Minimal Tailwind CSS reset. |

## shared/src/ -- Shared TypeScript Types

| File | Tags | Description |
|------|------|-------------|
| `index.ts` | [INTEGRATION] | Re-exports all types and enums. |
| `enums.ts` | [INTEGRATION] | UserRole, ProjectStatus, TaskStatus, TimeEntryStatus, MembershipStatus enums. |
| `types.ts` | [INTEGRATION] | ApiError, ProjectWithTasks, TaskSummary, LiveDashboardEntry, PresignResponse interfaces. |
| `sync-payload.ts` | [SYNC] [INTEGRATION] | SyncPayload, SyncTimeEntry, SyncActivitySnapshot, SyncWindowSample, SyncScreenshotMeta, SyncResponse interfaces. Defines the exact shape of data between agent and API. SyncWindowSample includes pageTitle field (string | null) for Chrome page titles (v0.2.5). |

## prisma/ -- Database Schema

| File | Tags | Description |
|------|------|-------------|
| `schema.prisma` | [INTEGRATION] | 10 models (User, Organization, Membership, Project, Task, TaskAssignment, TimeEntry, ActivitySnapshot, Screenshot, WindowSample), 5 enums. PostgreSQL via Supabase. |
| `seed.ts` | | Test data seeder. Creates 1 VA user (vt_test123), 1 org, 2 projects, 6 tasks, 6 assignments. Idempotent (uses upserts). |
| `package.json` | | Workspace package for prisma. |
| `migrations/20260226_add_tracker_api_key/migration.sql` | [AUTH] | Migration to add trackerApiKey field to User model. |

## Root Files

| File | Tags | Description |
|------|------|-------------|
| `README.md` | | Setup guide, API reference, troubleshooting. |
| `STATUS.md` | | Build status, test results, version history. |
| `TECHNICAL-BLUEPRINT.md` | | Original architecture research document. |
| `PROJECT-PLAN.md` | | Original MVP build plan (historical). |
| `INTEGRATION-GUIDE.md` | [INTEGRATION] | What this project does vs what va-platform does. Auth swap design. 18-task checklist. |
| `DESIGN-BRIEF.md` | | Styling tokens reference (used by va-platform, not this project). |
| `SCHEMA.prisma` | | Reference copy of schema. |
| `package.json` | | Root workspace config (npm workspaces: web, agent, shared, prisma). |
| `agent/electron-builder.yml` | [INTEGRATION] | NSIS installer config. perMachine: true, asarUnpack for native modules, GitHub Releases publish. |
| `agent/resources/icon.ico` | [UI] | Custom woman silhouette logo (256x256). Embedded in .exe via rcedit. Also bundled as extraResource for runtime BrowserWindow icon. Updated v0.1.7. |
| `agent/package.json` | | Agent workspace: scripts (dev, build, publish), dependencies, version 0.2.8. |

---

## Files to Touch for Each Integration Concern

### Data Collection
Files that determine WHAT is captured and HOW:
- `agent/src/main/activity.ts` -- Activity polling rate, snapshot interval
- `agent/src/main/window-tracker.ts` -- Window polling rate, heartbeat logic
- `agent/src/main/screenshot.ts` -- Screenshot timing, compression, format
- `agent/src/main/idle-detector.ts` -- Idle threshold, prompt behavior
- `agent/src/main/timer.ts` -- Time entry fields, activity accumulation
- `agent/src/main/config.ts` -- All interval/threshold constants

### Sync/API
Files that determine HOW data gets to the server:
- `agent/src/main/sync.ts` -- Sync interval, batch size, retry logic, upload flow
- `agent/src/main/database.ts` -- SQLite outbox schema, queue operations
- `web/src/app/api/tracker/sync/route.ts` -- Server-side sync handler, Zod schemas
- `web/src/app/api/tracker/screenshots/presign/route.ts` -- Presigned URL generation
- `shared/src/sync-payload.ts` -- Payload type definitions (shared contract)

### Authentication
Files that determine WHO is tracked:
- `agent/src/main/tracker-config.ts` -- config.json reading, API key validation, safeStorage
- `agent/src/main/auth.ts` -- getAuthHeaders(), dual-mode auth
- `agent/src/main/config.ts` -- apiBaseUrl, cache paths
- `web/src/lib/auth.ts` -- validateApiKey middleware, AuthContext
- `web/src/app/api/tracker/ping/route.ts` -- Key validation endpoint
- `web/src/app/api/tracker/config/route.ts` -- Server config endpoint

### UI
Files that determine what the USER sees:
- `agent/src/renderer/App.tsx` -- Screen routing
- `agent/src/renderer/screens/MainScreen.tsx` -- Primary interface
- `agent/src/renderer/screens/ErrorScreen.tsx` -- Error states
- `agent/src/renderer/screens/IdleDialog.tsx` -- Idle prompt
- `agent/src/main/tray.ts` -- System tray
- `agent/src/preload/index.ts` -- Bridge API surface
- `agent/src/main/ipc.ts` -- IPC handler mapping

### Task/Project Management
Files that determine project/task structure:
- `web/src/app/api/tracker/projects/route.ts` -- List/create projects
- `web/src/app/api/tracker/projects/[id]/tasks/route.ts` -- Create tasks
- `web/src/app/api/tasks/[id]/route.ts` -- Update tasks
- `agent/src/main/ipc.ts` -- projects:list and tasks:create handlers
- `agent/src/renderer/screens/MainScreen.tsx` -- Project/task list UI
- `prisma/schema.prisma` -- Project, Task, TaskAssignment models
