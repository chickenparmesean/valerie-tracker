# Valerie Tracker -- Build Status

Last updated: 2026-02-26
Branch: staging (8 commits)

## Overall Status: MVP COMPLETE -- Ready for Testing

All 6 build phases completed. Web dashboard builds successfully. Electron agent compiles and runs. Three post-build fixes applied (native modules, env loading, documentation).

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

All 12 routes implemented with API key auth (validateApiKey), Zod validation, and proper error handling. Plus /api/tracker/ping health check.

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
| Entry point | index.ts | Done -- dotenv loading, window creation |
| Config | config.ts | Done -- env vars with fallbacks |
| Auth | auth.ts | Done -- Supabase auth, safeStorage (DPAPI) |
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

**Renderer screens:** LoginScreen, MainScreen (project list + timer), IdleDialog
**Preload:** contextBridge with typed API (auth, timer, projects, activity, screenshots, idle)

## Phase 4: Web Dashboard -- REMOVED

Dashboard UI stripped from web/ -- production dashboard lives in va-platform repo. The web/ folder is now a headless API server only.

## Phase 5: Packaging Config -- DONE

- [x] electron-builder.yml -- NSIS installer, app signing placeholders
- [x] Build script: `npm run build:agent` (vite + tsc + electron-builder --win)

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
    app/api/                -- 11 route files (KEPT)
    app/layout.tsx          -- bare skeleton
    app/page.tsx            -- API stub
    lib/                    -- auth.ts, prisma.ts, supabase-server.ts (supabase-browser.ts + auth-helpers.ts deleted)

  agent/src/
    main/                   -- 13 modules (entry, config, auth, db, timer, activity,
                               window-tracker, screenshot, idle, sync, tray, auto-launch, ipc)
    preload/                -- contextBridge
    renderer/               -- App, main, index.html
    renderer/screens/       -- Login, Main, IdleDialog
```

---

## Integration Guide Progress

| # | Task | Status |
|---|------|--------|
| 5 | Add `trackerApiKey` field to standalone User model | DONE (2026-02-26) |
| 6 | Replace Supabase JWT middleware with API key lookup in all routes | DONE (2026-02-26) |
| 7 | Add `GET /api/tracker/ping` endpoint | DONE (2026-02-26) |
| 8 | Add `GET /api/tracker/config` endpoint | DONE (2026-02-26) |

**Task 5:** Field added: `trackerApiKey String? @unique` on User model. Applied via `prisma db push`. Prisma client regenerated.

**Task 6:** auth.ts rewritten with validateApiKey (reads `Bearer vt_...`, looks up trackerApiKey via Prisma). All 11 route files updated to use validateApiKey instead of validateRequest. requireRole removed from all routes. supabase-browser.ts and auth-helpers.ts deleted (only used by removed dashboard UI). supabase-server.ts kept for Storage presigned URLs.

**Task 7:** New endpoint at /api/tracker/ping -- validates API key, returns `{ status: "ok", userId }` on success, 401 on invalid key. Agent calls this on startup to verify its key.

**Task 8:** New endpoint at /api/tracker/config -- validates API key, looks up user's active Membership with Organization included, returns org settings (screenshotFreq, idleTimeoutMin, blurScreenshots, trackApps, trackUrls) plus userId and orgId. Returns 404 if no active membership. Pure-function pattern: handleGetConfig(userId) called from GET handler.

---

## Known Issues / Next Steps

1. **Testing needed:** No automated tests yet. Manual testing of agent-to-web sync flow required.
2. **Code signing:** electron-builder.yml has placeholder for Windows code signing certificate.
3. **Production deployment:** Web app not yet deployed (Vercel recommended).
4. **Supabase Storage bucket:** Must be created manually in Supabase dashboard (name: "screenshots", private).
5. **Auto-updater:** electron-updater dependency present but not configured with a publish target.
6. **Dashboard UI stripped** per INTEGRATION-GUIDE.md -- production dashboard lives in va-platform repo.
