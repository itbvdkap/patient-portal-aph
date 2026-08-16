# Deploy Checklist: patientportal + patient-portal-aph

Ngay cap nhat: 2026-08-16

## Project da tao

- Supabase: `patientportal`
- Vercel: `https://vercel.com/itbvdkaps-projects/patient-portal-aph`
- GitHub: `https://github.com/itbvdkap/patient-portal-aph`

## Viec can lam tren Supabase

1. Mo Supabase project `patientportal`.
2. Vao SQL Editor.
3. Chay file migration:

```text
supabase/migrations/202608160001_patient_portal_reporting.sql
```

4. Vao Project Settings -> API va lay:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Chi copy `anon key` vao bien `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `service_role` chi de trong Vercel env/server/agent, khong dua vao code browser.

## Viec can lam tren Vercel

Vao project `patient-portal-aph` -> Settings -> Environment Variables, them:

```text
NEXT_PUBLIC_DEMO_MODE=false
PATIENT_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
PORTAL_SESSION_SECRET=<chuoi random dai it nhat 32 ky tu>
AUTH_SYNC_ENCRYPTION_KEY=<chuoi random dai it nhat 32 ky tu, dung chung voi sync agent>
SUPABASE_AUTH_WAIT_MS=25000
SUPABASE_AUTH_POLL_INTERVAL_MS=1000
```

Khong set Oracle credential tren Vercel.

## Viec can lam tren may sync agent trong benh vien

Agent doc Oracle va ghi Supabase reporting DB. Cai dat env/config:

```text
ConnectionStrings:PortalReporting=<Supabase Postgres connection string>
ConnectionStrings:OracleHis=<Oracle read-only connection string>
PatientPortal:DataMode=Reporting
PatientPortal:EnableSupabaseQueueAgent=true
PatientPortal:SupabaseQueueConcurrency=3
PatientPortal:AuthSyncEncryptionKey=<giong AUTH_SYNC_ENCRYPTION_KEY tren Vercel>
```

Khuyen nghi ban dau:

- Chay concurrency `3`.
- Test 2-3 benh nhan truoc.
- Theo doi `portal_auth_attempts`, `portal_sync_jobs`, `portal_sync_state`.

## Kiem thu dau tien

1. Deploy preview tren Vercel.
2. Dang nhap bang SĐT + CCCD cua mot benh nhan that.
3. Kiem tra Supabase:
   - `portal_auth_attempts` co job va thanh `success`.
   - `portal_login_lookup` co cache login.
   - `portal_sync_jobs` co job `all`.
   - `portal_resource_snapshots` co cac resource cua MABN.
4. Reload dashboard, kiem tra du lieu hien tu snapshot.

## Neu login timeout

Nguyen nhan thuong gap:

- Sync agent chua chay.
- `AUTH_SYNC_ENCRYPTION_KEY` tren Vercel khac `PatientPortal:AuthSyncEncryptionKey` tren agent.
- Agent khong ket noi duoc Oracle.
- Agent khong ket noi duoc Supabase Postgres.
- Migration chua chay du bang.
