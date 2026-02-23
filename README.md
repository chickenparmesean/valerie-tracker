# Valerie Tracker

A Hubstaff-replacement time tracker for virtual assistants. Two apps: Electron desktop agent + Next.js web dashboard, backed by Supabase.

## Architecture

- **agent/** - Electron desktop app (Windows) with time tracking, screenshots, activity monitoring
- **web/** - Next.js 15 dashboard with API routes
- **shared/** - Shared TypeScript types between agent and web
- **prisma/** - Database schema

## Prerequisites

- Node.js 20+
- npm 10+
- Windows (for agent development)
- Supabase project with Auth, Storage, and Postgres enabled

## Setup

1. Clone and install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_url
```

3. Push the database schema:
```bash
npx prisma db push --schema=prisma/schema.prisma
```

4. Create a "screenshots" storage bucket in Supabase dashboard (set to private).

## Development

### Web Dashboard
```bash
cd web
npm run dev
```
Open http://localhost:3000

### Electron Agent
```bash
cd agent
npm run dev
```

## Building the Agent Installer

```bash
cd agent
npm run build:agent
```

The installer will be in `agent/dist/`.

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create user + membership (admin) |
| POST | /api/sync | Receive batched activity data |
| POST | /api/screenshots/presign | Get presigned upload URL |
| GET | /api/projects | List projects with tasks |
| POST | /api/projects | Create project |
| POST | /api/projects/[id]/tasks | Create task |
| PATCH | /api/tasks/[id] | Update task |
| GET | /api/time-entries | Query time entries |
| GET | /api/activity | Query activity snapshots |
| GET | /api/screenshots | Query screenshot metadata |
| DELETE | /api/screenshots/[id] | Soft-delete screenshot (VA, 24h window) |
| GET | /api/dashboard/live | Live VA status for dashboard |

All routes require JWT Bearer token in Authorization header.
