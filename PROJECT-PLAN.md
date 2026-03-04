# Valerie Tracker — MVP Project Plan

> **Note (2026-03-03):** This is the original build plan. Some sections are now stale:
> - **All 18 integration guide tasks are complete.** WorkSpace testing passed (2026-02-27). Current stable version is v0.3.7. v0.3.6 added tzOffset for timezone-aware today calculation. v0.3.7 fixed auto-launch to use HKLM (machine-wide) for golden image persistence. v0.3.0-v0.3.7 added Chrome extension URL tracking via localhost HTTP bridge, CRX3 packaging, and enterprise force-install policy for Chrome extension deployment. Earlier versions (v0.2.1-v0.2.8) added debug logging, screenshot privacy gating, single instance lock, graceful shutdown, Chrome page title tracking, today total display, close warning dialog, and note input. Agent now syncs to va-platform at staging.hirevalerie.com. See STATUS.md for details.
> - **Auth** has been swapped from Supabase Auth (JWT) to API key auth (`Bearer vt_...`). See INTEGRATION-GUIDE.md for current auth design.
> - **Web dashboard** (Phase 4) has been removed. Production dashboard lives in va-platform repo. The web/ folder is now a headless API server only.
> - **API routes** now include `/api/tracker/ping` and `/api/tracker/config` (not in original plan).
> - **Sync route fixes** applied during WorkSpace testing: nullable taskId in Zod schema, timeEntryId resolution from idempotency keys for child records.
> - **Seed script** available at `prisma/seed.ts` -- run `npx prisma db seed` to create test data (1 user, 1 org, 2 projects, 6 tasks).
> - **config.json only requires `apiKey` and `apiBaseUrl`** -- the server resolves `orgId` and `userId` from the API key. All other settings are fetched from the server.
> - **Production provisioning is automatic** -- va-platform provisions config.json via AWS SSM RunCommand (`deployTrackerConfig()`) when a VA is hired and their WorkSpace becomes AVAILABLE. Zero manual setup.
> - **v0.3.5 end-to-end test verified** -- full chain confirmed working on AWS WorkSpace (extension force-install, URL capture, sync to staging.hirevalerie.com, screenshots, activity, idle detection).
> - See STATUS.md for current build status and INTEGRATION-GUIDE.md for the complete task checklist (all DONE).

## Overview

Valerie Tracker is a lightweight Hubstaff replacement that provides time tracking, screenshot capture, activity monitoring, and task management for virtual assistants. It consists of:

1. **Electron Desktop Agent** — installed on VA's Windows machine (AWS WorkSpace), captures screenshots, tracks activity, manages tasks/timer
2. **Next.js Web App** — API backend + admin/client dashboard for viewing VA activity, managing projects/tasks, viewing screenshots
3. **Supabase** — Auth, Postgres DB, Storage (screenshots), Realtime (live dashboard)

## Architecture

```
┌─────────────────┐     HTTPS/REST      ┌──────────────────────┐
│  Electron Agent  │ ──────────────────► │  Next.js API Routes  │
│  (on WorkSpace)  │                     │  (Vercel serverless)  │
│                  │  Presigned URL      │                      │
│  - Timer         │ ───── upload ─────► │  Supabase Storage    │
│  - Screenshots   │                     │  (screenshots bucket)│
│  - Activity      │                     └──────────┬───────────┘
│  - Window track  │                                │
│  - SQLite cache  │                     ┌──────────▼───────────┐
└─────────────────┘                     │  Supabase Postgres   │
                                         │  (all tables)        │
┌─────────────────┐  Supabase Realtime  │                      │
│  Web Dashboard   │ ◄────────────────── │  - TimeEntry         │
│  (browser)       │                     │  - ActivitySnapshot  │
│                  │  REST API calls     │  - Screenshot        │
│  - Live activity │ ──────────────────► │  - WindowSample      │
│  - Screenshots   │                     │  - Project / Task    │
│  - Projects      │                     └──────────────────────┘
│  - Task mgmt     │
└─────────────────┘
```

## Data Flow (every 60 seconds while tracking)

1. Agent collects: activity snapshots (per-second active/idle → aggregated to 60s windows), window samples (3s polling → merged by app name), time entry updates (duration, status)
2. Agent writes all data to local SQLite first (offline resilience)
3. Sync engine batches pending rows from SQLite outbox, POSTs to `/api/sync`
4. Server upserts using idempotency keys (`ON CONFLICT DO NOTHING`)
5. Supabase Realtime pushes changes to any connected dashboard browsers

## Screenshot Flow

1. At start of each 10-minute window, agent picks random offset (30s to 9.5min)
2. At that offset: capture via `screenshot-desktop`, compress to WebP via `sharp`
3. Show desktop notification: "Screenshot captured"
4. Request presigned upload URL from `/api/screenshots/presign`
5. Upload WebP directly to Supabase Storage
6. Save screenshot metadata (URL, activity %, active app) to `/api/sync` batch
7. If offline: save to local disk, queue upload for when connectivity returns

## Agent Authentication

1. When VA is onboarded (eventually via HireValerie, for now via dashboard), system creates a Supabase Auth user with auto-generated email/password
2. VA launches Electron agent, enters email/password on login screen
3. Agent calls `supabase.auth.signInWithPassword()`, receives JWT + refresh token
4. Refresh token stored via Electron `safeStorage` API (Windows DPAPI encryption)
5. All subsequent API calls include JWT in Authorization header
6. Token auto-refreshes via Supabase client `startAutoRefresh()`

## Key Packages

### Agent (Electron)
- `electron` + `electron-builder` — app framework + packaging
- `screenshot-desktop` — Windows screenshot capture (shells out to .NET utility)
- `@miniben90/x-win` — Active window detection (Rust/napi-rs, <1ms)
- `sharp` — WebP compression
- `better-sqlite3` — Offline cache + sync queue
- `@supabase/supabase-js` — Auth + storage uploads
- `uuid` — Idempotency key generation
- `electron-updater` — Auto-update from S3

### Web (Next.js)
- `next` 15 — App Router
- `@supabase/supabase-js` + `@supabase/ssr` — Auth + Realtime
- `prisma` + `@prisma/client` — ORM
- `zod` — API validation
- `tailwindcss` — Styling
- `date-fns` — Date formatting
- `recharts` — Activity charts (optional)

## Build Order (for Claude Code one-shot)

### Phase 1: Foundation
1. Initialize monorepo structure (agent/, web/, prisma/, shared/)
2. Set up Prisma schema and push to Supabase
3. Set up Supabase Storage bucket ("screenshots", public read via signed URLs)
4. Create shared TypeScript types (synced between agent and web)

### Phase 2: API Routes (web/)
5. `POST /api/auth/register` — Create user + org membership (admin only)
6. `POST /api/sync` — Receive batched activity data from agent
7. `POST /api/screenshots/presign` — Generate presigned upload URL
8. `GET /api/projects` — List projects + tasks for authenticated user
9. `POST /api/projects` — Create project (CLIENT/ADMIN only)
10. `POST /api/projects/[id]/tasks` — Create task
11. `PATCH /api/tasks/[id]` — Update task (status, assignment)
12. `GET /api/time-entries` — Query time entries (filters: user, date, project)
13. `GET /api/activity` — Query activity snapshots for dashboard
14. `GET /api/screenshots` — Query screenshot metadata for dashboard
15. `DELETE /api/screenshots/[id]` — VA self-delete (24hr window)
16. `GET /api/dashboard/live` — Current tracking status for all org VAs

### Phase 3: Electron Agent Core
17. Electron main process setup (single window, tray, IPC)
18. Login screen (email/password → Supabase auth)
19. Main UI: project/task list with play buttons, timer display
20. Timer engine: start/stop/switch, elapsed time tracking
21. Screenshot capture engine (randomized intervals, `screenshot-desktop` + `sharp`)
22. Active window tracker (3s polling via `@miniben90/x-win`)
23. Activity detector (1s polling via `powerMonitor.getSystemIdleTime()`)
24. Idle detection + prompt dialog (configurable threshold)
25. SQLite local cache (better-sqlite3, outbox table, screenshot queue)
26. Sync engine (60s batch POST to /api/sync, retry with backoff)
27. Screenshot upload (presigned URL flow, offline queue)
28. System tray (green/gray icon, tooltip, context menu)
29. Desktop notification on screenshot capture
30. Auto-launch on startup (Registry Run key)

### Phase 4: Web Dashboard
31. Dashboard layout (sidebar nav, responsive)
32. Live overview page (which VAs are tracking, current activity)
33. VA detail page (timeline, activity chart, app usage breakdown)
34. Screenshot viewer (grid view, date picker, expand modal)
35. Project management page (create/edit projects, create tasks, assign VAs)
36. Task board (list view of tasks per project, status toggles)
37. Basic settings page (screenshot frequency, idle timeout)

### Phase 5: Packaging
38. electron-builder config (NSIS installer, Windows x64)
39. Auto-update config (S3 bucket for releases)
40. Build script (npm run build:agent produces installer)

## Agent UI Wireframe (compact window, ~350px wide)

```
┌─────────────────────────────────────┐
│  Valerie Agent            _ □ ✕     │
├─────────────────────────────────────┤
│                                     │
│  ▶ Project Alpha                    │
│    ├── Task: Email management   [▶] │
│    ├── Task: Data entry         [▶] │
│    └── Task: Research           [▶] │
│                                     │
│  ▶ Project Beta                     │
│    ├── Task: Social media       [▶] │
│    └── Task: Report writing     [▶] │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ● Recording — Email management     │
│                                     │
│         02 : 34 : 17               │
│                                     │
│         [ ■ STOP ]                  │
│                                     │
│  Activity: ████████░░ 78%           │
│                                     │
├─────────────────────────────────────┤
│  + Add note...                      │
└─────────────────────────────────────┘
```

## Idle Detection Flow

```
Timer running → poll getSystemIdleTime() every 30s
  │
  ├── idle < threshold → continue normally
  │
  └── idle >= threshold (default 5 min) → pause timer, show dialog:
      │
      ┌─────────────────────────────────────┐
      │  You've been idle for 5 minutes     │
      │                                     │
      │  What would you like to do?         │
      │                                     │
      │  [Keep Time & Resume]               │
      │  [Discard Idle Time & Resume]       │
      │  [Discard & Stop Timer]             │
      └─────────────────────────────────────┘
```

## Sync Engine Detail

```
Agent (every 60 seconds):
  1. Read all unsynced rows from SQLite outbox
  2. Batch into single POST payload:
     {
       timeEntries: [...],       // create/update
       activitySnapshots: [...], // create
       windowSamples: [...],     // create
       screenshots: [...]        // metadata only (file already uploaded)
     }
  3. POST /api/sync with JWT auth
  4. On 200: mark rows as synced in SQLite
  5. On network error: retry next cycle (exponential backoff, max 5 min)
  6. On 401: trigger token refresh, retry

Server (/api/sync):
  1. Validate JWT, extract userId
  2. For each item, upsert using idempotencyKey
  3. Return { synced: true, counts: { timeEntries: N, ... } }
```

## Screenshot Storage Structure

```
Supabase Storage bucket: "screenshots"

Path format: {orgId}/{userId}/{YYYY-MM-DD}/{idempotencyKey}.webp

Example: clu1234/clu5678/2026-02-23/550e8400-e29b-41d4-a716-446655440000.webp

Presigned URLs: 1 hour expiry for upload, 15 minute expiry for viewing
```

## Environment Variables

### Web (.env)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=
```

### Agent (.env or hardcoded config)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
API_BASE_URL=       # e.g. https://tracker.hirevalerie.com
```

## What's NOT in this MVP

- Integration with HireValerie va-platform (separate project for now)
- HireValerie design system (DM Serif Display, role theming, etc.)
- Stripe billing
- Monitor role
- Recurring task scheduling engine
- Screenshot retention cron (90-day auto-delete)
- Code signing for Windows
- Multi-platform support (Mac/Linux)
- Golden image deployment automation
- Weekly summary reports
- Escalation system
