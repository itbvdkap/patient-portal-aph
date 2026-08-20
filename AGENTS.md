# AGENTS.md

## Project

`patient-portal-aph` is the An Phu patient portal. It includes a public Next.js portal, Supabase reporting/auth integration, and an internal .NET PatientApi for HIS/Oracle data access and sync.

## Current Layout

- `src/app`: Next.js App Router pages and API routes.
- `src/components`: Shared UI components for the portal.
- `src/lib/auth`: OTP, password, session, and demo auth helpers.
- `src/lib/account`: Portal account and linked patient profile flows.
- `src/lib/data`: `PatientRepository` interface plus mock, API, and Supabase implementations.
- `src/lib/supabase`: Supabase clients and patient sync enqueue helpers.
- `src/lib/booking`: Appointment booking logic.
- `src/types`: Shared TypeScript patient domain types.
- `apps/mobile-app`: React Native + Expo mobile app shell. Keep it as a separate workspace and do not let root Next.js build typecheck React Native files.
- `packages/patient-domain`: Shared patient domain types, session schemas, and lightweight format helpers for web/mobile.
- `tests`: Vitest unit tests for auth, session, formatting, and repositories.
- `backend/PatientApi`: Internal .NET API/sync agent for HIS/Oracle and reporting data.
- `supabase`: SQL schema, seed data, and migrations.
- `deploy`: Caddy, Docker compose, and Windows service deployment assets.
- `docs`: Architecture, deployment, and operational notes.

## Development Commands

Use Node.js 20+ and npm 10+.

```bash
npm install
npm run dev
```

Run checks before handing off changes:

```bash
npm run test
npm run build
```

Shared package checks:

```bash
npm --workspace @anphu/patient-domain run typecheck
```

Mobile app local start:

```bash
npm --workspace @anphu/mobile-app run start
```

If npm cache writes are blocked in a sandbox, use a writable cache:

```bash
npm ci --no-audit --no-fund --cache /tmp/npm-cache
./node_modules/.bin/vitest run
npm run build
```

The backend needs the .NET SDK:

```bash
dotnet build backend/PatientApi/PatientApi.csproj
```

Publish the internal Windows sync agent after changing `backend/PatientApi`:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-service\publish-patientapi-agent.ps1
```

The package is written to:

```text
artifacts\patientapi-agent-win-x64.zip
```

On the hospital Windows Server, stop the service before copying files over the existing installation:

```powershell
Stop-Service AnPhuPatientPortalSyncAgent -Force
```

Keep the real `C:\PatientPortalAgent\patientapi-service.env` file. After copying the new files, reinstall/restart and check health:

```powershell
cd C:\PatientPortalAgent
.\install-patientapi-service.ps1
Get-Service AnPhuPatientPortalSyncAgent
Invoke-RestMethod http://127.0.0.1:5080/health
```

To refresh one patient's profile snapshot after an agent change, enqueue a Supabase sync job:

```sql
select portal_enqueue_sync_job(
  p_mabn := '17777777',
  p_resource_name := 'patient_profile',
  p_resource_id := null,
  p_maql := null,
  p_requested_by := 'admin',
  p_requested_reason := 'refresh patient_profile after agent update'
);
```

Then check job/snapshot status:

```sql
select job_id, mabn, resource_name, status, attempt_count, error_message, updated_at
from portal_sync_jobs
where mabn = '17777777' and resource_name = 'patient_profile'
order by job_id desc
limit 5;

select cache_key, mabn, resource_name, synced_at, expires_at, payload_json
from portal_resource_snapshots
where cache_key = '17777777:patient_profile:_';
```

## Environment

Create `.env.local` from `.env.example`. Never commit real secrets.

Important variables:

- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_SESSION_SECRET`
- `PATIENT_DATA_MODE`
- `PATIENT_API_BASE_URL`

Service role keys, database credentials, Oracle credentials, and HIS tokens must stay server-side only.

## Coding Guidelines

- Keep patient data access behind `PatientRepository`; pages and API routes should not talk directly to Oracle/HIS.
- Mobile app must call Next.js API routes (`/api/mobile/*`, `/api/me/*`, `/api/auth/*`) and must not call Oracle/HIS, PatientApi internal URLs, or Supabase service-role APIs directly.
- Shared patient contracts should live in `packages/patient-domain`; keep `src/types/patient.ts` as a compatibility re-export for existing web imports.
- Use Supabase reporting tables for public deployment. Oracle/HIS access belongs in the internal PatientApi/sync agent.
- Keep auth/session changes covered by tests in `tests/auth.test.ts` and `tests/session.test.ts`.
- Keep booking changes covered around `src/lib/booking/appointments.ts` and related API routes.
- Avoid broad refactors while fixing a narrow bug.
- Preserve Vietnamese user-facing text unless intentionally updating copy.
- Do not commit generated build output such as `.next` or `node_modules`.

## Suggested Monorepo Direction

If the repo is split later, prefer a small first step:

```text
apps/portal-web
apps/patient-api
infra/supabase
infra/deploy
docs
```

Only after that is stable, consider extracting shared packages:

```text
packages/patient-domain
packages/portal-auth
packages/portal-data
```

The goal is smaller build/test scopes and less context needed for each coding task, not a large behavior-changing rewrite.
