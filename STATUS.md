# Valerie Tracker -- Build Status

Last updated: 2026-02-27
Branch: staging (19 commits)

## Overall Status: NSIS Installer Built -- Ready for WorkSpace Testing

All 6 build phases completed. Agent auth swapped from Supabase Auth to API key + config.json (tasks 1-12 done). NSIS installer built and verified (task 13 done). Next: test on AWS WorkSpace (tasks 14-18).

---

## Phase 1: Monorepo Foundation -- DONE

- [x] Root package.json with npm workspaces (web, agent, shared, prisma)
- [x] shared/ workspace -- enums.ts, types.ts, sync-payload.ts
- [x] prisma/schema.prisma -- 10 models, 5 enums
- [x] Database schema pushed to Supabase Postgres
- [x] .env configured with URL-encoded credentials
- [x] .gitignore covering all workspaces

**Models:** User, Organization, Membership, Project, Task, TaskAssignment, TimeEntry, ActivitySnapshot, Screenshot, WindowSample
**Enums:** UserRole, ProjectStatus, TaskStatus, TimeEntryStatus, MembershipStatus

## Phase 2: API Routes -- DONE

All 13 API routes implemented with API key auth (validateApiKey), Zod validation, and proper error handling. Includes /api/tracker/ping and /api/tracker/config agent endpoints.

| Route | Method | Status |
|-------|--------|--------|
| /api/auth/register | POST | Done -- admin-only, creates user + membership |
| /api/sync | POST | Done -- batched upsert with idempotency keys |
| /api/screenshots/presign | POST | Done -- Supabase Storage presigned URLs |
| /api/screenshots | GET | Done -- paginated, org-scoped |
| /api/screenshots/[id] | DELETE | Done -- VA-only, 24h window, soft delete |
| /api/projects | GET, POST | Done -- org-scoped CRUD |
| /api/projects/[id]/tasks | POST | Done -- create task under project |
| /api/tasks/[id] | PATCH | Done -- update status/title |
| /api/time-entries | GET | Done -- date/user/project filters |
| /api/activity | GET | Done -- date range query |
| /api/dashboard/live | GET | Done -- real-time VA status |
| /api/tracker/ping | GET | Done -- API key validation, returns userId |
| /api/tracker/config | GET | Done -- returns org settings for the VA |

**Auth middleware:** web/src/lib/auth.ts -- validateApiKey, AuthError, handleApiError

## Phase 3: Electron Agent -- DONE

13 main process modules + preload + renderer (3 screens).

| Module | File | Status |
|--------|------|--------|
| Entry point | index.ts | Done -- dual startup: --dev (Supabase) or normal (API key) |
| Config | config.ts | Done -- isDevMode flag, dynamic apiBaseUrl getter/setter |
| Tracker Config | tracker-config.ts | Done -- config.json reading, safeStorage, ping, server config merge, offline |
| Auth | auth.ts | Done -- getAuthHeaders() for both modes, Supabase gated behind --dev |
| Database | database.ts | Done -- SQLite outbox (better-sqlite3) |
| Timer | timer.ts | Done -- start/stop/resume, UUID keys |
| Activity | activity.ts | Done -- powerMonitor 1s polling |
| Window tracking | window-tracker.ts | Done -- x-win 3s polling, heartbeat |
| Screenshots | screenshot.ts | Done -- randomized, WebP via sharp |
| Idle detection | idle-detector.ts | Done -- idle prompt dialog |
| Sync engine | sync.ts | Done -- 60s batch + screenshot upload |
| System tray | tray.ts | Done -- green/gray icons, context menu |
| Auto-launch | auto-launch.ts | Done -- Windows Registry Run key |
| IPC handlers | ipc.ts | Done -- contextBridge API |

**Renderer screens:** LoginScreen (--dev only), MainScreen (project list + timer), IdleDialog, ErrorScreen (not-configured / key-invalid)
**Preload:** contextBridge with typed API (auth, timer, projects, config, activity, screenshots, idle)

## Phase 4: Web Dashboard -- REMOVED

Dashboard UI stripped from web/ -- production dashboard lives in va-platform repo. The web/ folder is now a headless API server only.

## Phase 5: Packaging Config -- DONE

- [x] electron-builder.yml -- NSIS installer, native module asarUnpack, no code signing
- [x] Build script: `npm run build:agent` (vite + tsc + electron-builder --win)
- [x] NSIS installer built: "Valerie Tracker Setup 0.1.0.exe" (81 MB)
- [x] All native .node binaries verified in app.asar.unpacked (better-sqlite3, sharp, x-win)

## Phase 6: Integration -- DONE

- [x] README.md with setup instructions and API reference
- [x] Environment variable configuration for all workspaces
- [x] Supabase clients: server (service role), browser (anon key), agent (anon key)

---

## Post-Build Fixes

| Fix | Commit | Description |
|-----|--------|-------------|
| Native modules | bc67dff | Installed @electron/rebuild, fixed NODE_MODULE_VERSION mismatch |
| Env loading | 8937ace | Added dotenv with multi-path fallback in agent entry point |
| Config fallbacks | 8937ace | config.ts checks both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL |
| Dev script | e66f288 | Added preload tsc --watch + cross-env NODE_ENV=development for Vite HMR |
| Vercel prep | 526be1b | postinstall prisma generate, prisma to deps, transpilePackages: shared |
| NSIS installer | 0ea2a8c | electronVersion pinned to 34.5.8 (workspace monorepo detection fix) |
| NSIS installer | 0ea2a8c | asarUnpack patterns for better-sqlite3, sharp, x-win, screenshot-desktop native binaries |
| NSIS installer | 0ea2a8c | signAndEditExecutable: false (skip code signing for AWS WorkSpaces) |
| NSIS installer | 0ea2a8c | Added description + author to agent/package.json (required by electron-builder) |
| NSIS installer | 0ea2a8c | Placeholder icon created at agent/resources/icon.ico (256x256) |

## Deployment

| Item | Detail |
|------|--------|
| Platform | Vercel (serverless) |
| Production URL | https://valerie-tracker-web.vercel.app |
| Deploy source | staging branch (auto-deploys on push) |
| Build time | ~55s |
| API routes | All 13 routes working on Vercel serverless |
| Verified endpoints | /api/tracker/ping, /api/tracker/config (tested via PowerShell) |
| Root directory | web/ (configured in Vercel dashboard) |
| Prisma | postinstall script generates client during Vercel install step |
| Note | Vercel Deployment Protection is on by default for Pro accounts -- must be disabled or set to preview-only for agent access |

### Agent Installer

| Item | Detail |
|------|--------|
| Installer | Valerie Tracker Setup 0.1.0.exe |
| Size | 81 MB |
| Format | NSIS (non-silent, user chooses install dir) |
| Architecture | Windows x64 only |
| Code signing | Disabled (not needed for AWS WorkSpaces) |
| Native modules | better-sqlite3 (rebuilt for Electron 34.5.8), sharp-win32-x64, x-win-win32-x64-msvc |
| Build command | `cd agent && npm run build:agent` |
| Output dir | agent/dist/ |
| Tested | Installs and launches on dev machine, all native modules load |

---

## File Inventory

```
valerie-tracker/
  package.json              -- workspaces: web, agent, shared, prisma
  .env                      -- Supabase credentials (URL-encoded)
  .gitignore
  README.md
  STATUS.md                 -- this file
  DESIGN-BRIEF.md           -- styling tokens only (not a feature spec)
  PROJECT-PLAN.md
  TECHNICAL-BLUEPRINT.md
  SCHEMA.prisma             -- reference copy

  shared/src/               -- 4 files
    enums.ts, types.ts, sync-payload.ts, index.ts

  prisma/
    schema.prisma           -- 10 models, 5 enums

  web/src/
    app/api/                -- 13 route files (11 original + tracker/ping + tracker/config)
    app/layout.tsx          -- bare skeleton
    app/page.tsx            -- API stub
    lib/                    -- auth.ts, prisma.ts, supabase-server.ts (supabase-browser.ts + auth-helpers.ts deleted)

  agent/src/
    main/                   -- 14 modules (entry, config, tracker-config, auth, db, timer, activity,
                               window-tracker, screenshot, idle, sync, tray, auto-launch, ipc)
    preload/                -- contextBridge (auth, timer, projects, config, idle, app)
    renderer/               -- App, main, index.html
    renderer/screens/       -- Login (--dev only), Main, IdleDialog, ErrorScreen
```

---

## Integration Guide Progress

| # | Task | Status |
|---|------|--------|
| 1 | Delete all dashboard UI from web/ | DONE (2026-02-26) |
| 2 | Rewrite web/ root layout to bare skeleton | DONE (2026-02-26) |
| 3 | Rewrite web/ root page to "Valerie Tracker API" | DONE (2026-02-26) |
| 5 | Add `trackerApiKey` field to standalone User model | DONE (2026-02-26) |
| 6 | Replace Supabase JWT middleware with API key lookup in all routes | DONE (2026-02-26) |
| 7 | Add `GET /api/tracker/ping` endpoint | DONE (2026-02-26) |
| 8 | Add `GET /api/tracker/config` endpoint | DONE (2026-02-26) |
| 9 | Remove LoginScreen as default (keep behind --dev flag) | DONE (2026-02-26) |
| 10 | Add config.json reading + safeStorage caching to agent startup | DONE (2026-02-26) |
| 11 | Add error screen for "tracker not configured" | DONE (2026-02-26) |
| 12 | Deploy standalone web/ to Vercel for testing | DONE (2026-02-27) |
| 13 | Build NSIS Windows installer | DONE (2026-02-27) |

**Tasks 1-3:** Dashboard UI stripped from web/ -- all pages, components, layout wrappers, design tokens, and fonts removed. Root layout rewritten to bare `<html><body>{children}</body></html>`. Root page replaced with simple "Valerie Tracker API" stub.

**Task 5:** Field added: `trackerApiKey String? @unique` on User model. Applied via `prisma db push`. Prisma client regenerated.

**Task 6:** auth.ts rewritten with validateApiKey (reads `Bearer vt_...`, looks up trackerApiKey via Prisma). All 11 route files updated to use validateApiKey instead of validateRequest. requireRole removed from all routes. supabase-browser.ts and auth-helpers.ts deleted (only used by removed dashboard UI). supabase-server.ts kept for Storage presigned URLs.

**Task 7:** New endpoint at /api/tracker/ping -- validates API key, returns `{ status: "ok", userId }` on success, 401 on invalid key. Agent calls this on startup to verify its key.

**Task 8:** New endpoint at /api/tracker/config -- validates API key, looks up user's active Membership with Organization, returns org settings (screenshotFreq, idleTimeoutMin, blurScreenshots, trackApps, trackUrls) plus userId and orgId. Returns 404 if no active membership.

**Task 9:** LoginScreen gated behind --dev flag. Normal startup (no --dev) skips LoginScreen entirely and goes to config.json/safeStorage auth flow. process.argv checked in config.ts via isDevMode constant.

**Task 10:** New module tracker-config.ts handles the full API key auth startup:
1. Checks safeStorage for cached API key + apiBaseUrl
2. Falls back to reading C:\ProgramData\ValerieTracker\config.json
3. Caches apiKey in safeStorage (encrypted via DPAPI)
4. Pings GET /api/tracker/ping to validate key (200=ok, 401=invalid)
5. Fetches GET /api/tracker/config for server settings
6. Merges settings (server wins over local config.json)
7. Caches merged settings for offline starts
8. Offline behavior: if cached key + settings exist but server unreachable, starts tracking with cached settings
Updated: auth.ts (getAuthHeaders for both modes, Supabase gated behind --dev), config.ts (isDevMode, dynamic apiBaseUrl), sync.ts (uses getAuthHeaders), ipc.ts (uses getAuthHeaders, added config:retry + config:state handlers), index.ts (dual startup flow)

**Task 11:** ErrorScreen.tsx with two states: "not configured" (no config.json, no cached key) and "key invalid" (401 from ping). Retry button re-runs initTrackerConfig. Preload bridge updated with config:retry, config:getState, onConfigReady, onConfigError. App.tsx updated with screen routing (loading/login/main/error).

**Task 12:** web/ deployed to Vercel at https://valerie-tracker-web.vercel.app. Build config: postinstall script for prisma generate (--schema=../prisma/schema.prisma), prisma moved from devDependencies to dependencies, transpilePackages: ['shared'] in next.config.ts. Auto-deploys from staging branch. 55s build time. All 13 API routes verified working on Vercel serverless. Ping and config endpoints confirmed via PowerShell.

**Task 13:** NSIS installer built successfully. Key fixes: pinned electronVersion to 34.5.8 in electron-builder.yml (workspace monorepo prevented auto-detection from hoisted node_modules). Added asarUnpack patterns for all native modules so .node binaries are extracted from asar at runtime. Set signAndEditExecutable: false to skip code signing (winCodeSign extraction failed on Windows due to symlink privilege issue -- not needed for AWS WorkSpaces deployment). Added required description/author fields to agent/package.json. Created placeholder 256x256 icon at agent/resources/icon.ico. Output: "Valerie Tracker Setup 0.1.0.exe" (81 MB) in agent/dist/. Verified all three native .node files present in app.asar.unpacked: better_sqlite3.node (rebuilt for Electron), sharp-win32-x64.node, x-win.win32-x64-msvc.node. screenshot-desktop's win32 capture utility (screenCapture_1.3.2.bat) also included.

---

## Known Issues / Next Steps

**Auth work complete (tasks 1-11). Vercel deployment complete (task 12). NSIS installer built (task 13).** Web API uses API key auth, deployed to https://valerie-tracker-web.vercel.app with auto-deploys from staging. Agent reads config.json, caches key in safeStorage, pings server, fetches/merges server config, handles offline with cached settings. NSIS installer produces working .exe with all native modules packaged.

**Next: Test on AWS WorkSpace (tasks 14-18)**
1. ~~Build NSIS installer (task 13)~~ -- DONE
2. Test on real AWS WorkSpace -- all 12 items in Testing Priority (task 14)
3. Fix native module / compatibility issues (task 15)
4. Verify screenshot capture + upload end-to-end (task 16)
5. Verify sync engine end-to-end (task 17)
6. Package final working installer for golden image (task 18)

**Standing items:**
- No automated tests yet -- manual testing of agent-to-web sync flow required
- Code signing skipped (signAndEditExecutable: false) -- not needed for WorkSpaces, can add later if distributing externally
- Supabase Storage "screenshots" bucket must be created manually (private)
- electron-updater dependency present but not configured with a publish target
- Dashboard UI stripped per INTEGRATION-GUIDE.md -- production dashboard lives in va-platform repo
- Placeholder icon.ico should be replaced with real branding when available
