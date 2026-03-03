# Valerie Tracker — Integration Guide

> **There are two projects. Do not confuse them.**
>
> - **THIS PROJECT (valerie-tracker)** — Electron desktop agent + standalone test API. Lives in its own repo. Responsible for building, testing, and packaging the desktop agent.
> - **THE OTHER PROJECT (va-platform / HireValerie)** — The production platform. Lives in a separate repo. Responsible for integration, dashboard UI, database migration, and production deployment.
>
> **This document is for THIS PROJECT (valerie-tracker).** It tells you what to build, what to skip, and how to structure things so the other project can wire it in later.

---

## FIRST: Clean Up the Codebase

The MVP one-shot built a full standalone dashboard in `web/`. **All of that UI is dead weight.** The production dashboard lives in va-platform. Kill everything that isn't an API route or its direct dependency.

### DELETE these from `web/` (pages, components, layouts — all UI):

**Pages to delete:**
- `web/src/app/(dashboard)/` — entire directory (all dashboard pages: overview, VAs, VA detail, screenshots, projects, project detail, settings)
- `web/src/app/login/` — entire directory
- Any other page directories that render UI (keep only `api/` routes)

**Components to delete:**
- `web/src/components/` — entire directory (Button, Badge, StatCard, ProductivityBar, LiveDot, Avatar, Card, Input, EmptyState, DashboardLayout, Sidebar, PageHeader, and anything else)

**Hooks to delete (dashboard-specific):**
- Any hooks that exist solely for dashboard UI (e.g., `useRealtimeSubscription` if it's only used by dashboard pages — though keep it if the agent uses it)

**Layout files to delete:**
- `web/src/app/layout.tsx` — replace with a bare minimum root layout (just `<html><body>{children}</body></html>`, no sidebar, no nav, no design tokens)
- Delete any dashboard layout wrappers

**Styling to strip down:**
- Remove DM Serif Display, DM Sans, JetBrains Mono font imports
- Remove all custom design tokens from `globals.css` (keep only Tailwind defaults)
- Remove any `tailwind.config` customizations for the dashboard theme

### KEEP these in `web/` (API layer only):

- `web/src/app/api/` — all 13 API route files (auth/register, sync, screenshots/presign, screenshots, screenshots/[id], projects, projects/[id]/tasks, tasks/[id], time-entries, activity, dashboard/live, tracker/ping, tracker/config)
- `web/src/lib/auth.ts` — auth middleware (will be rewritten for API key, but keep the file)
- `web/src/lib/supabase.ts` — Supabase client (needed for Storage presigned URLs)
- `web/src/lib/prisma.ts` — Prisma client
- Any Zod schemas used by API routes
- `web/src/app/layout.tsx` — bare minimum (Next.js requires it, but it can be a skeleton)
- `web/src/app/page.tsx` — replace with a simple "Valerie Tracker API" text or redirect. No dashboard.

### KEEP in `agent/` (no changes):
- Everything. The agent is clean. Don't touch it during cleanup.

### KEEP in `shared/`:
- All TypeScript types and enums (used by both agent and API routes)

### KEEP in `prisma/`:
- Schema file (will be modified for API key field, but keep it)

### Result after cleanup (current state):
```
valerie-tracker/
├── agent/              ← Electron app (auth swap complete)
│   ├── src/main/       ← 15 modules (added tracker-config.ts, auto-updater.ts)
│   ├── src/renderer/   ← LoginScreen (--dev only), MainScreen, IdleDialog, ErrorScreen
│   └── src/preload/    ← contextBridge (auth, timer, projects, config, idle, app)
├── web/                ← API ONLY (all UI deleted)
│   └── src/
│       ├── app/
│       │   ├── api/    ← 13 route files (API key auth)
│       │   ├── layout.tsx  ← bare skeleton
│       │   └── page.tsx    ← "Valerie Tracker API"
│       └── lib/
│           ├── auth.ts     ← validateApiKey middleware
│           ├── prisma.ts   ← prisma client
│           └── supabase.ts ← storage client (presigned URLs)
├── prisma/             ← Schema (trackerApiKey on User) + seed.ts
├── shared/             ← Types
└── .env
```

The `web/` folder should have **zero UI components, zero dashboard pages, zero design tokens.** It's a headless API server and nothing else.

---

## What THIS PROJECT Does

1. **Clean up the codebase** (delete all dashboard UI from web/ — see above)
2. Swap auth from Supabase Auth to API key (see below)
3. Deploy the standalone `web/` API to Vercel for testing
4. Build the NSIS installer
5. Test the agent on a real AWS WorkSpace
6. Fix all native module / compatibility issues. Required Chromium flags for WorkSpaces: `app.disableHardwareAcceleration()`, `--disable-gpu`, `--no-sandbox`, `--disable-gpu-sandbox`, `--disk-cache-dir` redirect, `--lang=en-US`. These MUST be preserved in any future agent builds.
7. Verify the full loop: start timer → capture screenshots → track activity → sync to API → screenshots appear in Supabase Storage

**Once all tests pass, this project's job is done.** The agent repo stays alive forever for future agent updates. The `web/` folder (standalone API) gets retired when va-platform absorbs the routes.

## What THIS PROJECT Does NOT Do

- ❌ Build production dashboard pages (va-platform does this)
- ❌ Integrate with Clerk auth (va-platform does this)
- ❌ Merge database schemas (va-platform does this)
- ❌ Build project/task management UI for clients (va-platform does this)
- ❌ Handle VA onboarding or API key generation (va-platform does this)
- ❌ Deploy to production (va-platform does this)
- ❌ Build WorkSpace provisioning scripts (va-platform does this)

---

## What THE OTHER PROJECT (va-platform) Does Later

After this project's agent is tested and working:

1. Add tracker tables (TimeEntry, ActivitySnapshot, Screenshot, WindowSample, Project, Task, TaskAssignment) to va-platform's Prisma schema — foreign keys point to va-platform's existing User and VirtualAssistant models
2. Move API route handlers from `valerie-tracker/web/` into va-platform under `/api/tracker/*` — swap auth middleware from API key lookup against tracker's User table to API key lookup against VirtualAssistant table
3. Add `trackerApiKey` field to VirtualAssistant model — generated on hire
4. Build dashboard pages in va-platform (company, admin, monitor, VA views) using tracker data
5. Write WorkSpace provisioning script that drops config.json with the API key
6. Point the agent's `API_BASE_URL` at `hirevalerie.com` instead of the standalone API
7. Kill the standalone `web/` deployment
8. Kill Hubstaff integration

**None of that is your concern right now.** Focus on cleanup, auth swap, and getting the agent working.

---

## Auth: Swap to API Key (THIS PROJECT must do this)

The current agent uses Supabase Auth (email/password login). This needs to change to API key auth. Here's why: the production platform uses Clerk for browser auth, but the Electron agent can't use Clerk. API key is the bridge that works for both the standalone test phase and production.

### What to change in the agent

**Remove:**
- Supabase Auth imports and dependencies (`@supabase/supabase-js` for auth — keep it only if you need it for Storage presigned URLs during testing)
- LoginScreen as the default screen (keep it behind a `--dev` flag for testing)

**Add:**
- On startup, read config file:
  ```
  C:\ProgramData\ValerieAgent\config.json       (primary)
  C:\ProgramData\ValerieTracker\config.json     (fallback)
  ```
  ```json
  {
    "apiBaseUrl": "https://tracker-staging.vercel.app",
    "apiKey": "vt_a1b2c3d4e5f6...",
    "vaId": "test-va-001",
    "screenshotFreq": 1,
    "idleTimeoutMin": 5,
    "blurScreenshots": false,
    "trackApps": true,
    "trackUrls": true
  }
  ```
- All API requests include: `Authorization: Bearer vt_a1b2c3d4e5f6...`
- Cache the API key in Electron's `safeStorage` after first read
- If no config file and no cached key → show error screen: "Tracker not configured. Contact your administrator."

### What to change in the standalone API routes

Replace the Supabase JWT auth middleware with a simple API key lookup:

```typescript
// BEFORE (Supabase Auth)
const { data: { user } } = await supabase.auth.getUser(token);

// AFTER (API key)
const user = await prisma.user.findFirst({
  where: { trackerApiKey: apiKey }
});
if (!user) return Response.json({ error: 'Invalid API key' }, { status: 401 });
```

Add `trackerApiKey String? @unique` to the standalone tracker's User model. Seed a test user with a known key for development.

### Agent startup sequence (production behavior)
1. Check safeStorage for cached API key
2. If not found, read `C:\ProgramData\ValerieAgent\config.json` (falls back to `C:\ProgramData\ValerieTracker\config.json`)
3. If config found, cache key in safeStorage, load settings
4. Ping `GET /api/tracker/ping` to validate key (200 = valid, 401 = revoked)
5. If valid → fetch projects/tasks → show MainScreen → start tracking
6. If no config and no cached key → show error screen

### Why this matters
In production, va-platform will auto-generate this config file when provisioning an AWS WorkSpace for a newly hired VA. The VA opens their WorkSpace and the tracker is already running, authenticated, showing their tasks. **No login screen, no API key entry, no onboarding friction.** But that provisioning script is va-platform's job, not yours.

For testing, you manually create the config.json file on the test WorkSpace with the test API key.

---

## Agent Design: Keep It Backend-Agnostic

The agent should not know or care about the data model behind the API. This is critical for integration.

### DO
- Send tracking data to `POST {apiBaseUrl}/api/sync` with Bearer token
- Fetch projects/tasks from `GET {apiBaseUrl}/api/projects` with Bearer token
- Upload screenshots via presigned URL from `POST {apiBaseUrl}/api/screenshots/presign`
- Read settings from config.json (or a `GET {apiBaseUrl}/api/tracker/config` endpoint)

### DO NOT
- Import or reference the tracker's User, Organization, or Membership models anywhere in agent code
- Assume anything about the database schema
- Hard-code any IDs, org references, or user references (the API key identifies the user — the server resolves everything else)

The agent talks to URLs and gets JSON back. That's it. When the URLs change from the standalone API to va-platform's API, the agent doesn't notice.

---

## Route Handlers: Write Them as Pure Functions

When va-platform absorbs these routes, the only thing that changes is the auth middleware and the Prisma model references. Make this easy:

```typescript
// GOOD — the handler is a pure function that receives a userId
async function handleSync(userId: string, body: SyncPayload) {
  // Create time entries, activity snapshots, etc.
  // All Prisma queries use userId as the foreign key
  return { synced: true, counts: { timeEntries: 3, screenshots: 1 } };
}

// The route just does auth + calls the handler
export async function POST(req: Request) {
  const user = await validateApiKey(req);   // ← this line changes at integration
  const body = SyncPayloadSchema.parse(await req.json());
  const result = await handleSync(user.id, body);
  return Response.json(result);
}
```

When va-platform takes over, only the `validateApiKey` line changes. The `handleSync` function moves as-is.

---

## Database: What Stays vs Gets Replaced

You don't need to worry about this — va-platform handles the migration. But for context so you don't over-invest in the wrong models:

### Tables that MOVE to va-platform (with updated foreign keys)
- `TimeEntry` — `userId` will point to va-platform's User model
- `ActivitySnapshot` — same
- `Screenshot` — same
- `WindowSample` — same
- `Project` — `orgId` becomes the company user's ID in va-platform
- `Task` — stays as-is
- `TaskAssignment` — `userId` maps to va-platform's User model

### Tables that get THROWN AWAY
- `User` → va-platform already has User (linked to Clerk)
- `Organization` → va-platform represents this as the company User
- `Membership` → va-platform has VirtualAssistant (links VA to company)

### What this means for you
Don't build anything that deeply couples to User/Organization/Membership. Your API routes should resolve the API key to a userId and pass that userId to the handler. The handler does Prisma queries with userId. When the User table changes from tracker's User to va-platform's User, the queries stay the same because they only reference the ID.

---

## Screenshot Storage: Keep Supabase Storage

The presigned URL upload pattern works perfectly and doesn't change at integration. Screenshots go directly from the agent to Supabase Storage — never through the API server.

At integration time, va-platform will either:
- Create a `screenshots` bucket in va-platform's existing Supabase project (most likely)
- Or keep the tracker's Supabase project alive just for screenshot storage

Either way, the agent doesn't care. It gets a presigned URL from the API and uploads to it. The URL could point to any Supabase project.

**For now:** use the tracker's Supabase Storage bucket. Make sure the `screenshots` bucket exists (private, not public).

---

## Testing Priority (THIS PROJECT — do these in order)

Test on a real AWS WorkSpace. This is the only environment that matters.

### Must-pass (blockers — if these fail, we need alternatives)
1. **`screenshot-desktop` captures screenshots on WorkSpaces** — if this fails, we need an alternative capture method. Test with multi-monitor if applicable.
2. **`@miniben90/x-win` detects active windows on WorkSpaces** — native binary must load and return app name + window title.
3. **`powerMonitor.getSystemIdleTime()` returns correct values** — known Chromium bug #30126 may affect this. If it returns 0 always, fall back to `desktop-idle` package.
4. **NSIS installer works on WorkSpaces** — install, reboot, verify auto-launch via Registry Run key, tray icon appears.

### Must-pass (functionality)
5. **Agent reads config.json and authenticates** — write a test config file manually, agent starts without login screen.
6. **Sync engine POSTs to standalone API** — start timer, wait 60s, verify data appears in Supabase Postgres.
7. **Presigned screenshot upload works** — capture screenshot, get presigned URL, upload to Supabase Storage, verify file exists in bucket.
8. **Idle detection shows dialog** — leave the WorkSpace idle for 5 min, verify the keep/discard/stop dialog appears.
9. **Window tracking logs app names** — open Chrome, Notepad, etc., verify WindowSample records in DB show correct app names.

### Should-pass (resilience)
10. **Offline queue works** — disconnect network on WorkSpace, track time for 5 min, reconnect, verify data syncs.
11. **Agent survives WorkSpace sleep/wake** — put WorkSpace to sleep, wake it, verify agent resumes tracking.
12. **Agent auto-updates** — push a new version to S3, verify the running agent picks it up.

### How to test
- Deploy `web/` to Vercel as its own project (e.g., `valerie-tracker-staging.vercel.app`)
- Seed a test user in the tracker's Supabase DB with a known `trackerApiKey`
- Create `C:\ProgramData\ValerieAgent\config.json` on the WorkSpace manually with the test key and staging API URL
- Install the agent on the WorkSpace
- Run through the tests above
- Report results back — what passed, what failed, what error messages

---

## Summary: Your Checklist

| # | Task | Status |
|---|------|--------|
| 1 | **Delete all dashboard UI** from web/ (pages, components, layouts, design tokens) | DONE |
| 2 | Rewrite web/ root layout to bare skeleton | DONE |
| 3 | Rewrite web/ root page to "Valerie Tracker API" or simple health check | DONE |
| 4 | Swap agent auth from Supabase Auth to API key + config.json | DONE |
| 5 | Add `trackerApiKey` field to standalone User model | DONE |
| 6 | Replace Supabase JWT middleware with API key lookup in all routes | DONE |
| 7 | Add `GET /api/tracker/ping` endpoint (validates key, returns 200) | DONE |
| 8 | Add `GET /api/tracker/config` endpoint (returns org settings for the VA) | DONE |
| 9 | Remove LoginScreen as default (keep behind --dev flag) | DONE |
| 10 | Add config.json reading + safeStorage caching to agent startup | DONE |
| 11 | Add error screen for "tracker not configured" | DONE |
| 12 | Deploy standalone `web/` to Vercel for testing | DONE |
| 13 | Build NSIS installer | DONE |
| 13a | Add electron-updater auto-update (GitHub Releases, tray menu, 4h checks) | DONE |
| 14 | Test on real AWS WorkSpace (all 12 items in Testing Priority) | DONE (2026-02-27) |
| 15 | Fix any native module / compatibility issues found during testing | DONE (2026-02-27) |
| 16 | Verify screenshot capture + upload end-to-end | DONE (2026-02-27) |
| 17 | Verify sync engine end-to-end | DONE (2026-02-27) |
| 18 | Package final working installer ready for golden image | DONE (2026-02-27, updated 2026-03-02) -- v0.2.7 is the current stable installer. Rebranded to "Valerie Agent" in v0.1.7, icon fixes in v0.1.8-v0.1.9. v0.2.0 added `perMachine: true` for C: drive install on golden images. v0.2.6 fixed screenshot metadata, removed capture notification. v0.2.7 fixed stale timer resume + auto-stop on prolonged idle. |

### Agent Auth Swap -- COMPLETE (tasks 4, 9-11)

The agent now uses API key auth from config.json with safeStorage caching. The implemented startup sequence:

1. Check Electron safeStorage for cached API key + apiBaseUrl
2. If not cached, read `C:\ProgramData\ValerieAgent\config.json` (falls back to `C:\ProgramData\ValerieTracker\config.json`)
3. Cache apiKey in safeStorage (encrypted via Windows DPAPI)
4. Ping `GET /api/tracker/ping` to validate key
5. If valid (200), fetch `GET /api/tracker/config` for server settings
6. Merge settings (server wins over local config.json values)
7. Cache merged settings for offline starts
8. Show MainScreen and start tracking engines
9. If key invalid (401) --> show ErrorScreen ("API key is invalid or revoked")
10. If no config.json and no cached key --> show ErrorScreen ("Tracker not configured")
11. If offline but cached key + settings exist --> start tracking with cached settings

LoginScreen is preserved behind `--dev` flag for development with Supabase Auth.

### Auto-Update via GitHub Releases -- COMPLETE (task 13a)

The agent now auto-updates from GitHub Releases using electron-updater.

**How it works:**
1. On startup (non-dev mode), calls `autoUpdater.checkForUpdatesAndNotify()`
2. Rechecks every 4 hours via setInterval
3. Downloads updates silently in the background
4. Shows OS notification: "Update ready -- will install on next restart"
5. Installs on next natural app quit (`autoInstallOnAppQuit = true`)
6. Never force-quits the user mid-work
7. Tray menu has "Check for Updates" item for manual checks
8. All events logged with `[AutoUpdater]` prefix

**Files changed:**
- `agent/src/main/auto-updater.ts` -- new module (init, manual check, cleanup)
- `agent/src/main/index.ts` -- calls initAutoUpdater() after app ready (non-dev only)
- `agent/src/main/tray.ts` -- "Check for Updates" menu item above "Quit"
- `agent/electron-builder.yml` -- publish provider changed from generic/S3 to github
- `agent/package.json` -- added `publish:agent` script

**Publishing a release:**
```bash
# Set GH_TOKEN with repo scope (one-time setup)
export GH_TOKEN="ghp_your_token_here"

# Bump version in agent/package.json, then:
cd agent
npm run publish:agent
```
This builds the NSIS installer and uploads it as a GitHub Release with `latest.yml` metadata. Running agents will detect it within 4 hours (or immediately if user clicks "Check for Updates").

**GH_TOKEN is needed ONLY at publish time.** The agent checks for updates using the public GitHub Releases API -- no token needed at runtime.

**Task 14:** Installed on AWS WorkSpace via NSIS installer. Config.json auth working -- agent reads `C:\ProgramData\ValerieAgent\config.json` (falls back to `C:\ProgramData\ValerieTracker\`), pings Vercel API (`/api/tracker/ping`), fetches server config (`/api/tracker/config`). Auto-launch on reboot confirmed via Registry Run key (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`). All 12 Testing Priority items tested and passing.

**Task 15:** All native modules work on AWS WorkSpaces without any compatibility issues. No fallbacks needed. Specifically: `screenshot-desktop` captures screenshots correctly, `@miniben90/x-win` detects active windows (Chrome, PowerShell, Explorer, Electron all identified with correct app names and window titles), `powerMonitor.getSystemIdleTime()` returns correct values (Chromium bug #30126 did NOT affect Electron 34.5.8), `better-sqlite3` local SQLite cache working, `sharp` WebP compression working (~73-96KB per screenshot). The `desktop-idle` fallback package was not required.

**Task 16:** Screenshot capture + presigned URL upload + Supabase Storage + metadata sync all verified end-to-end on WorkSpace. WebP format via sharp, ~73-96KB per screenshot. Randomized timing within 10-minute intervals. 4 screenshots captured during test session. All metadata fields populated: capturedAt, storageUrl, storagePath, activityPct, activeApp, fileSizeBytes.

**Task 17:** Full sync engine verified end-to-end on WorkSpace. All record types sync correctly: TimeEntries (create on start + update on stop with stoppedAt/status/durationSec), ActivitySnapshots (60s intervals, 0-82% activity range observed), WindowSamples (3s polling aggregated, app names and titles captured), Screenshots (metadata synced after presigned URL upload). Two server-side fixes were required during testing: (1) nullable taskId -- Zod schema changed from `z.string().optional()` to `z.string().nullable().optional()` because the agent sends null for taskless time entries; (2) timeEntryId resolution -- sync route now maps `timeEntryIdempotencyKey` to actual DB IDs for child records (ActivitySnapshot, WindowSample, Screenshot) via a lookup after TimeEntry upsert.

**Task 18:** v0.2.0 is the current stable installer. Rebranded to "Valerie Agent" in v0.1.7, icon fixes in v0.1.8-v0.1.9, `perMachine: true` added in v0.2.0 for C: drive install on WorkSpaces golden images (C: drive persists in captured images, D: drive does not). The original v0.1.0 installer had three renderer issues that only manifested on sustained WorkSpace use, requiring five intermediate releases (v0.1.1-v0.1.5) to diagnose and fix. The v0.2.0 installer is ready for golden image deployment on AWS WorkSpaces.

---

## WorkSpace Testing Completed (2026-02-27)

All 18 integration guide tasks are DONE. The Electron desktop agent has been tested end-to-end on a real AWS WorkSpace with all tests passing:

- **Installation**: NSIS installer works with `perMachine: true` (installs to `C:\Program Files\Valerie Agent\`), auto-launch on reboot via Registry Run key
- **Authentication**: Config.json + API key auth working, Vercel API connection verified
- **Native modules**: All 5 native packages work out of the box (screenshot-desktop, x-win, powerMonitor, better-sqlite3, sharp)
- **Tracking**: Time entries, activity snapshots, window samples, and screenshots all capture and sync correctly
- **Sync**: Agent syncs every 60s to Vercel API, idempotency keys prevent duplicates, two server-side fixes applied
- **Screenshots**: Randomized capture, WebP compression, presigned URL upload to Supabase Storage, metadata synced

**Post-initial-testing fixes (v0.1.1-v0.1.7):** Three issues were discovered after the initial v0.1.0 testing that only manifested on sustained WorkSpace use: (1) `projects:list` IPC handler returned raw API response `{ projects: [...] }` instead of unwrapping the array, causing MainScreen to crash on `.map()` -- fixed in ipc.ts. (2) Chromium GPU cache permission errors on WorkSpaces caused renderer white screen -- fixed with `disableHardwareAcceleration` and related flags in index.ts. (3) DevTools crashed on WorkSpaces due to empty `Intl.Locale` -- fixed with `--lang=en-US` flag. Auto-update via electron-updater was found to be unreliable with NSIS; current deployment uses manual installer download.

**Golden image deployment is the primary deployment method.** The v0.2.0 installer with `perMachine: true` installs to `C:\Program Files\Valerie Agent\` on the C: drive, which persists in AWS WorkSpaces captured images (the D: drive user profile does not). Auto-update via electron-updater is unreliable with NSIS; deploy new versions by rebuilding the golden image with the latest installer.

**The project is ready for va-platform integration.** The agent repo stays alive for future agent updates. The web/ folder (standalone API) gets retired when va-platform absorbs the routes.

**When all 18 items are done, hand it back to the va-platform project for integration.**

---

## Current Integration Status (v0.2.7)

The agent now syncs to va-platform at staging.hirevalerie.com (previously used standalone API at valerie-tracker-web.vercel.app).

### Agent-side fixes since v0.2.5

- **v0.2.6:** Screenshot metadata now correctly includes `storageUrl` and `storagePath` in the sync payload. Previously these fields were not set before the outbox insert, resulting in null values being synced even when the presigned URL upload succeeded. Desktop notification on screenshot capture has been removed (screenshots are now captured silently).
- **v0.2.7:** Stale timer detection on resume -- if the gap between now and the last known activity exceeds the idle threshold, the timer auto-stops with `durationSec` reflecting actual work time (not including reboot/downtime gap). Also added auto-stop on prolonged unanswered idle (configurable via `autoStopIdleMin`, default 15 minutes) to prevent phantom sessions.

### Working sync routes on va-platform

| Route | Method | Status |
|-------|--------|--------|
| /api/tracker/sync | POST | Working -- time entries, activity snapshots, window samples all land correctly |
| /api/tracker/ping | GET | Working -- key validation works |
| /api/tracker/config | GET | Working -- returns org settings correctly |

### Broken/missing on va-platform

| Route | Method | Issue |
|-------|--------|-------|
| /api/tracker/screenshots/presign | POST | Returns 400 -- field mismatch in Zod schema. Agent-side metadata fix applied in v0.2.6 (storageUrl/storagePath now populated). Va-platform Zod schema still needs updating. |
| /api/tracker/time-entries | GET | Returns 404 -- endpoint not built yet |
| pageTitle field | -- | Not yet accepted in sync Zod schema or stored in WindowSample table |

### Agent sync payload shape (v0.2.7)

```json
{
  "timeEntries": [{
    "idempotencyKey": "uuid",
    "startedAt": "ISO 8601",
    "stoppedAt": "ISO 8601 | null",
    "durationSec": "number | null",
    "status": "RUNNING | STOPPED | IDLE_DISCARDED",
    "projectId": "string | null",
    "taskId": "string | null",
    "note": "string | null"
  }],
  "activitySnapshots": [{
    "idempotencyKey": "uuid",
    "timestamp": "ISO 8601",
    "activityPct": "0-100",
    "keyboardPct": "number | null",
    "mousePct": "number | null",
    "timeEntryIdempotencyKey": "uuid"
  }],
  "windowSamples": [{
    "idempotencyKey": "uuid",
    "timestamp": "ISO 8601",
    "appName": "string",
    "windowTitle": "string | null",
    "pageTitle": "string | null",
    "processPath": "string | null",
    "durationSec": "number",
    "timeEntryIdempotencyKey": "uuid"
  }],
  "screenshots": [{
    "idempotencyKey": "uuid",
    "capturedAt": "ISO 8601",
    "storageUrl": "string",
    "storagePath": "string | null",
    "activityPct": "number | null",
    "activeApp": "string | null",
    "fileSizeBytes": "number | null",
    "timeEntryIdempotencyKey": "uuid"
  }]
}
```

### Agent presign request shape

```json
{
  "filename": "{idempotencyKey}.webp",
  "contentType": "image/webp",
  "timeEntryIdempotencyKey": "uuid",
  "capturedAt": "ISO 8601",
  "activityPct": 62,
  "activeApp": "Google Chrome",
  "fileSizeBytes": 85000
}
```
