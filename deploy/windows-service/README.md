# PatientApi Windows Service

Use this package for the internal hospital sync agent. The public portal stays on Vercel; this service only polls Supabase jobs, reads Oracle HIS, and writes snapshots back to Supabase.

## Build package on dev machine

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-service\publish-patientapi-agent.ps1
```

Output:

```text
artifacts\patientapi-agent-win-x64
artifacts\patientapi-agent-win-x64.zip
```

## Check Windows Server 2012 environment

Copy the package to the server, then run PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\check-windows2012-env.ps1 -SupabaseUrl "https://your-project.supabase.co" -OracleHost "192.168.2.250" -OraclePort 1521
```

If TLS 1.2 is not enabled on Windows Server 2012, run as Administrator and restart Windows:

```powershell
.\enable-tls12-windows2012.ps1
Restart-Computer
```

## Configure service

Copy:

```text
patientapi-service.env.example -> patientapi-service.env
```

Fill these values:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
AUTH_SYNC_ENCRYPTION_KEY=
ConnectionStrings__OracleHis=
ConnectionStrings__BookingDatabase=
BOOKING_ENCRYPTION_KEY=
```

`AUTH_SYNC_ENCRYPTION_KEY` must match the Vercel environment variable with the same name.
`BOOKING_ENCRYPTION_KEY` must match the key used by the public portal to encrypt `soCCCD_encrypt` in `portal.lich_hen_kham`; otherwise booking HIS auto-match cannot prioritize CCCD/CMND.

## Booking HIS auto-match

When `PatientPortal__EnableBookingHisMatchWorker=true`, the service polls pending rows in `portal.lich_hen_kham`, resolves MABN by CCCD/CMND when possible, then matches only `TIEPDON` rows on the requested `ngay_kham`. Department, ticket number and MAQL are secondary confidence signals.

## Booking HIS online sync

When `PatientPortal__EnableBookingHisOnlineSyncWorker=true`, the service polls new online appointments in `portal.lich_hen_kham` and inserts/updates `HGSOFT_SOYBA.DANGKYKHAM`. Those rows are what the HIS form "Danh sách đặt khám online" reads, so new portal bookings can appear in HIS before staff create the `TIEPDON` visit.

Run the Oracle setup script before enabling this worker:

```powershell
sqlplus <oracle_user>/<oracle_password>@<host>:<port>/<service> @..\oracle\hgsoft_soyba_dangkykham_online.sql
```

Required database setup:

```text
ConnectionStrings__BookingDatabase=<Postgres/Supabase booking database>
ConnectionStrings__OracleHis=<Oracle user with read HIS danh muc and write HGSOFT_SOYBA.DANGKYKHAM>
PatientPortal__BranchCode=CN1
PatientPortal__EnableBookingHisOnlineSyncWorker=true
```

Optional defaults help when free-text province/ward/department values from the portal cannot be matched to HIS master data:

```text
PatientPortal__HisOnlineDefaultProvinceCode=
PatientPortal__HisOnlineDefaultWardCode=
PatientPortal__HisOnlineDefaultOccupationCode=00000
PatientPortal__HisOnlineDefaultEthnicityCode=25
PatientPortal__HisOnlineDefaultDepartmentCode=
PatientPortal__HisOnlineDefaultDoctorCode=
PatientPortal__HisOnlineLegacySchemas=HGSOFT_BV,HGSOFT
PatientPortal__HisOnlineLegacyServiceCodes=
```

## Triển khai hai chi nhánh dùng hai HIS server

Mỗi HIS server cài một bộ PatientApi/Sync Agent riêng nhưng dùng chung Supabase. Bắt buộc đặt mã chi nhánh trong `patientapi-service.env`:

```text
# Server tại CN1
PatientPortal__BranchCode=CN1
PatientPortal__BranchName=Bệnh viện An Phú - Chi nhánh 1
ConnectionStrings__OracleHis=<Oracle CN1>

# Server tại CN3
PatientPortal__BranchCode=CN3
PatientPortal__BranchName=Phòng khám An Phú - Chi nhánh 3
ConnectionStrings__OracleHis=<Oracle CN3>
```

Booking HIS worker và notification worker chỉ nhận hàng đợi có `branch_code` trùng cấu hình. Nếu thiếu hoặc nhập mã khác `CN1`/`CN3`, worker dừng để tránh đọc nhầm dữ liệu chi nhánh.

After a successful match, the service writes HIS fields back to `portal.lich_hen_kham`, updates `portal.booking_his_matches`, and queues a Zalo notification in `portal.notification_outbox`.

## Install

Run as Administrator inside the published folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-patientapi-service.ps1
```

Check:

```powershell
Get-Service AnPhuPatientPortalSyncAgent
Invoke-RestMethod http://127.0.0.1:5080/health
Get-EventLog -LogName Application -Newest 50 | Where-Object { $_.Source -like "*Patient*" -or $_.Message -like "*Supabase*" }
```

The installer configures recovery actions: Windows retries after 5 seconds, 15 seconds, then 60 seconds if the process exits unexpectedly. Inspect the recovery policy and the most recent stop reason with:

```powershell
sc.exe qfailure AnPhuPatientPortalSyncAgent
Get-Service AnPhuPatientPortalSyncAgent | Format-List Name,Status,StartType,ServiceType
sc.exe queryex AnPhuPatientPortalSyncAgent
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Service Control Manager'; StartTime=(Get-Date).AddHours(-6)} |
  Where-Object { $_.Message -match 'AnPhuPatientPortalSyncAgent' } |
  Select-Object TimeCreated,Id,LevelDisplayName,Message | Format-List
Get-Content C:\PatientPortalAgent\logs\patientapi.err.log -Tail 100 -ErrorAction SilentlyContinue
Get-Content C:\PatientPortalAgent\logs\patientapi.out.log -Tail 100 -ErrorAction SilentlyContinue
```

## Uninstall

```powershell
.\uninstall-patientapi-service.ps1
```
