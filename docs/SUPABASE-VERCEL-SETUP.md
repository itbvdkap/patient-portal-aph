# Supabase + Vercel Setup

Ngay cap nhat: 2026-08-16

## Muc tieu

Public patient portal chay tren Vercel, doc du lieu tu Supabase reporting DB. Portal khong truy van Oracle HIS chinh. Benh vien chay sync agent noi bo, agent chi ket noi outbound den Supabase va doc Oracle bang user read-only.

```text
Benh nhan
-> Vercel Next.js
-> Supabase reporting DB
<- Hospital sync agent polling jobs
<- Oracle HIS read-only
```

## Bien moi truong can tao

Vercel Production/Preview/Development:

```text
NEXT_PUBLIC_DEMO_MODE=false
PATIENT_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
PORTAL_SESSION_SECRET=
AUTH_SYNC_ENCRYPTION_KEY=
SUPABASE_AUTH_WAIT_MS=25000
SUPABASE_AUTH_POLL_INTERVAL_MS=1000
```

Quy tac:

- `NEXT_PUBLIC_*` duoc gui xuong browser, chi dung public anon key.
- `SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_SESSION_SECRET`, `AUTH_SYNC_ENCRYPTION_KEY` chi nam o server/Vercel env va sync agent.
- Oracle credential chi nam trong sync agent noi bo benh vien, khong dua len Vercel.

## Migration can chay tren Supabase

File migration:

```text
supabase/migrations/202608160001_patient_portal_reporting.sql
```

Migration tao:

- `portal_auth_attempts`: job xac minh SĐT + CCCD theo on-demand login.
- `portal_login_lookup`: cache ket qua login da xac minh.
- `portal_resource_snapshots`: JSON snapshot cho UI hien tai.
- `portal_sync_jobs`: hang doi sync theo `MABN/resource/resource_id`.
- `portal_sync_state`: trang thai du lieu da sync/chua sync.
- `portal_audit_logs`: audit hanh dong doc du lieu.
- RPC `portal_claim_auth_attempt`, `portal_claim_sync_job`, `portal_complete_sync_job`.
- RPC `portal_enqueue_sync_job` de enqueue atomic va tranh tao nhieu job trung khi user reload.

Tat ca bang bat RLS va revoke quyen `anon/authenticated`. Vercel server va sync agent dung service role de doc/ghi.

## Luong dang nhap on-demand

```text
1. Benh nhan nhap SĐT + CCCD.
2. Vercel tao lookup_hash va kiem tra portal_login_lookup.
3. Neu chua co cache, Vercel tao portal_auth_attempts voi payload da ma hoa.
4. Sync agent trong benh vien polling auth attempts, giai ma, query Oracle, ghi result.
5. Vercel polling ngan 25 giay.
6. Neu thanh cong, Vercel set cookie da ky HMAC va enqueue sync all cho MABN.
```

Neu agent chua chay, login se bao khong xac minh duoc sau timeout. Khi agent chay, request tiep theo se co ket qua.

## Luong doc du lieu

`PATIENT_DATA_MODE=supabase` se dung `SupabasePatientRepository`.

Repository doc `portal_resource_snapshots` theo cache key:

```text
MABN:patient_profile:_
MABN:summary:_
MABN:visits:_
MABN:visit_detail:MAVAOVIEN
MABN:lab_results:_
MABN:lab_results:MAVAOVIEN
MABN:imaging_results:_
MABN:prescriptions:_
MABN:insurance:_
MABN:appointments:_
MABN:today_visit:_
MABN:registrations:_
```

Neu snapshot thieu hoac het han, portal enqueue `portal_sync_jobs` va tra fallback rong de UI van mo duoc. Khi sync agent ghi snapshot xong, reload/poll se hien du lieu moi.

## Sync agent noi bo

Sync agent la `PatientApi` chay trong mang benh vien voi:

```text
PatientPortal:EnableSupabaseQueueAgent=true
PatientPortal:DataMode=OracleDirect
SUPABASE_URL=
SUPABASE_SECRET_KEY=
AUTH_SYNC_ENCRYPTION_KEY=
ConnectionStrings:OracleHis=
```

Agent khong can mo inbound public. Agent chi:

- Poll Supabase REST/RPC qua HTTPS outbound.
- Giai ma auth attempt bang `AUTH_SYNC_ENCRYPTION_KEY`.
- Query Oracle bang user read-only.
- Ghi snapshot ve Supabase `portal_resource_snapshots`.

## Viec can lam tiep

- Dong goi sync agent thanh Windows Service hoac Scheduled Task tren server noi bo.
- Giam log HTTP client cua agent khi chay production.
- Kiem thu login voi 2-3 benh nhan that, sau do moi public domain.
