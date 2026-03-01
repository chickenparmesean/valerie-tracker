# Building Valerie Tracker: a complete technical blueprint

## Implementation Notes (2026-02-27)

All recommended packages were used and work correctly on AWS WorkSpaces. Testing was conducted on a real AWS WorkSpace. Current stable version is v0.1.7 (rebranded to "Valerie Agent").

### Package Performance on AWS WorkSpaces

| Package | Blueprint Prediction | Actual Result |
|---------|---------------------|---------------|
| screenshot-desktop | ~150ms capture | Confirmed -- captures correctly, no black screenshot bug |
| @miniben90/x-win | <1ms active window detection | Confirmed -- detects active windows instantly on WorkSpaces (Chrome, PowerShell, Explorer, Electron all identified with correct app names, window titles, and process paths) |
| powerMonitor.getSystemIdleTime() | May be affected by Chromium bug #30126 | Works correctly -- bug did NOT affect Electron 34.5.8 on WorkSpaces. desktop-idle fallback was NOT needed. |
| better-sqlite3 | Offline cache | Confirmed -- local SQLite outbox working, syncs on 60s interval |
| sharp | WebP compression | Confirmed -- ~73-96KB per screenshot (within predicted 100-150KB range, actually smaller) |

### Installer & Resource Usage

- **Installer size**: 81 MB (within predicted 65-85 MB range)
- **Format**: NSIS, non-silent, Windows x64 only
- **Code signing**: Skipped (not needed for WorkSpaces deployment)
- **No fallback packages needed**: desktop-idle was not required, all primary packages work

### Sync Route Fixes Required

Two server-side fixes were needed during WorkSpace testing (agent code unchanged):

1. **Nullable taskId**: Agent sends `taskId: null` for taskless time entries. The Zod validation schema required changing from `z.string().optional()` to `z.string().nullable().optional()`.
2. **timeEntryId resolution**: Child records (ActivitySnapshot, WindowSample, Screenshot) reference their parent TimeEntry by idempotency key (not DB ID). The sync route was updated to map `timeEntryIdempotencyKey` to actual DB IDs after the TimeEntry upsert.

### Architecture Validation

The blueprint's core architecture decisions were all validated:
- SQLite outbox pattern works reliably for offline resilience
- Presigned URL screenshot upload pattern works correctly with Supabase Storage
- 60-second sync interval is appropriate for data freshness
- Randomized screenshot timing within 10-minute windows works as designed
- Registry Run key auto-launch works on WorkSpaces
- safeStorage (Windows DPAPI) API key caching works correctly

---

**Replacing Hubstaff with a proprietary Electron-based time tracker is feasible as a solo-developer MVP.** The recommended stack—Electron + `screenshot-desktop` + `@miniben90/x-win` + Supabase Auth/Storage/Realtime + Next.js API routes on Vercel—can be built in a single focused sprint with Claude Code. Total memory footprint on a 4GB AWS WorkSpace will land at **100–200 MB**, leaving ample room for VA productivity tools. Costs at 100 VAs are negligible: **under $2/month for screenshot storage** on top of the existing Supabase Pro plan. This report provides the specific packages, schemas, architecture patterns, and deployment strategy needed to one-shot the build.

---

## 1. Core tracking engine: the five pillars

The Electron desktop agent needs five capabilities: screenshot capture, active window tracking, activity detection, idle detection, and system tray integration. Each has a clear recommended package.

### Screenshot capture: `screenshot-desktop` wins on simplicity

Three approaches were evaluated for programmatic screenshot capture on Windows:

| Approach | Capture time (1080p) | Multi-monitor | Native compilation | Reliability |
|----------|---------------------|---------------|-------------------|-------------|
| `screenshot-desktop` v1.15.3 | ~150ms | ✅ Full | None needed | Battle-tested |
| Electron `desktopCapturer` API | ~100-200ms | ✅ Full | N/A (built-in) | Black screenshot bugs on some GPU configs |
| `node-screenshots` (Rust/napi-rs) | ~50ms | ✅ Full | Prebuilt binaries | Low adoption, Electron crash risk |

**Use `screenshot-desktop`** for the MVP. It shells out to a bundled .NET utility on Windows, requires zero native compilation, supports multi-monitor via `listDisplays()`, and produces JPEG/PNG buffers directly. The ~150ms capture time is irrelevant at 10-minute intervals. It avoids `desktopCapturer`'s known black-screenshot bug (Electron issues #19177, #14194) that requires `app.disableHardwareAcceleration()` to fix—undesirable on resource-constrained WorkSpaces.

**Hubstaff's screenshot approach** for reference: 1–3 screenshots per 10-minute interval, captured at **random times** within that window. Screenshots upload directly to Amazon S3 via HTTPS, never through application servers. A desktop notification fires on each capture.

**Randomized interval implementation** is straightforward: at the start of each 10-minute window, generate a random offset between 30 seconds and 9.5 minutes, schedule a `setTimeout` for that offset. This prevents VAs from predicting exact capture moments—the core psychological mechanism behind screenshot-based monitoring.

### Active window tracking: `@miniben90/x-win`

**Use `@miniben90/x-win`** (MIT license, Rust via napi-rs, prebuilt binaries). Its synchronous `activeWindow()` call returns in **under 1 millisecond** on Windows, making it ideal for 3-second polling intervals. It returns app name, window title, process path, PID, window dimensions, and memory usage. UWP/Store apps work correctly.

The deprecated `active-win` (sindresorhus) is now ESM-only and unmaintained. The `@paymoapp/active-window` alternative has useful features but carries a GPL-3.0 license. PowerShell interop works but adds 50–150ms per call due to shell startup. **Avoid `node-ffi-napi`** entirely—it has critical incompatibilities with modern Electron (crashes on async calls, binding load failures).

Poll every **3 seconds** and aggregate time-per-application by tracking the previous app name and accumulating elapsed duration. This creates a clean `active_window_samples` array per sync interval showing app name, window title, and duration.

### Activity detection: built-in `powerMonitor` with `desktop-idle` fallback

**Use Electron's `powerMonitor.getSystemIdleTime()`** as the primary approach. On Windows, it internally calls `GetLastInputInfo`—a single Win32 syscall with effectively **zero CPU overhead**. Poll every 1 second; if idle time is under 1 second, mark that second as "active."

This exactly replicates Hubstaff's activity calculation: **"For every second, we label the user as active or inactive. A mouse movement or keyboard stroke = active. We add all the numbers up and give a total % of activity for that 10-minute segment: active seconds / 600 = activity rate %."** No keylogging, no hook installation, no antivirus warnings.

**Avoid `uiohook-napi`** (the iohook successor)—it installs global keyboard/mouse hooks, triggers antivirus warnings, has known crash issues ("unresolved for several years"), and adds measurable CPU overhead. Avoid the original `iohook` entirely (abandoned, won't compile on modern Electron/Node).

**Fallback: `desktop-idle` v1.3.0** if `powerMonitor.getSystemIdleTime()` returns 0 on the target WorkSpaces (a known bug in older Electron versions, tracked as upstream Chromium issue #30126). Test on the target environment early.

### Idle detection and the idle prompt

Combine `powerMonitor.getSystemIdleTime()` with `powerMonitor.on('lock-screen')` to detect both input-idle and screen-lock states. Poll every 30 seconds; when idle time exceeds the configured threshold (default **5 minutes**, matching Hubstaff), pause the timer and show a dialog with three options: "Keep Time & Continue," "Discard Time & Continue," or "Discard & Stop." This mirrors Hubstaff's idle handling precisely.

### System tray: Electron's built-in `Tray` class

Use a **16×16 and 32×32 ICO file** for the tray icon (PNG files look blurry on Windows). Update the tooltip every second while tracking to show `"TaskName — HH:MM:SS"`. Build a context menu with: current task (disabled label), elapsed time, Start/Stop toggle, Switch Task submenu (dynamically populated), Open Dashboard, and Quit. Intercept the window close event to hide-to-tray instead of quitting (`event.preventDefault()` + `mainWindow.hide()` + `mainWindow.setSkipTaskbar(true)`). Always keep the tray reference in module scope to prevent garbage collection.

---

## 2. Data model and desktop agent UX

### Schema design: mirroring Hubstaff's proven hierarchy

Research across Hubstaff, Toggl, Clockify, and goLance reveals a consistent pattern: **Organization → Project → Task → Time Entry**, with screenshots and activity snapshots as child records of time entries. The critical design decision is whether tasks are required. Hubstaff makes this configurable per-project; Toggl and Clockify default to optional. **For the MVP, make `taskId` nullable on time entries but add a `requireTask` boolean on the Project model** so clients can enforce task selection per-project.

Here is the recommended Prisma schema:

```prisma
model Organization {
  id             String    @id @default(cuid())
  name           String
  timezone       String    @default("UTC")
  screenshotFreq Int       @default(1) // screenshots per 10-min interval
  members        Membership[]
  projects       Project[]
}

model Membership {
  id             String    @id @default(cuid())
  role           UserRole  // ADMIN, MANAGER, VA
  weeklyLimitHrs Float?
  payRate        Float?
  billRate       Float?
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  orgId          String
  organization   Organization @relation(fields: [orgId], references: [id])
  @@unique([userId, orgId])
}

model Project {
  id          String        @id @default(cuid())
  name        String
  status      ProjectStatus @default(ACTIVE)
  requireTask Boolean       @default(false)
  orgId       String
  organization Organization @relation(fields: [orgId], references: [id])
  tasks       Task[]
  timeEntries TimeEntry[]
}

model Task {
  id          String     @id @default(cuid())
  title       String
  status      TaskStatus @default(OPEN)
  sortOrder   Int        @default(0)
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id])
  assigneeId  String?
  timeEntries TimeEntry[]
}

model TimeEntry {
  id          String           @id @default(cuid())
  startedAt   DateTime
  stoppedAt   DateTime?
  durationSec Int?
  status      TimeEntryStatus  @default(RUNNING)
  note        String?
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  projectId   String
  project     Project          @relation(fields: [projectId], references: [id])
  taskId      String?          // nullable = "no task" tracking allowed
  task        Task?            @relation(fields: [taskId], references: [id])
  activitySnaps ActivitySnapshot[]
  screenshots   Screenshot[]
  @@index([userId, startedAt])
}

model ActivitySnapshot {
  id          String    @id @default(cuid())
  timestamp   DateTime
  activityPct Int       // 0-100
  keyboardPct Int?
  mousePct    Int?
  timeEntryId String
  timeEntry   TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)
  userId      String
}

model Screenshot {
  id            String    @id @default(cuid())
  capturedAt    DateTime
  storageUrl    String
  activityPct   Int?
  deletedByUser Boolean   @default(false)
  timeEntryId   String
  timeEntry     TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)
  userId        String
  @@index([userId, capturedAt])
}
```

The **Membership join table** decouples users from organizations, supporting VAs who work for multiple clients with different rates and roles. **ActivitySnapshot** stores per-minute (or per-10-minute) activity readings as separate rows rather than embedding them in time entries, since a single 8-hour session generates hundreds of snapshots.

### Desktop agent UX: compact, Hubstaff-style mini window

Hubstaff's desktop app is a **~300px-wide compact window** with 17 distinct UI elements. For the MVP, implement a simplified version: project list with expandable task lists at the top, a prominent `HH:MM:SS` timer display with the current task name, a play/stop button, and an "Add Note" text field. Play buttons appear next to both project names (for taskless tracking) and individual tasks. Clicking play on a different task automatically stops the current one and starts the new timer—no explicit pause button needed.

When the timer is running, the system tray icon turns green, the tooltip shows elapsed time and task name, and a small activity indicator (green dot for active, yellow for low activity) provides at-a-glance status. Keep the window **always-on-top optional** and default to minimizing to tray on close.

---

## 3. Screenshot storage costs are negligible at MVP scale

### Format and compression: WebP at quality 70–75

Desktop screenshots contain sharp text edges and flat UI colors that JPEG handles poorly at low quality. **WebP achieves 25–34% smaller files than JPEG at equivalent visual quality** (per Google's SSIM studies). At quality 70–75, a 1920×1080 desktop screenshot compresses to **~100–150 KB** with text still fully readable.

Capture at **full native resolution** (don't downscale—text readability is the entire point of screenshot monitoring). Use the `sharp` npm package for compression: `sharp(buffer).webp({ quality: 75 }).toBuffer()`. Sharp processes 1,000+ images per minute using libvips; the overhead of compressing one screenshot every 10 minutes is imperceptible.

### Storage provider: start with Supabase, migrate to R2 at scale

| Provider | Storage $/GB/mo | Egress $/GB | Lifecycle rules | Integration effort |
|----------|----------------|-------------|----------------|--------------------|
| Supabase Storage | $0.021 (100 GB included on Pro) | $0.09 (250 GB included on Pro) | ❌ Needs cron job | Zero (already in stack) |
| Cloudflare R2 | $0.015 | **$0 (free)** | ✅ Native | Medium (new account) |
| AWS S3 | $0.023 | $0.09 (100 GB/mo free) | ✅ Native | Higher (IAM, SDK) |

**Start with Supabase Storage.** It's already in the stack, costs nothing incremental up to 100 GB stored and 250 GB bandwidth on the Pro plan, and supports presigned URL uploads. The only drawback is no native lifecycle rules—implement a cron job (via Vercel Cron or Supabase Edge Functions) to delete screenshots older than 90 days.

### Cost math at scale: surprisingly cheap

At 100 VAs, 1 screenshot per 10 minutes, 8 hours/day, 22 working days/month:

- **105,600 screenshots/month** → **15.5 GB of new storage/month**
- With 90-day retention: **46.5 GB stored** at steady state
- Supabase Pro plan: **$0/month** (within included quotas)
- Cloudflare R2: **~$1.14/month**
- AWS S3: **~$1.73/month**

Even without retention policies, a full year of 100-VA screenshots accumulates only **186 GB**—under $4/month on any provider. **Storage cost is a non-issue for this product.** Migrate to R2 only when approaching Supabase's 250 GB/month bandwidth quota with heavy dashboard viewing.

---

## 4. Backend architecture: serverless is sufficient

### API design: REST batched POST + presigned URL uploads + Supabase Realtime

The agent communicates with three API patterns, all implementable as **Next.js API routes on Vercel** (no separate server needed):

**Activity data sync** uses a REST POST every 60 seconds, sending a batch of activity snapshots, window samples, and time entry updates. At 100 VAs, this generates ~100 requests/minute (**1.67 req/sec**)—trivially low for Vercel's serverless functions. Each payload is ~1–5 KB JSON with an idempotency key to prevent duplicates on retry.

**Screenshot uploads** use the **presigned URL pattern**: the agent requests a signed upload URL from a lightweight API endpoint (~100ms function execution), then uploads the WebP file directly to Supabase Storage, bypassing the 4.5 MB Vercel body limit entirely. This is exactly how Hubstaff operates—screenshots go directly to S3, never through application servers.

**Dashboard real-time updates** use **Supabase Realtime Postgres Changes**. The browser subscribes directly to Supabase (no Vercel function involved) and receives push notifications when rows are inserted into `activity_snapshots` or `time_entries`. Enable with `ALTER PUBLICATION supabase_realtime ADD TABLE activity_snapshots, time_entries;` and subscribe in the Next.js dashboard via the Supabase client. This delivers 1–2 second latency for live VA activity views.

### Authentication: Supabase Auth with auto-generated credentials

The simplest secure flow: when a VA is onboarded in HireValerie, the platform auto-generates email credentials. The VA enters these in the Electron agent, which calls `supabase.auth.signInWithPassword()` to receive a JWT + refresh token. Store the refresh token using **Electron's built-in `safeStorage` API** (uses Windows DPAPI for OS-level encryption—no native module compilation needed). The Supabase client handles token auto-refresh via `startAutoRefresh()`, designed specifically for non-browser environments like Electron.

### Offline resilience: SQLite outbox pattern

Use **`better-sqlite3`** for local caching. All time entries, activity snapshots, and screenshot metadata write to local SQLite first, then enqueue in a `sync_outbox` table with idempotency keys. A sync engine runs every 60 seconds, batching pending items and POSTing them to the API. The server uses `ON CONFLICT (idempotency_key) DO NOTHING` to prevent duplicates from retries. Screenshots are saved to `app.getPath('userData')/screenshots/` when offline and uploaded when connectivity returns. This matches Hubstaff's documented behavior: "data is stored locally and uploads automatically when connection returns."

Implement a **disk space guard**: if local unsynced screenshots exceed 500 MB, reduce capture quality; if they exceed 1 GB, reduce capture frequency. Connectivity detection combines Electron's `online`/`offline` events with a DNS ping fallback (the `online` event is unreliable when WiFi is connected but internet is down).

---

## 5. What open-source projects teach us

Four projects provide directly applicable patterns:

**ActivityWatch** (~16,700 GitHub stars, MPL-2.0) contributes the **heartbeat/pulse pattern**: watchers send events with zero duration, and if the new event matches the previous one within a configurable `pulsetime` window, the last event's duration extends. This elegantly merges continuous same-app usage into single records, reducing storage and simplifying queries. Adopt this for window tracking data aggregation.

**Cattr** (github.com/cattr-app) is the **closest architectural match**: an Electron desktop agent with screenshot capture and activity tracking, backed by a web dashboard. It's the single best reference codebase for combining these features in Electron. Its desktop-application repo demonstrates screenshot capture via `desktopCapturer`, tray integration, and timer state management.

**WakaTime's** open-source CLI demonstrates robust **offline queuing with batch sync** (local BoltDB store, 1000-heartbeat batches, rate-limited to 1 per minute per entity). Its timeout-based session boundary detection—if no heartbeat arrives within N minutes, the session ends—is directly applicable to activity tracking.

**Super Productivity** (MIT, Electron + Angular) provides reference patterns for **electron-builder configuration, idle detection prompts, and local-first data storage**. Its idle-return dialog ("What to do with idle time?") is the UX pattern to replicate.

Patterns to **avoid from these projects**: ActivityWatch's multi-process architecture (separate server + watchers + query language), Super Productivity's Angular/NgRx complexity, Traggo's GraphQL API, and any multi-platform ambitions. For an MVP, keep everything in a single Electron process with a simple React/Vue renderer.

---

## 6. Packaging, deployment, and the WorkSpaces golden image

### electron-builder with NSIS installer

**Use electron-builder** over electron-forge. Despite Electron officially recommending Forge, electron-builder has **10× more weekly npm downloads**, simpler auto-update via `electron-updater`, and a single declarative config file. Produce an NSIS installer targeting **~65–85 MB** (Electron runtime alone is ~136 MB unpacked, but NSIS compresses well).

Minimize package size by excluding unused locales (`"electronLanguages": ["en"]` saves ~30 MB), removing source maps, and bundling with esbuild/webpack for tree-shaking. Real-world optimizations show reductions from 124 MB to 64 MB.

**Skip code signing for the MVP.** You control the AWS WorkSpaces, so SmartScreen warnings don't apply to pre-installed software. Code signing certificates cost $300–700/year with mandatory hardware token storage since May 2023. Azure Trusted Signing offers $9.99/month but is restricted to US/Canadian businesses with 3+ years of tax history. Revisit when distributing beyond managed machines.

### Auto-update via S3

Configure electron-builder's generic provider to point at an S3 bucket containing the installer and `latest.yml` metadata file. The agent checks for updates on launch and periodically. This works fine behind AWS WorkSpaces networking—standard HTTPS on port 443. Total implementation: ~10 lines of code plus build configuration.

### Golden image deployment on AWS WorkSpaces

The deployment workflow: launch a standard WorkSpace, install the Electron app, add a **Registry Run key** (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) for auto-launch at login, create an AWS WorkSpace Image (takes ~45 minutes), then create a Custom Bundle from that image. All future WorkSpaces launched from this bundle will have the tracker pre-installed and auto-starting. For updates, the auto-updater handles it—no need to rebuild the golden image for each release.

### Memory budget on 4GB WorkSpaces

Windows 10/11 consumes ~1.5–2 GB. A well-optimized Electron time tracker with a simple UI targets **100–150 MB**. This leaves **~2 GB** for the VA's actual work applications. Key optimization: minimize DOM complexity, lazy-load modules, don't keep screenshots in renderer memory (compress and write to disk immediately), and use a single BrowserWindow. Avoid multiple windows—use in-app navigation instead.

---

## 7. Privacy done right: the user-initiated model

### User-controlled timer eliminates most legal risk

The VA manually starts and stops the timer. This creates several legal advantages: it provides **implicit ongoing consent** (starting the timer = opting in), establishes clear temporal boundaries between work and personal time, prevents capture of off-duty activity (a major legal exposure under California law per *Arias v. Intermex*), and aligns with GDPR's **data minimization principle**. Hubstaff, Time Doctor, and every reputable monitoring tool uses this model.

**Required even with user-initiated tracking**: a written monitoring disclosure document signed by each VA before installation. It must cover what's tracked (time, periodic screenshots, active application names), what's NOT tracked (keystrokes, webcam, location, off-timer activity), screenshot frequency, who sees the data, retention period, and the VA's right to view and delete their own data. For Connecticut, Delaware, and New York VAs, written notice is legally required regardless of consent mechanism.

### MVP privacy checklist

Build these five features into the MVP: a **green/gray tray icon** distinguishing tracking-active from tracking-off states, a **desktop notification on each screenshot capture** (like Hubstaff), a **VA-facing dashboard** where they can view their own screenshots and time entries, a **screenshot deletion capability** within a 24-hour window for accidental captures of personal content, and **zero data collection when the timer is off**—enforce this with a clear code path that disables all polling, capture, and reporting when `isTracking === false`.

Do not log keystrokes, access the webcam, capture clipboard contents, or run any monitoring silently. These practices build trust, reduce legal risk, and match the industry standard set by Hubstaff's "transparency, access, control" framework.

---

## Conclusion: a buildable, one-shot MVP

The recommended stack for the Valerie Tracker MVP:

- **Desktop agent**: Electron + `screenshot-desktop` + `@miniben90/x-win` + `powerMonitor.getSystemIdleTime()` + `better-sqlite3` for offline cache
- **Backend**: Next.js API routes on existing Vercel deployment + Supabase Auth + Supabase Storage (presigned URL uploads) + Supabase Realtime for dashboard
- **Database**: Existing Prisma/Supabase/Postgres with the schema above (~6 new tables)
- **Distribution**: electron-builder NSIS installer, auto-update via S3, deployed on AWS WorkSpaces golden image
- **Privacy**: User-initiated timer, screenshot notifications, VA self-service viewing/deletion, 90-day retention auto-cleanup

The entire system generates **~2 requests/second at 100 VAs**—well within Vercel's serverless capacity. Screenshot storage costs **under $2/month**. The agent targets **100–150 MB RAM** on a 4GB WorkSpace. No code signing, no separate server infrastructure, no WebSocket complexity.

The critical reference codebases for the Claude Code one-shot are **Cattr's desktop-application** (Electron + screenshots + activity tracking pattern), **ActivityWatch's heartbeat/pulse pattern** (for efficient data aggregation), and **Hubstaff's documented UX** (compact window, randomized screenshots, activity percentage calculation, idle prompts). These three references, combined with the schema, package selections, and architecture patterns detailed in this report, provide everything needed to build a production-grade Hubstaff replacement in a single focused development session.