# Valerie Tracker

A Hubstaff-replacement time tracker for virtual assistants. Electron desktop agent + Next.js API server (headless, no dashboard UI), backed by Supabase.

## Current Status

**v0.3.7 stable -- HKLM Auto-Launch Fix (2026-03-03).**

All 18 integration guide tasks complete. The Electron agent (branded "Valerie Agent" since v0.1.7) has been tested end-to-end on a real AWS WorkSpace. Agent now syncs to va-platform at staging.hirevalerie.com.

- NSIS installer works (`perMachine: true`), auto-launches on reboot
- Config.json + API key auth working
- All 5 native modules work out of the box (screenshot-desktop, x-win, powerMonitor, better-sqlite3, sharp)
- Time tracking, activity snapshots, window samples, and screenshots all capture and sync correctly
- Chrome extension URL tracking via localhost HTTP bridge (v0.3.0-v0.3.7)
- Enterprise force-install policy for Chrome extension -- survives reboot, cannot be disabled by user (v0.3.5)
- Close warning dialog when window X clicked while timer running -- prevents accidental timer stop (v0.2.8)
- Note input wired end-to-end -- VA can add notes to time entries, synced in payload (v0.2.8)
- Stale timer detection on resume -- auto-stops with correct durationSec after reboot/force-kill (v0.2.7)
- Auto-stop on prolonged unanswered idle -- 15 min configurable timeout (v0.2.7)
- Screenshot metadata now correctly includes storageUrl/storagePath (v0.2.6)
- Single instance lock prevents duplicate windows
- Screenshot/activity/window tracking gated behind timer running state (privacy fix)
- Chrome page title extraction from window titles
- Today total display with API + local SQLite fallback
- Comprehensive debug logging with log prefixes for all engine modules
- Graceful shutdown with engine cleanup

See STATUS.md for full test results and INTEGRATION-GUIDE.md for the complete task checklist.

## Architecture

```
valerie-tracker/
  shared/    -- Shared TypeScript types and enums
  prisma/    -- Database schema (Prisma ORM) + seed script
  web/       -- Next.js 15 headless API server with 13 routes (retired from production -- see note below)
  agent/     -- Electron desktop app (Windows)
```

> **Note:** The `web/` API server is retired from production. The agent now syncs exclusively to va-platform (`staging.hirevalerie.com` / `hirevalerie.com`). The web/ folder is maintained as a reference implementation of the sync contract (Zod schemas, route signatures, presign flow).

- **Agent** writes to local SQLite first, syncs every 60s via batched POST to `/api/sync`
- **Screenshots** upload via presigned URLs to Supabase Storage
- **Activity detection** uses `powerMonitor.getSystemIdleTime()` only (no keylogging)
- **Idempotency keys** (UUID) on all synced records prevent duplicates
- **Sync behavior**: agent syncs every 60 seconds, idempotency keys prevent duplicates on retry
- **Screenshot flow**: randomized within 10-minute window, compressed to WebP via sharp, uploaded via presigned URL to Supabase Storage

## Prerequisites

- Node.js 20+
- npm 10+
- Windows 10/11 (for agent development)
- Supabase project with Auth, Storage, and Postgres enabled

## Setup

1. Clone and install all workspaces:
```bash
git clone <repo-url>
cd valerie-tracker
npm install
```

2. Create `.env` at project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:5432/postgres
```

Note: If your database password contains special characters (`?`, `*`, `$`), URL-encode them in DATABASE_URL and DIRECT_URL.

3. Push the database schema:
```bash
npx prisma db push --schema=prisma/schema.prisma
```

4. Create a "screenshots" storage bucket in the Supabase dashboard (set to private).

5. Seed test data (optional):
```bash
npx prisma db seed
```
Creates: 1 VA user (`testva@hirevalerie.com`, API key `vt_test123`), 1 organization (`Test Organization`), 2 projects (`Client Communications`, `Administrative Tasks`), 6 tasks, 6 task assignments. The seed uses upserts so it's safe to run multiple times.

## Config.json (Agent Configuration)

The agent reads its configuration from a JSON file on startup:

**Location:** `C:\ProgramData\ValerieAgent\config.json` (falls back to `C:\ProgramData\ValerieTracker\config.json` for backwards compatibility)

**Only `apiKey` and `apiBaseUrl` are required.** The server resolves `orgId` and `userId` from the API key via `/api/tracker/ping` and `/api/tracker/config`. All other settings are optional -- the server provides them automatically.

**Minimum required config:**
```json
{
  "apiBaseUrl": "https://staging.hirevalerie.com",
  "apiKey": "vt_your_api_key_here"
}
```

**Full example (all optional fields shown):**
```json
{
  "apiBaseUrl": "https://staging.hirevalerie.com",
  "apiKey": "vt_test123",
  "screenshotFreq": 1,
  "idleTimeoutMin": 5,
  "autoStopIdleMin": 15,
  "blurScreenshots": false,
  "trackApps": true,
  "trackUrls": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiBaseUrl | string | **Yes** | URL of the API server |
| apiKey | string | **Yes** | API key (must start with `vt_`), maps to `trackerApiKey` on User model. The server resolves `orgId` and `userId` from this key. |
| screenshotFreq | number | No | Screenshots per 10-minute interval (default: server-provided or 1) |
| idleTimeoutMin | number | No | Minutes before idle dialog appears (default: server-provided or 5) |
| autoStopIdleMin | number | No | Minutes before unanswered idle prompt auto-stops timer (default: server-provided or 15) |
| blurScreenshots | boolean | No | Whether to blur captured screenshots (default: server-provided or false) |
| trackApps | boolean | No | Whether to track active application names (default: server-provided or true) |
| trackUrls | boolean | No | Whether to track browser URLs (default: server-provided or true) |

On startup, the agent:
1. Checks Electron safeStorage for cached API key
2. Falls back to reading config.json
3. Caches key in safeStorage (encrypted via Windows DPAPI)
4. Pings `GET /api/tracker/ping` to validate key
5. Fetches `GET /api/tracker/config` for server-side org settings
6. Merges settings (server wins over local config.json values)
7. If offline but cached key + settings exist, starts tracking with cached settings

## AWS WorkSpace Deployment

**Production provisioning is automatic.** When a VA is hired on va-platform and their WorkSpace becomes AVAILABLE, the `sync-activity` cron calls `deployTrackerConfig()` which uses AWS SSM RunCommand to write `config.json` to `C:\ProgramData\ValerieAgent\config.json`. Only `apiKey` and `apiBaseUrl` are written -- the server resolves everything else from the API key. Zero manual setup required.

For manual setup or testing:

1. **Create config.json** with just the two required fields:
```powershell
mkdir C:\ProgramData\ValerieAgent
Set-Content -Path "C:\ProgramData\ValerieAgent\config.json" -Value '{"apiBaseUrl":"https://staging.hirevalerie.com","apiKey":"vt_your_key_here"}'
```

2. **Install the agent** -- run "Valerie Agent Setup 0.3.7.exe" (NSIS installer, `perMachine: true` defaults to `C:\Program Files\Valerie Agent\`)

3. **Launch** -- the agent verifies the API key, fetches config from the server, and shows projects/tasks. For debug output, launch from PowerShell:
```powershell
& "C:\Program Files\Valerie Agent\Valerie Agent.exe"
```

4. **Auto-launches on reboot** -- Registry Run key at `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` (machine-wide, persists across all user profiles in golden images). The runtime agent also tries HKLM first with HKCU fallback.

### Chrome Extension (URL Tracking)

A Manifest V3 Chrome extension captures the active tab URL and sends it to the agent via a localhost HTTP bridge on 127.0.0.1:19876. The agent attaches URLs to Chrome window samples in the sync payload.

**Deployment:** The NSIS installer deploys the extension via Chrome enterprise force-install policy (ExtensionInstallForcelist). Files installed to `C:\ProgramData\ValerieAgent\`:
- `valerie-url-bridge.crx` -- CRX3-format packed extension
- `update.xml` -- gupdate manifest pointing to local CRX file
- `chrome-extension\` -- unpacked source (for debugging)

**Registry:** `HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist` -- force-installs the extension on Chrome launch. Cannot be disabled by the user. Survives WorkSpace reboots and golden image captures (all files on C: drive, all registry in HKLM).

**Extension ID:** `lpdlfbkigloncemklhgcclimjfbglfkk` (derived from persistent RSA key in `agent/build/extension.pem`).

**Config:** Gated behind `trackUrls` config flag (returned from `GET /api/tracker/config`).

**Privacy note:** Full URLs including query parameters are captured (e.g., LinkedIn authwall URLs with tracking tokens). Future enhancement: URL truncation or query param stripping for privacy and storage efficiency.

### Verified Test Results (AWS WorkSpace, 2026-02-27 through 2026-03-03, v0.1.7-v0.3.5)

- Install + launch: PASSED
- Config.json auth + Vercel API connection: PASSED
- All native modules (screenshot-desktop, x-win, powerMonitor, better-sqlite3, sharp): PASSED
- Time entry start/stop sync: PASSED
- Activity tracking (60s snapshots, 0-82% range): PASSED
- Window tracking (app names, titles, process paths): PASSED
- Screenshot capture + presigned URL upload: PASSED (WebP, ~73-96KB)
- Idle detection dialog after 5 min: PASSED
- Auto-launch on reboot: PASSED
- Renderer stability: FAILED then FIXED (v0.1.5) -- white screen caused by `projects:list` IPC returning raw object + GPU cache permission errors + `Intl.Locale` bug
- DevTools on WorkSpace: FAILED then FIXED (v0.1.5) -- `Intl.Locale` error fixed with `--lang=en-US`
- Chrome extension URL tracking: PASSED (v0.3.0-v0.3.7) -- extension captures active tab URL, agent attaches to sync payload
- Chrome extension force-install policy: PASSED (v0.3.5) -- survives WorkSpace reboot, persists in golden image
- Auto-update (electron-updater): UNRELIABLE -- downloads update but does not reliably install on restart

### Golden Image Workflow

To create a golden image with the agent pre-installed for all new WorkSpaces:

1. **Spin up a fresh WorkSpace** from the default Windows bundle
2. **RDP in** and create `C:\ProgramData\ValerieAgent\config.json` with `apiKey` and `apiBaseUrl` (only two required fields -- server resolves orgId/userId from the key). In production, va-platform provisions this automatically via SSM RunCommand.
3. **Download** "Valerie Agent Setup 0.3.7.exe" from [GitHub Releases](https://github.com/chickenparmesean/valerie-tracker/releases)
4. **Run the installer** -- `perMachine: true` defaults to `C:\Program Files\Valerie Agent\` (system volume). Installer also deploys Chrome extension files to `C:\ProgramData\ValerieAgent\` and sets force-install policy in HKLM registry.
5. **Verify agent**: `Test-Path "C:\Program Files\Valerie Agent\Valerie Agent.exe"`
6. **Verify extension files**: `Test-Path "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"` and `Test-Path "C:\ProgramData\ValerieAgent\update.xml"`
7. **Launch agent**, verify API connection (MainScreen shows projects)
8. **Open Chrome**, verify extension is installed and active (chrome://extensions should show "Valerie URL Bridge" as force-installed)
9. **Stop agent**, optionally clear safeStorage cache for clean slate
10. **Create Image** from WorkSpace (~45 min)
11. **Create Custom Bundle** from captured image

The `perMachine: true` setting is critical -- the C: drive (system volume) persists in captured images, but the D: drive (user volume) does not. All agent files (`C:\Program Files\Valerie Agent\`), extension files (`C:\ProgramData\ValerieAgent\`), and registry entries (HKLM) are on the C: drive and persist in golden images.

## Development

### Web API Server
```bash
cd web
npm run dev
```
Opens at http://localhost:3000

### Electron Agent
```bash
cd agent
npm run dev
```
Runs 4 concurrent processes:
1. **Vite** -- renderer HMR dev server (localhost:5173)
2. **tsc --watch** (tsconfig.main.json) -- main process watcher
3. **tsc --watch** (tsconfig.preload.json) -- preload watcher
4. **Electron** -- launches with `NODE_ENV=development` (connects to Vite HMR instead of loading dist-renderer/)

The agent reads `.env` from the project root automatically via dotenv.

**Dev mode vs Normal mode:**
- `npm run dev` launches Electron with `--dev` flag not set -- it uses config.json auth by default
- To test with the Supabase Auth LoginScreen, add `--dev` to the electron command in package.json

## Building the Agent Installer

```bash
cd agent
npm run build:agent
```

This runs `vite build` + `tsc` for main/preload + `electron-builder --win`. The NSIS installer outputs to `agent/dist/`.

## Local Testing (Agent + API)

To test the full agent-to-API flow locally:

1. **Seed test data:**
```bash
npx prisma db seed
```
This creates a test VA user with API key `vt_test123`, an organization, 2 projects, and 6 tasks.

2. **Create the config file** the agent reads on startup:
```
C:\ProgramData\ValerieAgent\config.json
```
```json
{
  "apiBaseUrl": "http://localhost:3000",
  "apiKey": "vt_test123"
}
```
Only `apiKey` and `apiBaseUrl` are required. Optional overrides (screenshotFreq, idleTimeoutMin, etc.) can be added but the server provides them via `/api/tracker/config`.

3. **Start the web API** in one terminal:
```bash
cd web && npm run dev
```

4. **Start the agent** in another terminal:
```bash
cd agent && npm run dev
```

5. **Expected behavior:** Agent reads config.json, pings `GET /api/tracker/ping` to validate the key, fetches `GET /api/tracker/config` for org settings, then shows MainScreen with projects. If the key is invalid, you'll see ErrorScreen.

## Scripts

| Workspace | Script | Description |
|-----------|--------|-------------|
| root | `npm install` | Install all workspaces |
| root | `npx prisma db seed` | Seed test data (1 user, 1 org, 2 projects, 6 tasks) |
| web | `npm run dev` | Start Next.js dev server (port 3000) |
| web | `npm run build` | Production build |
| agent | `npm run dev` | Start Electron in dev mode |
| agent | `npm run build` | Compile main + preload + renderer |
| agent | `npm run build:agent` | Build + package Windows installer |
| agent | `npm run typecheck` | Type-check main + preload |
| agent | `npm run publish:agent` | Build + publish to GitHub Releases (requires GH_TOKEN) |

## Publishing a Release

Full workflow for shipping a new agent version:

1. Bump version in `agent/package.json`
2. Commit and push to staging
3. Set GH_TOKEN and publish:
   ```bash
   export GH_TOKEN="ghp_your_token_here"  # needs 'repo' scope
   cd agent
   npm run publish:agent
   ```
   This builds the NSIS installer and uploads it as a GitHub Release (draft). Publish the draft release in the GitHub UI or via API to make it the latest.
4. Download the installer from [GitHub Releases](https://github.com/chickenparmesean/valerie-tracker/releases)
5. Run on WorkSpace (the NSIS installer overwrites the previous version -- no need to uninstall first)

**GH_TOKEN is needed ONLY at publish time.** The agent checks for updates using the public GitHub Releases API -- no token needed at runtime.

**Auto-update caveat:** Auto-update via electron-updater is currently unreliable with NSIS. The agent detects updates and downloads them, but installation on restart does not consistently work. For now, deploy updates by downloading the latest installer from [GitHub Releases](https://github.com/chickenparmesean/valerie-tracker/releases) and running it manually on the WorkSpace. The NSIS installer overwrites the previous version -- no need to uninstall first.

**WARNING: Auto-update is unreliable. Do NOT rely on electron-updater for production deployments.** The only reliable deployment method is rebuilding the golden image with the new installer. Download the latest installer from GitHub Releases, install on a WorkSpace, and create a new image/bundle.

## API Reference

All 13 routes require API key Bearer token in the Authorization header: `Authorization: Bearer vt_...`

### Auth & Config

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create user + membership (admin only) |
| GET | /api/tracker/ping | Validate API key, returns `{ status, userId }` |
| GET | /api/tracker/config | Returns org settings for the authenticated VA |

### Sync & Data

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/sync | Receive batched activity data from agent (time entries, activity snapshots, window samples, screenshot metadata) |
| GET | /api/time-entries | Query time entries (date/user/project filters) |
| GET | /api/activity | Query activity snapshots (date range) |
| GET | /api/dashboard/live | Live VA tracking status for dashboard |

### Screenshots

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/screenshots/presign | Get presigned upload URL for Supabase Storage |
| GET | /api/screenshots | Query screenshot metadata (paginated, org-scoped) |
| DELETE | /api/screenshots/[id] | Soft-delete screenshot (VA only, 24h window) |

### Projects & Tasks

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/projects | List projects with tasks (org-scoped) |
| POST | /api/projects | Create project |
| POST | /api/projects/[id]/tasks | Create task under project |
| PATCH | /api/tasks/[id] | Update task status or title |

### Key Endpoint Details

**GET /api/tracker/ping** -- Health check and API key validation.
```json
// Response (200):
{ "status": "ok", "userId": "clu..." }
```

**GET /api/tracker/config** -- Returns organization settings for the agent.
```json
// Response (200):
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
Response (404): `{ "error": "No active organization" }` -- user has no active membership.

**POST /api/sync** -- Receives batched activity data from the agent. Payload:
```json
{
  "timeEntries": [...],
  "activitySnapshots": [...],
  "windowSamples": [...],
  "screenshots": [...]
}
```
Uses idempotency keys for deduplication. Child records (activitySnapshots, windowSamples, screenshots) reference their parent TimeEntry via `timeEntryIdempotencyKey`, which the server resolves to the actual DB ID.

## Database Models

10 Prisma models: User, Organization, Membership, Project, Task, TaskAssignment, TimeEntry, ActivitySnapshot, Screenshot, WindowSample

See `prisma/schema.prisma` for full schema.

## Troubleshooting

### No projects showing
Run the seed script to create test data:
```bash
npx prisma db seed
```
Or create projects manually via `POST /api/projects` with a valid API key.

### Sync failing with Zod error
Check Vercel function logs. Common cause: the agent sends `taskId: null` for taskless time entries. The Zod schema must use `z.string().nullable().optional()` (not just `z.string().optional()`). This fix was applied during WorkSpace testing.

### App not auto-launching on reboot
Check the Windows Registry for the auto-launch entry. The NSIS installer writes to HKLM (machine-wide), and the runtime agent tries HKLM first with HKCU fallback:
```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run
HKCU\Software\Microsoft\Windows\CurrentVersion\Run (legacy fallback)
```
To verify: `reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v ValerieAgent`

If missing from both locations, the auto-launch module may not have run on first launch.

### Screenshots not uploading
Verify the "screenshots" bucket exists in your Supabase Storage dashboard (must be private, not public). The agent gets a presigned URL from `/api/screenshots/presign` and uploads directly to Supabase Storage.

### Config not found
Verify the config file exists and is valid JSON:
```
C:\ProgramData\ValerieAgent\config.json
```
The file must contain at minimum `apiBaseUrl` and `apiKey`. Check that the directory exists (`C:\ProgramData\ValerieAgent\`). The agent also checks the legacy path `C:\ProgramData\ValerieTracker\config.json` as a fallback.

### White screen after login on WorkSpace
The Chromium renderer crashes on AWS WorkSpaces due to GPU cache permission errors and locale issues. The following flags are required in `agent/src/main/index.ts` before `app.whenReady()`:
- `app.disableHardwareAcceleration()`
- `appendSwitch('disable-gpu')`
- `appendSwitch('no-sandbox')`
- `appendSwitch('disable-gpu-sandbox')`
- `appendSwitch('disk-cache-dir', ...)`
- `appendSwitch('lang', 'en-US')`

Do not remove these.

### DevTools won't open on WorkSpace
Known Chromium bug with empty `Intl.Locale` on some Windows configurations. Fixed by `appendSwitch('lang', 'en-US')`. If still failing, launch from PowerShell to see console output instead:
```powershell
& "C:\Program Files\Valerie Agent\Valerie Agent.exe"
```

### Projects not loading / .map() error
The `/api/tracker/projects` endpoint returns `{ projects: [...] }`. The `ipc.ts` handler must unwrap this: `return Array.isArray(data) ? data : data.projects || []`. If MainScreen shows white screen with a TypeError in console, this is the cause.

## Debugging on WorkSpaces

DevTools is permanently broken on WorkSpaces due to a Chromium Intl.Locale bug with empty locale. Use console.log debugging via PowerShell instead.

**Launch with full log capture:**
```powershell
& "C:\Program Files\Valerie Agent\Valerie Agent.exe" 2>&1 | Tee-Object -FilePath "$env:USERPROFILE\Desktop\agent-debug.log"
```

**Log prefixes by module:**
| Prefix | Module |
|--------|--------|
| [Native] | Native module probing on startup |
| [Engine] | Engine lifecycle (start/stop) |
| [Timer] | Timer state transitions |
| [Activity] | Activity polling (1s) and snapshots (60s) |
| [Window] | Window tracking (3s polling), app switches, page titles |
| [Screenshot] | Screenshot capture + compression |
| [Idle] | Idle detection and threshold checks |
| [Sync] | Sync engine cycles, POST results |
| [DB] | SQLite outbox operations |
| [IPC] | IPC handler calls from renderer |
| [App] | App lifecycle events |
| [AutoUpdater] | Update checks and downloads |
| [DevTools] | DevTools open attempts |

All engine modules log to stdout as of v0.2.1. Page title changes log only on change (not every poll) as of v0.2.5. Debug logging should be stripped or gated behind `--verbose` before final production release.

## Design System

Dashboard UI has been stripped from web/ (production dashboard lives in va-platform repo). The web/ folder is a headless API server only. See DESIGN-BRIEF.md for styling tokens reference (used by va-platform, not this project).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web framework | Next.js 15 (App Router) |
| Desktop framework | Electron 34 |
| Language | TypeScript (strict mode) |
| Database | Supabase Postgres via Prisma |
| Local database | SQLite via better-sqlite3 |
| Auth | API key (Bearer vt_...) via trackerApiKey field |
| Storage | Supabase Storage (presigned URLs) |
| Screenshots | screenshot-desktop + sharp (WebP) |
| Window tracking | @miniben90/x-win |
| Packaging | electron-builder (NSIS, perMachine: true) |
| Auto-update | electron-updater (GitHub Releases) -- currently unreliable with NSIS, see Troubleshooting |
