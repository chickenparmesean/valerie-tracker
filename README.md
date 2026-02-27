# Valerie Tracker

A Hubstaff-replacement time tracker for virtual assistants. Electron desktop agent + Next.js API server (headless, no dashboard UI), backed by Supabase.

## Architecture

```
valerie-tracker/
  shared/    -- Shared TypeScript types and enums
  prisma/    -- Database schema (Prisma ORM)
  web/       -- Next.js 15 headless API server with 13 routes
  agent/     -- Electron desktop app (Windows)
```

- **Agent** writes to local SQLite first, syncs every 60s via batched POST to `/api/sync`
- **Screenshots** upload via presigned URLs to Supabase Storage
- **Activity detection** uses `powerMonitor.getSystemIdleTime()` only (no keylogging)
- **Idempotency keys** (UUID) on all synced records prevent duplicates

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

1. **Seed a test user** with a `trackerApiKey` in the database:
```bash
cd prisma
npx prisma studio
```
Open Prisma Studio, find or create a User, set `trackerApiKey` to something like `vt_test123`. Also create an Organization and Membership for that user.

2. **Create the config file** the agent reads on startup:
```
C:\ProgramData\ValerieTracker\config.json
```
```json
{
  "apiBaseUrl": "http://localhost:3000",
  "apiKey": "vt_test123",
  "vaId": "test-va-001",
  "screenshotFreq": 1,
  "idleTimeoutMin": 5,
  "blurScreenshots": false,
  "trackApps": true,
  "trackUrls": true
}
```

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
| web | `npm run dev` | Start Next.js dev server (port 3000) |
| web | `npm run build` | Production build |
| agent | `npm run dev` | Start Electron in dev mode |
| agent | `npm run build` | Compile main + preload + renderer |
| agent | `npm run build:agent` | Build + package Windows installer |
| agent | `npm run typecheck` | Type-check main + preload |

## API Routes

All routes require API key Bearer token in the Authorization header: `Authorization: Bearer vt_...`

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create user + membership (admin only) |
| POST | /api/sync | Receive batched activity data from agent |
| POST | /api/screenshots/presign | Get presigned upload URL for Supabase Storage |
| GET | /api/projects | List projects with tasks (org-scoped) |
| POST | /api/projects | Create project |
| POST | /api/projects/[id]/tasks | Create task under project |
| PATCH | /api/tasks/[id] | Update task status or title |
| GET | /api/time-entries | Query time entries (date/user/project filters) |
| GET | /api/activity | Query activity snapshots (date range) |
| GET | /api/screenshots | Query screenshot metadata (paginated) |
| DELETE | /api/screenshots/[id] | Soft-delete screenshot (VA only, 24h window) |
| GET | /api/dashboard/live | Live VA status for dashboard |
| GET | /api/tracker/ping | Validate API key, returns `{ status, userId }` |
| GET | /api/tracker/config | Returns org settings for the authenticated VA |

### GET /api/tracker/ping

Health check and API key validation.

**Response (200):**
```json
{ "status": "ok", "userId": "clu..." }
```

### GET /api/tracker/config

Returns organization settings for the agent. The agent calls this on startup to fetch tracking configuration.

**Response (200):**
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

**Response (404):** `{ "error": "No active organization" }` -- user has no active membership.

## Database Models

10 Prisma models: User, Organization, Membership, Project, Task, TaskAssignment, TimeEntry, ActivitySnapshot, Screenshot, WindowSample

See `prisma/schema.prisma` for full schema.

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
| Packaging | electron-builder (NSIS) |
