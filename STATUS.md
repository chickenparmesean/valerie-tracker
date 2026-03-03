# Valerie Tracker -- Build Status

Last updated: 2026-03-03
Branch: staging

## Overall Status: v0.3.2 Stable -- CRX Build Pipeline Fix

All 6 build phases completed. All 18 integration guide tasks DONE. Agent auth swapped from Supabase Auth to API key + config.json (tasks 1-12). NSIS installer built and verified (task 13). WorkSpace testing completed (tasks 14-18) -- initial tests passed but three additional renderer/DevTools issues were discovered during sustained WorkSpace use, requiring fixes through v0.1.1-v0.1.6. Two server-side sync route fixes also applied during testing (nullable taskId, timeEntryId resolution from idempotency keys). v0.1.7 rebranded the desktop app from "Valerie Tracker" to "Valerie Agent" -- updated installer name, install path, config path, window icon, and logo. v0.1.8 bundled icon.ico in extraResources for the runtime window icon. v0.2.0 fixed signAndEditExecutable to embed the icon in the .exe binary. **v0.2.0 added `perMachine: true` to the NSIS config** -- the installer now defaults to `C:\Program Files\Valerie Agent\` instead of per-user AppData. This is required for AWS WorkSpaces golden images because the D: drive (user volume) does not persist in captured images, only the C: drive (system volume) does. **Versions v0.2.1-v0.2.5** were shipped during WorkSpace debugging and feature iteration. v0.2.1 added debug logging, v0.2.2 fixed screenshot privacy + added refresh button, v0.2.3 added single instance lock + graceful shutdown, v0.2.4 added Chrome page title tracking + today total display, v0.2.5 fixed sync payload and API paths. **v0.2.6** fixed screenshot storageUrl/storagePath not being set on metadata before outbox insert and removed the desktop notification on screenshot capture. **v0.2.7** fixed stale timer resume after reboot (auto-stops with correct durationSec instead of including downtime) and added auto-stop on prolonged unanswered idle (configurable, default 15 minutes). **v0.2.8** added close warning dialog when window X is clicked while timer is running (native dialog with "Keep Working" / "Stop & Close" options) and wired note input end-to-end (text input on MainScreen submits note to current time entry via timer:setNote IPC, note included in sync payload -- previously always null). **v0.3.0** added Chrome extension URL tracking via localhost HTTP bridge on port 19876. A Manifest V3 Chrome extension captures the active tab URL and POSTs it to the agent. The agent includes the URL in WindowSample sync payloads. The NSIS installer bundles the extension in C:\ProgramData\ValerieAgent\chrome-extension\ and registers it via Chrome's external extension registry mechanism (HKLM\SOFTWARE\Google\Chrome\Extensions). Gated behind the trackUrls config flag. **v0.3.2** fixed CRX not included in installer -- pack-extension.js now runs automatically before electron-builder in both build:agent and publish:agent scripts. Current stable version is v0.3.2. The agent now syncs to va-platform at staging.hirevalerie.com.

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

All 13 API routes implemented with API key auth (validateApiKey), Zod validation, and proper error handling. Includes /api/tracker/ping and /api/tracker/config agent endpoints. Sync route fixes applied during WorkSpace testing: nullable taskId in Zod schema (z.string().nullable().optional()), and timeEntryId resolution from idempotency keys for child records (ActivitySnapshot, WindowSample, Screenshot).

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

16 main process modules + preload + renderer (3 screens).

| Module | File | Status |
|--------|------|--------|
| Entry point | index.ts | Done -- dual startup: --dev (Supabase) or normal (API key) |
| Config | config.ts | Done -- isDevMode flag, dynamic apiBaseUrl getter/setter |
| Tracker Config | tracker-config.ts | Done -- config.json reading, safeStorage, ping, server config merge, offline |
| Auth | auth.ts | Done -- getAuthHeaders() for both modes, Supabase gated behind --dev |
| Database | database.ts | Done -- SQLite outbox (better-sqlite3) |
| Timer | timer.ts | Done -- start/stop/resume, UUID keys |
| Activity | activity.ts | Done -- powerMonitor 1s polling |
| Window tracking | window-tracker.ts | Done -- x-win 3s polling, heartbeat, URL from url-bridge |
| URL bridge | url-bridge.ts | Done -- localhost HTTP server on 127.0.0.1:19876, receives URLs from Chrome extension |
| Screenshots | screenshot.ts | Done -- randomized, WebP via sharp |
| Idle detection | idle-detector.ts | Done -- idle prompt dialog |
| Sync engine | sync.ts | Done -- 60s batch + screenshot upload |
| System tray | tray.ts | Done -- green/gray icons, context menu |
| Auto-launch | auto-launch.ts | Done -- Windows Registry Run key |
| Auto-updater | auto-updater.ts | Done -- electron-updater, GitHub Releases, 4h check interval |
| IPC handlers | ipc.ts | Done -- contextBridge API |

**Renderer screens:** LoginScreen (--dev only), MainScreen (project list + timer), IdleDialog, ErrorScreen (not-configured / key-invalid)
**Preload:** contextBridge with typed API (auth, timer, projects, config, activity, screenshots, idle)

## Phase 4: Web Dashboard -- REMOVED

Dashboard UI stripped from web/ -- production dashboard lives in va-platform repo. The web/ folder is now a headless API server only.

## Phase 5: Packaging Config -- DONE

- [x] electron-builder.yml -- NSIS installer, native module asarUnpack, no code signing
- [x] Build script: `npm run build:agent` (vite + tsc + electron-builder --win)
- [x] NSIS installer built: "Valerie Agent Setup 0.1.9.exe"
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
| NSIS installer | 0ea2a8c | Originally signAndEditExecutable: false; changed in v0.2.0 to sign: false + signAndEditExecutable: true (allows rcedit icon embedding without code signing) |
| NSIS installer | 0ea2a8c | Added description + author to agent/package.json (required by electron-builder) |
| NSIS installer | 0ea2a8c | Placeholder icon created at agent/resources/icon.ico (256x256) |
| Sync route: nullable taskId | -- | Zod schema changed from z.string().optional() to z.string().nullable().optional() -- agent sends null for taskless time entries |
| Sync route: timeEntryId resolution | -- | Sync route now maps idempotency keys to actual DB IDs for child records (ActivitySnapshot, WindowSample, Screenshot) -- agent sends timeEntryIdempotencyKey, server resolves to timeEntryId |
| Renderer white screen: projects response | 5a94451 | API returns `{ projects: [...] }` but ipc.ts returned raw object. MainScreen.tsx called `.map()` on non-array, crashed React with no error boundary. Fix: unwrap `data.projects` in ipc.ts `projects:list` handler. |
| Renderer white screen: GPU cache errors | 3e049fb | Chromium disk cache permission errors on AWS WorkSpaces (`cache_util_win.cc` "Access is denied"). Fix: `app.disableHardwareAcceleration()`, `--disable-gpu`, `--no-sandbox`, `--disable-gpu-sandbox`, `--disk-cache-dir` redirect to `userData/Cache`. |
| DevTools crash: Intl.Locale empty | 5a94451 | DevTools wouldn't open on WorkSpaces due to Chromium `Intl.Locale` bug with empty locale string. Fix: `app.commandLine.appendSwitch('lang', 'en-US')`. |
| Rebrand: Valerie Tracker → Valerie Agent | 8ac08ac | Desktop app rebranded to "Valerie Agent" -- updated productName, installer name, install path (`C:\Program Files\Valerie Agent\`), config path (primary `C:\ProgramData\ValerieAgent\`, fallback `C:\ProgramData\ValerieTracker\`), Registry Run key. |
| Icon: complete woman silhouette | 4962ca4 | Regenerated icon.ico with full SVG path (uniform scale 0.74). Replaced "V" letter logos in all renderer screens with inline SVG silhouette. Set BrowserWindow icon + extraResources in electron-builder.yml. |
| v0.1.7: Rebrand Valerie Tracker → Valerie Agent | 8ac08ac | Rename across 11 files, custom icon, fixed auto-update notification text, config path fallback from ValerieTracker to ValerieAgent. |
| v0.1.8: Bundle icon.ico in extraResources | dc9dcb0 | Added extraResources entry in electron-builder.yml so icon.ico is copied to the installed app's resources/ directory for runtime BrowserWindow icon. |
| v0.2.0: Fix signAndEditExecutable for exe icon | dc7f6c0 | Changed `signAndEditExecutable: false` to `sign: false` + `signAndEditExecutable: true` so electron-builder uses rcedit to embed the icon in the .exe binary. |
| Debug logging | v0.2.1 | Added comprehensive console.log to all tracking engine modules (timer, activity, window-tracker, screenshot, idle-detector, sync, database). Native module probing on startup. DevTools opened in undocked mode. --enable-logging flag added. |
| Screenshot privacy fix | v0.2.2 | Screenshots, activity polling, and window tracking now gated behind timer running state. Zero data collection when timer is off. Previously these engines ran continuously regardless of timer state -- privacy violation. |
| Project refresh button | v0.2.2 | Added refresh icon button to top-right of navy header bar in MainScreen. Re-fetches project/task list via projects:list IPC. Spinning animation while loading. |
| Single instance lock | v0.2.3 | Added app.requestSingleInstanceLock(). Second instance quits and focuses existing window. Previously multiple agent windows could be opened simultaneously. |
| Graceful shutdown | v0.2.3 | All engine modules export stop functions. before-quit handler clears all intervals. Defensive console.log wrapper prevents EPIPE broken pipe crash when piped to PowerShell. |
| Chrome page title tracking | v0.2.4 | Window tracker extracts page titles from Chrome windows by stripping " - Google Chrome" suffix. Stored as pageTitle field on window samples. Non-Chrome windows send pageTitle: null. |
| time:getTodayTotal IPC | v0.2.4 | Implemented time:getTodayTotal IPC handler. Calls GET /api/tracker/time-entries?date=YYYY-MM-DD, sums durationSec, adds running timer elapsed. Falls back to local SQLite if API unavailable. Renderer polls every 30 seconds. |
| pageTitle in sync payload | v0.2.5 | sync.ts now includes pageTitle field when building window sample POST body. shared/src/sync-payload.ts updated with pageTitle type. |
| Page title log throttle | v0.2.5 | Chrome page title log only fires on title change, not every 3s poll. Reduces log spam from ~20/min to ~1 per page navigation. |
| time:getTodayTotal path fix | v0.2.5 | Changed API call from /api/time-entries to /api/tracker/time-entries to match va-platform route prefix convention. |
| Screenshot metadata fix | v0.2.6 | Fixed storageUrl and storagePath not being set on screenshot metadata before outbox insert (sync.ts). After presign response and PUT upload, URLs are now written to the metadata object BEFORE the queueForSync call. |
| Screenshot notification removed | v0.2.6 | Removed desktop notification on screenshot capture (screenshot.ts). No notification now shows to the VA when a screenshot is taken. |
| Stale timer auto-stop on resume | v0.2.7 | On resumeTimer(), if the gap between now and last known activity (last_tick_at) exceeds the idle threshold, the timer auto-stops with durationSec reflecting actual work time (not including reboot gap). Prevents wildly inflated time entries after WorkSpace reboots or force-kills. Added last_tick_at column to active_time_entry SQLite table, updated every 60s while timer runs. |
| Auto-stop on prolonged unanswered idle | v0.2.7 | When the idle prompt dialog goes unanswered for 15 minutes (configurable via autoStopIdleMin), the timer auto-stops and idle time is discarded. Prevents 12-hour phantom sessions when a VA closes their WorkSpace without stopping the timer. |
| Close warning on window close | v0.2.8 | When VA clicks window X while timer is running, native dialog.showMessageBox appears: "Stop tracking? Closing Valerie Agent will stop your timer and end the current work session." with "Keep Working" and "Stop & Close" buttons. If timer is not running, window hides to tray as before. Tray "Quit" still quits immediately. Implementation in index.ts BrowserWindow close handler. |
| Note input wired end-to-end | v0.2.8 | Note field on time entries now populated. MainScreen shows text input + submit button while timer running. VA types note, clicks submit, note attached to current time entry via timer:setNote IPC. Input clears after submit. Note included in sync payload (was always null before). Implementation: timer.ts currentNote state + setTimerNote() export, new timer:setNote IPC channel, preload timerSetNote() bridge, MainScreen input UI. |
| Chrome extension URL tracking | v0.3.0 | Manifest V3 Chrome extension (agent/chrome-extension/) captures active tab URL via chrome.tabs API, POSTs to agent's localhost HTTP bridge on 127.0.0.1:19876. New url-bridge.ts module runs Node.js http server, caches URL with 30s staleness check. Window tracker attaches URL to Chrome window samples. NSIS installer copies extension to C:\ProgramData\ValerieAgent\chrome-extension\ and writes Chrome external extension registry keys (HKLM\SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf). Extension ID derived from fixed RSA key in manifest.json. Gated behind trackUrls config flag (defaults to true). Degrades gracefully to null when extension not installed. |
| CORS headers on URL bridge | v0.3.1 | Added Access-Control-Allow-Origin/Methods/Headers to all HTTP responses in url-bridge.ts. Added explicit OPTIONS preflight handler returning 204. Fixes Chrome extension fetch() being blocked by CORS policy. |
| App display name fix | v0.3.1 | Changed package.json description from long string to "Valerie Agent". The description field was leaking into Task Manager and client UI as the app display name. productName in electron-builder.yml was already correct. |
| CRX extension packaging | v0.3.1 | Generated persistent RSA signing key (extension.pem). Chrome extension now packed as CRX2 binary via build/pack-extension.js (Node.js crypto + PowerShell zip, no npm deps). NSIS installer copies .crx to C:\ProgramData\ValerieAgent\ and registers via Chrome external extension registry pointing to .crx file (was pointing to unpacked folder which Chrome doesn't support). Extension ID changed from pdnlbaclbmfbipieaeknjkopdcafeepf to lpdlfbkigloncemklhgcclimjfbglfkk. Old registry keys cleaned up on install and uninstall. Unpacked folder still copied for Load Unpacked debugging. |
| CRX build pipeline fix | v0.3.2 | pack-extension.js was not wired into the build pipeline -- CRX had to be generated manually before running electron-builder, and got skipped. Fixed: build:agent and publish:agent scripts now run `node build/pack-extension.js` before electron-builder, ensuring the .crx is always generated fresh. electron-builder.yml extraResources already included both chrome-extension/ and build/valerie-url-bridge.crx; installer.nsh paths were already consistent. |

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
| Installer | Valerie Agent Setup 0.3.2.exe |
| Size | ~81 MB |
| Format | NSIS (non-silent, user chooses install dir) |
| Architecture | Windows x64 only |
| Install mode | `perMachine: true` -- defaults to `C:\Program Files\Valerie Agent\` (required for golden images -- C: drive persists, D: does not) |
| Code signing | Disabled (`sign: false`), but `signAndEditExecutable: true` allows rcedit to embed icon in .exe |
| Native modules | better-sqlite3 (rebuilt for Electron 34.5.8), sharp-win32-x64, x-win-win32-x64-msvc |
| Build command | `cd agent && npm run build:agent` |
| Publish command | `cd agent && npm run publish:agent` (requires `GH_TOKEN` env var with repo scope) |
| Output dir | agent/dist/ |
| Tested | Installs and launches on dev machine and AWS WorkSpace, all native modules load, full sync verified |
| Note | Versions 0.1.1-0.1.5 were intermediate debug/fix builds during WorkSpace testing. v0.1.6 was the last release under the "Valerie Tracker" name. v0.1.7 rebranded to "Valerie Agent". v0.1.8 bundled icon.ico for runtime window icon. v0.1.9 fixed exe icon embedding. v0.2.0 added `perMachine: true` for C: drive install on WorkSpaces golden images. Versions v0.2.1-v0.2.5 were shipped during WorkSpace debugging and feature iteration. v0.2.1 added debug logging, v0.2.2 fixed screenshot privacy + added refresh button, v0.2.3 added single instance lock + graceful shutdown, v0.2.4 added Chrome page title tracking + today total display, v0.2.5 fixed sync payload and API paths. v0.2.6 fixed screenshot metadata URLs + removed screenshot notification. v0.2.7 fixed stale timer resume after reboot + added auto-stop on prolonged unanswered idle. v0.2.8 added close warning dialog on window close + note input wired to sync payload. v0.3.0 added Chrome extension URL tracking with localhost HTTP bridge and NSIS installer bundling. v0.3.1 added CORS fix on URL bridge, app display name fix, and CRX extension packaging with persistent RSA signing key. v0.3.2 fixed CRX build pipeline -- pack-extension.js now runs automatically before electron-builder. v0.3.2 is the current stable release. |

### WorkSpace Testing Results (2026-02-27)

All tests conducted on a real AWS WorkSpace. Every test passed.

| Test | Result | Details |
|------|--------|---------|
| Install on AWS WorkSpace | PASSED | NSIS installer, default path, launches cleanly |
| Config.json auth | PASSED | Reads C:\ProgramData\ValerieAgent\config.json (falls back to ValerieTracker\), pings Vercel, fetches server config |
| Auto-launch on reboot | PASSED | Registry Run key works, app starts on Windows login |
| screenshot-desktop | PASSED | Captures screenshots correctly on WorkSpaces |
| @miniben90/x-win | PASSED | Detects active windows -- Chrome, PowerShell, Explorer, Electron all identified |
| powerMonitor.getSystemIdleTime() | PASSED | Returns correct values (Chromium bug #30126 did NOT affect this Electron version) |
| better-sqlite3 | PASSED | Local SQLite cache working |
| sharp | PASSED | WebP compression working (~73-96KB per screenshot) |
| Sync engine | PASSED | TimeEntries, ActivitySnapshots, WindowSamples all sync to Supabase Postgres via Vercel API |
| Screenshot capture + upload | PASSED | Randomized capture, presigned URL upload to Supabase Storage, metadata synced. 4 screenshots captured during test session |
| Time entry start/stop | PASSED | Start syncs as RUNNING, stop syncs with stoppedAt + status STOPPED + correct durationSec |
| Activity tracking | PASSED | 60s interval snapshots, activity % calculated correctly (0-82% range observed) |
| Window tracking | PASSED | App names (Electron, Google Chrome, Windows PowerShell, Windows Explorer), window titles, process paths all captured |
| Idle detection | PASSED | Dialog appeared after 5 min idle, "Discard & Stop" option works correctly |
| Screenshot metadata | PASSED | capturedAt, storageUrl, storagePath, activityPct, activeApp, fileSizeBytes all populated |

| Renderer stability | FAILED then FIXED (v0.1.5) | White screen after 0.5s. Root cause: `projects:list` IPC returned raw `{ projects: [...] }` object, `.map()` threw TypeError, no error boundary. Secondary: GPU cache permission errors. Tertiary: DevTools broken by empty `Intl.Locale`. |
| DevTools on WorkSpace | FAILED then FIXED (v0.1.5) | Ctrl+Shift+I produced `Intl.Locale` error. Fixed with `--lang=en-US` flag. |
| Auto-update (electron-updater) | UNRELIABLE | NSIS auto-update downloads but does not reliably install on app restart. Current workaround: download installer manually from GitHub Releases. Needs investigation. |
| Debug logging (v0.2.1) | PASSED | All engine modules log to stdout. Native module probing confirms all 4 modules load. Full visibility into timer state, activity polls, window switches, sync cycles. |
| Screenshot privacy (v0.2.2) | PASSED | Screenshots, activity, window tracking only fire when timer is running. Zero collection when stopped. |
| Single instance (v0.2.3) | PASSED | Second instance quits immediately, focuses existing window. |
| Page title tracking (v0.2.4) | PASSED | Chrome page titles extracted correctly. Logged on title change only. |
| Sync to va-platform (v0.2.5) | PARTIAL | Time entries, activity snapshots, window samples sync to staging.hirevalerie.com. Screenshots blocked by presign 400. Today total blocked by missing endpoint. |

**Native modules on WorkSpaces: ALL PASSED** -- screenshot-desktop, @miniben90/x-win, powerMonitor.getSystemIdleTime(), better-sqlite3, sharp all work out of the box. No fallbacks needed (desktop-idle not required).

**Sync route fixes required during testing:**
- **nullable taskId** -- Agent sends null for taskless time entries. Zod schema changed from `z.string().optional()` to `z.string().nullable().optional()`.
- **timeEntryId resolution** -- Agent sends `timeEntryIdempotencyKey` for child records. Sync route now maps idempotency keys to actual DB IDs via a lookup after TimeEntry upsert.

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
    seed.ts                 -- test data: 1 user, 1 org, 2 projects, 6 tasks (npx prisma db seed)

  web/src/
    app/api/                -- 13 route files (11 original + tracker/ping + tracker/config)
    app/layout.tsx          -- bare skeleton
    app/page.tsx            -- API stub
    lib/                    -- auth.ts, prisma.ts, supabase-server.ts (supabase-browser.ts + auth-helpers.ts deleted)

  agent/src/
    main/                   -- 16 modules (entry, config, tracker-config, auth, db, timer, activity,
                               window-tracker, url-bridge, screenshot, idle, sync, tray, auto-launch, auto-updater, ipc)
    preload/                -- contextBridge (auth, timer, projects, config, idle, app)
    renderer/               -- App, main, index.html
    renderer/screens/       -- Login (--dev only), Main, IdleDialog, ErrorScreen
  agent/chrome-extension/   -- Manifest V3 Chrome extension (background.js, manifest.json)
  agent/build/              -- pack-extension.js, generate-extension-key.js, extension.pem, installer.nsh
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
| 14 | Test on real AWS WorkSpace | DONE (2026-02-27) |
| 15 | Fix native module / compatibility issues | DONE (2026-02-27) -- no issues found, all native modules work |
| 16 | Verify screenshot capture + upload end-to-end | DONE (2026-02-27) |
| 17 | Verify sync engine end-to-end | DONE (2026-02-27) |
| 18 | Package final working installer for golden image | DONE (2026-02-27) -- v0.2.0 is current stable (rebranded to "Valerie Agent", icon fixes through v0.2.0) |

**Tasks 1-3:** Dashboard UI stripped from web/ -- all pages, components, layout wrappers, design tokens, and fonts removed. Root layout rewritten to bare `<html><body>{children}</body></html>`. Root page replaced with simple "Valerie Tracker API" stub.

**Task 5:** Field added: `trackerApiKey String? @unique` on User model. Applied via `prisma db push`. Prisma client regenerated.

**Task 6:** auth.ts rewritten with validateApiKey (reads `Bearer vt_...`, looks up trackerApiKey via Prisma). All 11 route files updated to use validateApiKey instead of validateRequest. requireRole removed from all routes. supabase-browser.ts and auth-helpers.ts deleted (only used by removed dashboard UI). supabase-server.ts kept for Storage presigned URLs.

**Task 7:** New endpoint at /api/tracker/ping -- validates API key, returns `{ status: "ok", userId }` on success, 401 on invalid key. Agent calls this on startup to verify its key.

**Task 8:** New endpoint at /api/tracker/config -- validates API key, looks up user's active Membership with Organization, returns org settings (screenshotFreq, idleTimeoutMin, blurScreenshots, trackApps, trackUrls) plus userId and orgId. Returns 404 if no active membership.

**Task 9:** LoginScreen gated behind --dev flag. Normal startup (no --dev) skips LoginScreen entirely and goes to config.json/safeStorage auth flow. process.argv checked in config.ts via isDevMode constant.

**Task 10:** New module tracker-config.ts handles the full API key auth startup:
1. Checks safeStorage for cached API key + apiBaseUrl
2. Falls back to reading C:\ProgramData\ValerieAgent\config.json (or legacy C:\ProgramData\ValerieTracker\)
3. Caches apiKey in safeStorage (encrypted via DPAPI)
4. Pings GET /api/tracker/ping to validate key (200=ok, 401=invalid)
5. Fetches GET /api/tracker/config for server settings
6. Merges settings (server wins over local config.json)
7. Caches merged settings for offline starts
8. Offline behavior: if cached key + settings exist but server unreachable, starts tracking with cached settings
Updated: auth.ts (getAuthHeaders for both modes, Supabase gated behind --dev), config.ts (isDevMode, dynamic apiBaseUrl), sync.ts (uses getAuthHeaders), ipc.ts (uses getAuthHeaders, added config:retry + config:state handlers), index.ts (dual startup flow)

**Task 11:** ErrorScreen.tsx with two states: "not configured" (no config.json, no cached key) and "key invalid" (401 from ping). Retry button re-runs initTrackerConfig. Preload bridge updated with config:retry, config:getState, onConfigReady, onConfigError. App.tsx updated with screen routing (loading/login/main/error).

**Task 12:** web/ deployed to Vercel at https://valerie-tracker-web.vercel.app. Build config: postinstall script for prisma generate (--schema=../prisma/schema.prisma), prisma moved from devDependencies to dependencies, transpilePackages: ['shared'] in next.config.ts. Auto-deploys from staging branch. 55s build time. All 13 API routes verified working on Vercel serverless. Ping and config endpoints confirmed via PowerShell.

**Task 13:** NSIS installer built successfully. Key fixes: pinned electronVersion to 34.5.8 in electron-builder.yml (workspace monorepo prevented auto-detection from hoisted node_modules). Added asarUnpack patterns for all native modules so .node binaries are extracted from asar at runtime. Set signAndEditExecutable: false to skip code signing (winCodeSign extraction failed on Windows due to symlink privilege issue -- not needed for AWS WorkSpaces deployment). Added required description/author fields to agent/package.json. Created placeholder 256x256 icon at agent/resources/icon.ico. Output: "Valerie Agent Setup 0.1.7.exe" (81 MB) in agent/dist/. Verified all three native .node files present in app.asar.unpacked: better_sqlite3.node (rebuilt for Electron), sharp-win32-x64.node, x-win.win32-x64-msvc.node. screenshot-desktop's win32 capture utility (screenCapture_1.3.2.bat) also included.

---

## Golden Image Deployment

The v0.2.0 installer uses `perMachine: true`, which defaults to `C:\Program Files\Valerie Agent\` on the system volume (C: drive). This is required for AWS WorkSpaces golden images because the D: drive (user volume) does not persist when capturing an image -- only the C: drive (system volume) does.

### Full Golden Image Workflow

1. **Spin up a fresh WorkSpace** from the default Windows bundle (no existing agent install)
2. **RDP into the WorkSpace** and create the config file:
   ```powershell
   New-Item -ItemType Directory -Force -Path "C:\ProgramData\ValerieAgent"
   Set-Content -Path "C:\ProgramData\ValerieAgent\config.json" -Value '{
     "apiBaseUrl": "https://valerie-tracker-web.vercel.app",
     "apiKey": "vt_your_api_key_here",
     "vaId": "golden-image-va"
   }'
   ```
3. **Download the installer** from GitHub Releases (Valerie Agent Setup 0.2.0.exe)
4. **Run the installer** -- perMachine defaults to `C:\Program Files\Valerie Agent\` (user can still change it, but the default is correct)
5. **Verify the install location**:
   ```powershell
   Test-Path "C:\Program Files\Valerie Agent\Valerie Agent.exe"
   ```
6. **Launch the agent** and verify API connection:
   ```powershell
   & "C:\Program Files\Valerie Agent\Valerie Agent.exe"
   ```
   Check that MainScreen loads with projects (not ErrorScreen).
7. **Stop the agent** and optionally clear safeStorage cache:
   ```powershell
   # Optional: clear cached credentials so each VA gets fresh auth
   Remove-Item -Force "$env:APPDATA\Valerie Agent\api-key-cache" -ErrorAction SilentlyContinue
   Remove-Item -Force "$env:APPDATA\Valerie Agent\cached-settings.json" -ErrorAction SilentlyContinue
   ```
8. **Create Image from WorkSpace** (~45 minutes) via AWS Console or CLI
9. **Create Custom Bundle** from the captured image

All WorkSpaces launched from this bundle will have the agent pre-installed on the C: drive and auto-starting via the Registry Run key. Each VA's WorkSpace needs its own `config.json` with the correct API key.

---

## Known Issues / Next Steps

**Confirmed working on WorkSpaces (v0.3.2):**
- All native modules: @miniben90/x-win, screenshot-desktop, better-sqlite3, sharp
- Timer start/stop/resume with state transitions
- Stale timer detection on resume -- auto-stops with correct durationSec when gap exceeds idle threshold (prevents inflated time entries after reboot)
- Auto-stop on prolonged unanswered idle -- if idle prompt goes unanswered for 15 min (configurable), timer auto-stops
- Close warning dialog when window X clicked while timer running (v0.2.8)
- Note input wired end-to-end -- text input on MainScreen, note included in sync payload (v0.2.8)
- Activity detection via powerMonitor.getSystemIdleTime() -- 1s polling, 60s snapshots
- Window tracking via x-win -- 3s polling, heartbeat/pulse aggregation, app switch detection
- Chrome page title extraction from window titles
- Chrome extension URL tracking via localhost HTTP bridge (v0.3.0) -- extension POSTs active tab URL to 127.0.0.1:19876, agent attaches URL to Chrome window samples in sync payload
- CORS headers on URL bridge (v0.3.1) -- extension fetch() no longer blocked by CORS policy
- Screenshot capture + WebP compression (73-96KB), metadata includes storageUrl/storagePath
- Idle detection with configurable threshold
- Local SQLite outbox -- inserts, reads, sync marking
- Sync engine -- 60s cycles, batched POST, retry on failure
- Single instance lock
- Graceful shutdown with engine cleanup
- Data collection gated behind timer running state
- Project refresh button in header
- Today total display with API + local fallback

**Blocked on va-platform (not agent bugs):**
- URLs not visible in dashboard: Agent sends url in sync payload as of v0.3.0. Va-platform needs to add url String? to WindowSample Prisma model -- sync Zod schema silently strips it. pageTitle column also not yet added.

**Va-platform integration requirements (handoff):**
1. Add url String? and pageTitle String? to WindowSample Prisma model + sync route Zod schema
2. Aggregate pageTitle + url data for "Top Sites" dashboard display

**Previously blocked, now resolved on va-platform:**
- Screenshots presign 400 -- RESOLVED (field mismatch fixed on va-platform)
- GET /api/tracker/time-entries 404 -- RESOLVED (endpoint built on va-platform)
- pageTitle column on WindowSample -- RESOLVED on va-platform sync acceptance (column added)
- trackUrls config flag -- RESOLVED (now returned from GET /api/tracker/config, shipped)

**Needs WorkSpace verification (v0.3.1):**
- Chrome extension auto-install via CRX registry: NSIS installer copies .crx to C:\ProgramData\ValerieAgent\ and writes Chrome external extension registry keys (HKLM\SOFTWARE\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk). Load Unpacked from C:\ProgramData\ValerieAgent\chrome-extension\ works, but registry-based CRX auto-install is untested on WorkSpaces.
- CORS fix on URL bridge: Access-Control-Allow-Origin headers added in v0.3.1. Needs WorkSpace verification that extension fetch() succeeds without CORS errors.
- Extension + CRX persistence on golden image: Extension files in C:\ProgramData (C: drive) and registry keys in HKLM should survive image capture. Needs verification.

**Standing issues (agent side):**
- DevTools permanently broken on WorkSpaces due to Chromium Intl.Locale bug with empty locale. Use console.log debugging via PowerShell instead. Cannot be fixed with flags.
- Auto-update via electron-updater still unreliable with NSIS. Deploy by downloading installer from GitHub Releases manually.
- Debug logging (v0.2.1) is still present in all engine modules. Should be stripped or gated behind a --verbose flag before final production release.
- Locale resource warnings spam stderr on launch (Chromium resource_bundle.cc). Cosmetic only, does not affect functionality.

**Debugging the agent on WorkSpaces:**
Launch from PowerShell to see all engine output:
```powershell
& "C:\Program Files\Valerie Agent\Valerie Agent.exe" 2>&1 | Tee-Object -FilePath "$env:USERPROFILE\Desktop\agent-debug.log"
```
Log prefixes: [Native], [Engine], [Timer], [Activity], [Window], [Screenshot], [Idle], [Sync], [DB], [IPC], [App], [AutoUpdater], [DevTools]

**WorkSpaces require Chromium flags:** `app.disableHardwareAcceleration()`, `--disable-gpu`, `--no-sandbox`, `--disable-gpu-sandbox`, `--disk-cache-dir`, `--lang=en-US`. These are set in `agent/src/main/index.ts` before `app.whenReady()`. Do NOT remove them.

**Standing items:**
- No automated tests yet -- all testing was manual on AWS WorkSpace
- Code signing skipped (sign: false) but signAndEditExecutable: true (allows rcedit to embed icon) -- can add code signing later if distributing externally
- Supabase Storage "screenshots" bucket must be created manually (private)
- electron-updater configured for GitHub Releases (publish: github, owner: chickenparmesean, repo: valerie-tracker)
- To publish a release: set GH_TOKEN env var (repo scope), run `npm run publish:agent` from agent/
- Dashboard UI stripped per INTEGRATION-GUIDE.md -- production dashboard lives in va-platform repo
- Custom icon.ico with woman silhouette logo shipped in v0.1.7, bundled as extraResource in v0.1.8, embedded in .exe via rcedit in v0.2.0
