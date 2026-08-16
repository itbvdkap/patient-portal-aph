# Portal Data Architecture

Ngay cap nhat: 2026-08-16

## Trang thai trien khai

Da lam:

- Da chon huong public app: Vercel + Supabase reporting DB + hospital sync agent.
- Supabase migration nen tang cho on-demand sync.
- `SupabasePatientRepository` doc JSON snapshot tu Supabase, khong query Oracle.
- Login route co mode `PATIENT_DATA_MODE=supabase`: tao auth attempt SĐT + CCCD va cookie da ky HMAC.
- PostgreSQL reporting schema va Docker Compose local van giu de dev/tham khao.
- `ReportingPatientRepository` doc snapshot, khong query Oracle.
- `PatientSyncCoordinator` deduplicate job theo benh nhan/tai nguyen va gioi han 1-5 worker.
- Sync state, sync jobs, TTL va endpoint `GET /api/me/sync-status`, `POST /api/me/sync`.

Can lam tiep:

- Tao Supabase project that va chay migration `supabase/migrations/202608160001_patient_portal_reporting.sql`.
- Tao Vercel project, cau hinh env theo `docs/SUPABASE-VERCEL-SETUP.md`.
- Viet hospital sync agent polling Supabase de xu ly auth attempts va sync jobs.
- Chuyen snapshot JSON sang upsert day du cac bang normalized theo `MAVAOVIEN -> MAQL`.
- Them rate limit/WAF, audit, monitoring va xac thuc bo sung truoc khi public.

## Muc tieu

Portal benh nhan khong truy van truc tiep database HIS chinh trong luong web/app.

Kien truc duoc chon de public:

```text
Benh nhan -> Vercel Next.js -> Supabase Reporting DB
Hospital Sync Agent -> Supabase jobs -> Oracle HIS read-only
```

Nguyen tac:

- Browser va Next.js client khong bao gio ket noi Oracle HIS.
- Vercel server doc Supabase bang service role, browser chi biet anon key.
- Oracle HIS chinh chi duoc doc boi hospital sync agent voi user read-only va gioi han concurrency.
- Du lieu duoc dong bo theo nhu cau benh nhan, khong sync toan vien mac dinh.
- Moi ban ghi portal phai giu khoa HIS goc de doi chieu: `MABN`, `MAVAOVIEN`, `MAQL`, va ID quan ly rieng cua chi dinh/don thuoc/ket qua neu co.

## Mo hinh dinh danh HIS

```text
MABN
+-- MAVAOVIEN
    +-- MAQL
    |   +-- chi dinh
    |   +-- ket qua CLS
    |   +-- don thuoc
    +-- MAQL
    |   +-- chi dinh
    |   +-- ket qua CLS
    |   +-- don thuoc
    +-- MAQL noi tru / dieu tri neu co
        +-- chi dinh
        +-- thuoc
        +-- xu tri
```

Dinh nghia:

- `MABN`: ma benh nhan, dinh danh benh nhan.
- `MAVAOVIEN`: ma dot kham/dot tiep nhan/dot dieu tri.
- `MAQL`: ma quan ly tung loai kham/tung phong/tung phan dieu tri trong mot `MAVAOVIEN`.
- Chi dinh, don thuoc, ket qua co ID quan ly rieng va phai gan nguoc ve `MABN`, `MAVAOVIEN`, `MAQL` neu HIS co du lieu.

## On-demand Sync Theo Benh Nhan

Chi dong bo khi benh nhan co truy cap hoac co hanh dong can du lieu.

Luon dung cache/reporting DB truoc:

```text
1. Benh nhan dang nhap bang SDT + CCCD/CMND.
2. PatientApi xac dinh duoc MABN.
3. PatientApi doc Portal Reporting DB.
4. Neu du lieu thieu/cu:
   - enqueue sync job.
   - tra du lieu da co neu co.
   - tra sync status de UI hien "Dang cap nhat".
5. Sync Worker lay job va doc Oracle HIS chinh.
6. Worker upsert vao Portal Reporting DB.
7. UI polling nhe hoac reload lai module khi sync xong.
```

Khong lam:

```text
Moi request web -> query truc tiep Oracle HIS chinh
```

Vi cach do de gay tai HIS khi nhieu benh nhan truy cap cung luc.

## Neu 100 Benh Nhan Truy Cap Cung Luc

100 benh nhan co the tao 100 sync jobs, nhung worker phai gioi han concurrency.

De xuat:

- `max_worker_concurrency`: 3-5 worker doc HIS cung luc.
- Moi `MABN + resource_name + MAVAOVIEN` chi co 1 job dang chay.
- Neu job dang `running` hoac `queued`, khong tao job trung.
- Neu job bi treo qua `locked_until`, cho phep retry.
- HIS timeout ngan va co retry exponential backoff.

Vi du:

```text
100 request vao dashboard
-> 100 sync jobs vao queue
-> 5 worker xu ly tung dot
-> HIS chinh chi chiu toi da 5 sync query group cung luc
-> App van doc Portal DB va hien trang thai cap nhat
```

## Cach Biet Du Lieu Da Dong Bo Hay Chua

Dung bang `portal_sync_state`.

Khoa logic:

```text
mabn + resource_name + mavaovien + maql
```

`mavaovien` va `maql` co the null voi resource cap benh nhan.

Vi du:

```text
23006552 | patient_profile | null               | null | success | 2026-08-16 10:00
23006552 | encounter_list  | null               | null | success | 2026-08-16 10:00
23006552 | encounter       | 260716130829833187 | null | success | 2026-08-16 10:01
23006552 | care_segments   | 260716130829833187 | null | success | 2026-08-16 10:01
23006552 | prescriptions   | 260716130829833187 | null | success | 2026-08-16 10:02
23006552 | today_visit     | null               | null | running | 2026-08-16 10:03
```

## TTL Theo Loai Du Lieu

De xuat TTL ban dau:

| Resource | Cap sync | TTL |
| --- | --- | --- |
| `patient_profile` | MABN | 24 gio |
| `identity` | MABN | 24 gio |
| `insurance` | MABN | 6-24 gio |
| `encounter_list` | MABN | 5-15 phut |
| `encounter_detail` | MABN + MAVAOVIEN | 10-30 phut |
| `care_segments` | MABN + MAVAOVIEN | 10-30 phut |
| `orders` | MABN + MAVAOVIEN | 5-10 phut |
| `lab_results` | MABN + MAVAOVIEN | 5-10 phut |
| `imaging_results` | MABN + MAVAOVIEN | 5-10 phut |
| `prescriptions` | MABN + MAVAOVIEN | 5-10 phut |
| `appointments` | MABN | 1-5 phut |
| `today_visit` | MABN | 15-60 giay |

Du lieu cu hon co the chi sync khi benh nhan mo chi tiet dot kham.

## Reporting Schema Can Co

Bang loi:

- `portal_patients`
- `portal_patient_identities`
- `portal_insurance_cards`
- `portal_encounters`
- `portal_care_segments`
- `portal_orders`
- `portal_lab_results`
- `portal_imaging_results`
- `portal_prescriptions`
- `portal_prescription_items`
- `portal_appointments`
- `portal_sync_state`
- `portal_sync_jobs`
- `portal_audit_logs`

SQL draft nam tai:

```text
docs/sql/portal_schema_draft.sql
```

## API De Xuat Sau Khi Tach Reporting DB

PatientApi doc tu Portal Reporting DB:

```text
GET  /api/me
GET  /api/me/summary
GET  /api/me/sync-status
POST /api/me/sync

GET  /api/me/encounters
GET  /api/me/encounters/{mavaovien}
GET  /api/me/encounters/{mavaovien}/care-segments
GET  /api/me/encounters/{mavaovien}/orders
GET  /api/me/encounters/{mavaovien}/lab-results
GET  /api/me/encounters/{mavaovien}/imaging-results
GET  /api/me/encounters/{mavaovien}/prescriptions

GET  /api/me/today-visit
GET  /api/me/appointments
```

Auth:

```text
POST /api/auth/verify
```

Trong giai doan chuyen doi, endpoint co the giu ten cu (`visits`) nhung noi bo can map dung:

```text
Visit = Encounter = MAVAOVIEN
CareSegment = MAQL
```

## Lo Trinh Chuyen Doi Code

Giai doan 1:

- Tao Portal Reporting DB/schema.
- Tao bang `portal_sync_state` va `portal_sync_jobs`.
- Tao worker dong bo `patient_profile`, `identity`, `insurance`.
- Doi login verify sang doc reporting DB neu da co, fallback sync tu HIS khi chua co.

Giai doan 2:

- Dong bo `encounter_list` theo `MABN`.
- Doi dashboard/lich su kham doc tu reporting DB.
- Khi benh nhan mo chi tiet dot kham, enqueue sync theo `MABN + MAVAOVIEN`.

Giai doan 3:

- Dong bo `care_segments`, `orders`, `lab_results`, `imaging_results`, `prescriptions`.
- Doi UI chi tiet kham hien theo cay `MAVAOVIEN -> MAQL`.

Giai doan 4:

- Tat truy van truc tiep HIS trong PatientApi request path.
- Chi Sync Worker duoc phep doc HIS.
- Them monitoring, retry, audit log, va dashboard van hanh sync.
