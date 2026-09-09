Cổng Thông Tin Bệnh Nhân An Phú

Repo: patient-portal-aph

Patient Portal cho bệnh nhân Bệnh viện Đa khoa An Phú tra cứu hồ sơ khám chữa bệnh, lịch hẹn, xét nghiệm, chẩn đoán hình ảnh, đơn thuốc, bảo hiểm y tế và trạng thái khám hôm nay.

Tổng Quan

Dự án gồm 3 phần chính:

Public portal bằng Next.js, chạy trên Vercel hoặc môi trường Node.js.

Supabase reporting/auth layer cho dữ liệu public, tài khoản bệnh nhân, OTP, phiên đăng nhập và hàng đợi đồng bộ.

Internal PatientApi bằng .NET để đọc HIS/Oracle và đồng bộ dữ liệu vào reporting DB.

Đã chuẩn bị thêm nền tảng mobile:

React Native + Expo app trong `apps/mobile-app`, dùng lại Next.js API/session hiện tại.

Shared TypeScript domain package trong `packages/patient-domain`, dùng chung types/schema cho web và mobile.

Luồng triển khai public ưu tiên:

Browser -> Next.js Portal -> Supabase Reporting DB
                         -> Internal Sync Queue
Hospital network -> PatientApi/Sync Agent -> Oracle HIS

Tech Stack

Next.js App Router, React, TypeScript, Tailwind CSS

Supabase PostgreSQL/Auth-ready integration

Lucide React, Zod, React Hook Form, date-fns

Vitest, ESLint, Prettier

.NET PatientApi cho tích hợp HIS/Oracle nội bộ

Cấu Trúc Thư Mục

src/app                 Next.js pages, layouts, API routes
src/components          Shared UI components
src/lib/auth            OTP, password, session, demo auth
src/lib/account         Portal account and linked patient profiles
src/lib/data            PatientRepository implementations
src/lib/supabase        Supabase client and sync enqueue helpers
src/lib/booking         Appointment booking logic
src/types               Patient domain TypeScript types
apps/mobile-app         React Native + Expo patient mobile app
packages/patient-domain Shared patient domain types/session schemas
tests                   Vitest tests
backend/PatientApi      Internal .NET API/sync agent
supabase                SQL schema, seed, migrations
deploy                  Caddy, Docker, Windows service assets
docs                    Architecture and deployment notes

Yêu Cầu Môi Trường

Node.js 20+

npm 10+

.NET SDK nếu build/chạy backend/PatientApi

Cài Đặt

npm install

Nếu chạy trong sandbox bị lỗi cache npm, dùng:

npm ci --no-audit --no-fund --cache /tmp/npm-cache

Chạy Development

npm run dev

Mở http://localhost:3000.

Chạy Mobile App

Sau khi cài workspace dependencies:

npm --workspace @anphu/mobile-app run start

Chạy bản mobile web để test nhanh trên máy dev:

npm --workspace @anphu/mobile-app run web

Metro/Expo thường mở tại:

http://localhost:8081

Mobile app không đọc Oracle/HIS trực tiếp. App gọi Next.js API, dùng session chuẩn qua:

GET /api/mobile/session

Xem thêm:

docs/MOBILE-APP-ARCHITECTURE.md

Demo/Local Login

Phone: 0901234567

Patient code: 23006552

OTP: 123456

Environment Variables

Tạo .env.local từ .env.example.

Các biến thường dùng:

NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PORTAL_SESSION_SECRET=
PATIENT_DATA_MODE=
PATIENT_API_BASE_URL=

Không đưa service role key, database credentials, Oracle credentials hoặc HIS credentials vào browser.

Test Và Build

npm run test
npm run build

Trong sandbox có thể chạy Vitest trực tiếp:

./node_modules/.bin/vitest run

Build backend nếu có .NET SDK:

dotnet build backend/PatientApi/PatientApi.csproj

Đóng Gói PatientApi/Sync Agent

Agent nội bộ chạy trên Windows Server, đọc Oracle HIS và ghi snapshot về Supabase. Khi có thay đổi phần `backend/PatientApi`, cần publish lại agent rồi chép lên server.

Tạo gói zip:

powershell -ExecutionPolicy Bypass -File .\deploy\windows-service\publish-patientapi-agent.ps1

File tạo ra:

artifacts\patientapi-agent-win-x64.zip

Cập nhật trên Windows Server:

1. Stop service đang chạy:

Stop-Service AnPhuPatientPortalSyncAgent -Force

2. Giải nén zip mới và chép đè vào:

C:\PatientPortalAgent

Giữ lại file cấu hình thật:

C:\PatientPortalAgent\patientapi-service.env

3. Cài/reinstall service nếu cần:

cd C:\PatientPortalAgent
.\install-patientapi-service.ps1

4. Kiểm tra:

Get-Service AnPhuPatientPortalSyncAgent
Invoke-RestMethod http://127.0.0.1:5080/health

Booking HIS Auto-Match

Agent có worker `BookingHisMatchWorker` để đối soát đăng ký online với lượt `TIEPDON` trong HIS. Worker đọc các lịch hẹn chưa match trong Supabase booking DB, ưu tiên giải mã CCCD/CMND để tìm `MABN`, sau đó match lượt HIS đúng `ngay_kham`. Phòng/khoa, STT và MAQL chỉ là tín hiệu bổ sung để tăng độ tin cậy. Khi match thành công, worker cập nhật `portal.lich_hen_kham`, ghi `portal.booking_his_matches`, rồi tạo bản ghi `portal.notification_outbox`.

Nguyên tắc match hiện tại:

- Nếu booking có CCCD/CMND mã hóa, worker dùng `BOOKING_ENCRYPTION_KEY` để giải mã và tra Oracle qua `BTDBN.CMND`, `BTDBN.CMND_BN`, `DIENTHOAI.CMND`.
- Nếu CCCD tìm được MABN, MABN này được ưu tiên hơn `old_patient_code`/`patient_code`.
- Nếu booking có `ngay_kham`, chỉ xét các lượt `TIEPDON` đúng ngày khám để tránh ghép nhầm lượt cũ/mới.
- Điểm match ưu tiên CCCD/CMND + ngày khám; phòng/khoa chỉ là tín hiệu phụ.

Agent cũng có `NotificationOutboxWorker` để đọc `portal.notification_outbox`, gửi Zalo ZNS, cập nhật `sent/retry/failed` và ghi `zalo_confirm_sent_at` vào lịch hẹn khi gửi thành công. Trong lúc template Zalo đang chờ duyệt, nên để `booking.zalo_auto_send_enabled=false`: hệ thống vẫn match HIS và tạo outbox, admin kiểm tra rồi bấm gửi thủ công từng phiếu trong `/admin/bookings`.

Trong `C:\PatientPortalAgent\patientapi-service.env` cần có:

```text
PatientPortal__EnableBookingHisMatchWorker=true
PatientPortal__BookingHisMatchIntervalSeconds=60
PatientPortal__BookingHisMatchBatchSize=25
PatientPortal__BookingHisMatchRetryMinutes=5
PatientPortal__EnableNotificationOutboxWorker=true
PatientPortal__NotificationOutboxAutoSendEnabled=false
PatientPortal__NotificationOutboxIntervalSeconds=30
PatientPortal__NotificationOutboxBatchSize=20
PatientPortal__NotificationOutboxRetryMinutes=5
ConnectionStrings__BookingDatabase=...
BOOKING_ENCRYPTION_KEY=...
ZALO_ZNS_ENDPOINT=https://business.openapi.zalo.me/message/template
ZALO_TOKEN_ENDPOINT=https://oauth.zaloapp.com/v4/oa/access_token
ZALO_APP_ID=...
ZALO_SECRET_KEY=...
ZALO_ACCESS_TOKEN=...
ZALO_REFRESH_TOKEN=...
ZALO_BOOKING_CONFIRMED_TEMPLATE_ID=...
```

Kiểm tra lịch đã match:

```sql
select id, ma_lich_hen, old_patient_code, status, his_match_status,
       his_mabn, his_maql, his_stt_kham, his_department_name,
       his_match_confidence, his_match_reason, his_matched_at
from portal.lich_hen_kham
order by his_match_checked_at desc nulls last, ngay_kham desc
limit 20;
```

Kiểm tra tin Zalo chờ gửi:

```sql
select id, channel, recipient_phone, template_key, appointment_id,
       status, attempt_count, run_after, last_error, sent_at, payload_json
from portal.notification_outbox
order by created_at desc
limit 20;
```

Sync Lại patient_profile

Sau khi cập nhật agent có thêm field mới, ví dụ CCCD/CMND, cần enqueue sync lại `patient_profile` cho bệnh nhân cần test.

Trong Supabase SQL Editor chạy:

select portal_enqueue_sync_job(
  p_mabn := '17777777',
  p_resource_name := 'patient_profile',
  p_resource_id := null,
  p_maql := null,
  p_requested_by := 'admin',
  p_requested_reason := 'refresh patient_profile after agent update'
);

Theo dõi job:

select job_id, mabn, resource_name, status, attempt_count, error_message, updated_at
from portal_sync_jobs
where mabn = '17777777' and resource_name = 'patient_profile'
order by job_id desc
limit 5;

Kiểm tra snapshot:

select cache_key, mabn, resource_name, synced_at, expires_at, payload_json
from portal_resource_snapshots
where cache_key = '17777777:patient_profile:_';

Nếu job còn `queued`, kiểm tra service agent đang chạy. Nếu job `failed`, xem `error_message` và Windows Event Log của service.

Supabase Setup

Public deployment dùng Supabase project/reporting DB và on-demand sync theo bệnh nhân. Migration nằm trong:

supabase/migrations

Các tài liệu liên quan:

docs/SUPABASE-VERCEL-SETUP.md

docs/DEPLOY-PATIENTPORTAL-CHECKLIST.md

docs/PORTAL-DATA-ARCHITECTURE.md

API Nội Bộ Của Portal

Các endpoint dùng session hiện tại:

GET /api/me

GET /api/me/summary

GET /api/me/visits

GET /api/me/visits/{id}

GET /api/me/lab-results

GET /api/me/imaging

GET /api/me/prescriptions

GET /api/me/insurance

GET /api/me/appointments

GET /api/me/registrations

GET /api/me/today-visit

`GET /api/me/today-visit` hiện trả thêm `queueStatus` nếu HIS có đủ `MAKP` và `STT_KHAM`. UI dùng trường này để hiển thị phòng đang xử lý tới STT nào, còn bao nhiêu lượt trước bệnh nhân, và thời gian ước tính. Ước tính hiện dựa trên dữ liệu `TIEPDON.DONE/STT_KHAM` cùng phòng trong ngày; nếu số xử lý đã vượt STT của bệnh nhân, UI cảnh báo người bệnh liên hệ quầy/phòng khám.

Mobile app có màn `Thông báo` gồm 2 tab: `Khám hôm nay` để xem STT/hàng đợi trong ngày, và `Thông báo` để tổng hợp nhanh các việc cần chú ý từ API hiện có như lịch hẹn sắp tới, BHYT sắp hết hạn, xét nghiệm bất thường và kết quả CĐHA mới. Đây là notification center trong app; push notification/read-unread sẽ cần bảng notification riêng ở sprint sau.

Màn mobile `Tài khoản` đã được mở rộng gần với web `/profile`: sửa tên hiển thị, xem chi tiết hồ sơ đang xem, đổi mật khẩu, cài đặt nhận thông báo trên thiết bị, passcode placeholder, thiết bị đăng nhập và nhóm thông tin pháp lý.

Auth/account/booking endpoints nằm dưới:

/api/auth/*

/api/account/*

/api/booking/*

Deploy Vercel

Push source lên Git repository.

Import project vào Vercel.

Cấu hình environment variables theo .env.production.example.

Deploy bằng preset Next.js mặc định.

Tích Hợp Oracle/HIS

UI không đọc trực tiếp Oracle/HIS. Portal chỉ gọi PatientRepository trong src/lib/data.

Public app nên dùng SupabasePatientRepository khi bật PATIENT_DATA_MODE=supabase. Internal agent/API trong backend/PatientApi chịu trách nhiệm đọc HIS/Oracle bằng user read-only và đồng bộ vào Supabase/reporting DB.

Xem thêm:

docs/ORACLE-INTEGRATION.md

docs/PORTAL-DATA-ARCHITECTURE.md

backend/PatientApi/README.md

Hướng Monorepo Sau Này

Nếu cần tách repo để giảm phạm vi code/build và tiết kiệm context khi phát triển, nên làm từng bước:

apps/portal-web
apps/patient-api
infra/supabase
infra/deploy
docs

Sau khi ổn định mới cân nhắc tách tiếp:

packages/patient-domain
packages/portal-auth
packages/portal-data

Hiện tại `packages/patient-domain` đã được tạo trước để web/mobile dùng chung types và session schema. Root Next app vẫn giữ nguyên vị trí để tránh ảnh hưởng Vercel production hiện tại.

Mục tiêu là chia ranh giới rõ hơn, chạy test/build theo từng phần, và giảm lượng code phải đọc khi sửa một tính năng cụ thể.
