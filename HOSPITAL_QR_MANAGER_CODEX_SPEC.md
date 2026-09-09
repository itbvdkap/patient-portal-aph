# YÊU CẦU CODEX — TÍCH HỢP HỆ THỐNG QUẢN LÝ & KIỂM SOÁT QR CODE BỆNH VIỆN

## 0. Mục tiêu

Tích hợp module **Hospital QR Manager** vào hệ thống app/web bệnh nhân hiện có, ưu tiên tích hợp vào **Web Admin hiện tại**, không dựng một hệ thống độc lập và không tạo hệ thống đăng nhập mới.

Mục tiêu:
- Quản lý tập trung toàn bộ QR Code của bệnh viện.
- Có quy trình tạo → gửi duyệt → phê duyệt → phát hành → rà soát → vô hiệu hóa.
- Phân quyền theo tài khoản/admin hiện có.
- Ghi nhật ký đầy đủ.
- Chống sửa URL đích sau khi QR đã được phê duyệt.
- Phát hiện QR giả, QR ngoài hệ thống, QR bị thay đổi hoặc QR dẫn tới domain không được phép.
- Có trang kiểm tra QR bằng camera hoặc nhập/quét mã.
- QR dùng URL trung gian ổn định của bệnh viện, không nhúng trực tiếp URL đích vào mã theo kiểu có thể thay đổi tùy ý.
- Giao diện phù hợp với hệ thống bệnh viện hiện tại, responsive desktop/tablet/mobile.

---

# 1. BỐI CẢNH CODEBASE HIỆN TẠI

Hệ thống hiện có:

## Web
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Lucide
- Patient Portal
- Có khu vực Admin hiện tại

## Mobile
- React Native
- Expo SDK 54
- Expo Router
- apps/mobile-app

## Backend
- Next.js API Routes cho public-facing APIs
- ASP.NET Core .NET PatientApi
- Sync Agent

## Database
- Supabase PostgreSQL:
  - accounts
  - session
  - OTP
  - reporting
  - sync queue
- Oracle HIS:
  - nguồn dữ liệu bệnh viện
  - chỉ truy cập từ mạng nội bộ

## NGUYÊN TẮC TÍCH HỢP

1. Không tạo hệ thống authentication mới.
2. Không tạo một Admin Portal riêng nếu đã có Admin Portal.
3. Tận dụng user/session/role/permission hiện có.
4. Tận dụng layout, sidebar, header, modal, toast, table, form và design system hiện tại.
5. Không thay đổi các chức năng bệnh nhân đang chạy.
6. Không để dữ liệu QR ảnh hưởng đến dữ liệu HIS/Oracle.
7. QR Manager chủ yếu lưu metadata/quản trị trên Supabase.
8. Không lưu thông tin sức khỏe nhạy cảm trong QR Code.
9. Không đưa Oracle connection ra public web.
10. Không dùng dịch vụ/web tạo QR miễn phí bên ngoài.

---

# 2. MENU ADMIN MỚI

Thêm vào sidebar Admin:

## QUẢN LÝ QR CODE

### 2.1 Tổng quan QR
Route đề xuất:
`/admin/qr`

### 2.2 Danh sách QR
Route:
`/admin/qr/list`

### 2.3 Tạo QR
Route:
`/admin/qr/new`

### 2.4 Chờ duyệt
Route:
`/admin/qr/review`

### 2.5 Rà soát / kiểm tra QR
Route:
`/admin/qr/audit`

### 2.6 Nhật ký
Route:
`/admin/qr/logs`

### 2.7 Cấu hình QR
Route:
`/admin/qr/settings`

Chỉ hiển thị menu và chức năng theo permission của tài khoản hiện tại.

---

# 3. DASHBOARD QUẢN LÝ QR

Trang `/admin/qr`

Thiết kế dashboard sạch, chuyên nghiệp, phù hợp phần mềm bệnh viện.

## KPI Cards

- Tổng số QR
- Đang hoạt động
- Chờ duyệt
- Sắp hết hạn
- Bị vô hiệu hóa
- QR có cảnh báo
- Lượt quét hôm nay
- QR chưa rà soát

## Biểu đồ

- Số QR theo trạng thái
- Lượt quét theo ngày
- QR theo khoa/phòng/bộ phận
- Kết quả rà soát QR

## Quick Actions

[ + Tạo QR mới ]

[ Duyệt QR ]

[ Rà soát QR ]

[ Xem nhật ký ]

---

# 4. TRẠNG THÁI QR

Dùng state machine rõ ràng:

`DRAFT`
→ `PENDING_REVIEW`
→ `APPROVED`
→ `ACTIVE`

Có thể:

`PENDING_REVIEW` → `REJECTED`

`APPROVED/ACTIVE` → `DISABLED`

`ACTIVE` → `EXPIRED`

Không cho phép:

`APPROVED/ACTIVE` → sửa trực tiếp URL đích.

Nếu muốn thay đổi URL:
- tạo QR/version mới;
- QR cũ vẫn giữ lịch sử;
- có thể disable QR cũ;
- không overwrite lịch sử.

---

# 5. PHÂN QUYỀN

Không tạo bảng user/role mới nếu hệ thống đã có RBAC.

Ánh xạ vào RBAC hiện tại.

Permission đề xuất:

- `qr.view`
- `qr.create`
- `qr.edit`
- `qr.submit`
- `qr.review`
- `qr.approve`
- `qr.reject`
- `qr.disable`
- `qr.audit`
- `qr.logs`
- `qr.settings`

Role logic đề xuất:

## VIEWER
- xem QR
- xem trạng thái

## OPERATOR
- tạo QR
- sửa QR ở DRAFT
- gửi duyệt

## APPROVER
- xem QR chờ duyệt
- approve
- reject
- disable nếu được cấp quyền

## AUDITOR
- rà soát QR
- xem log
- xem lịch sử

## ADMIN
- toàn quyền

Nếu hệ thống hiện tại dùng tên role khác, Codex phải map vào role/permission hiện có, KHÔNG tạo RBAC song song.

---

# 6. FORM TẠO QR

Route `/admin/qr/new`

Các trường:

### Thông tin QR

- Tên QR *
- Mã QR hệ thống — tự sinh
- Mô tả
- Mục đích sử dụng *
- Loại QR *
- Khoa/phòng/bộ phận *
- Vị trí đặt QR
- Người phụ trách
- Ngày bắt đầu
- Ngày hết hạn
- Ghi chú

### URL đích

- Destination URL *

Chỉ cho phép HTTPS.

Ví dụ:

`https://patient.benhvien.vn/dang-ky-kham`

hoặc route nội bộ đã được whitelist.

## Không cho phép

- javascript:
- data:
- file:
- http nếu production policy không cho phép
- URL chứa credential/token/secret
- domain ngoài whitelist nếu policy yêu cầu whitelist

## Preview

Bên phải form:

- QR Code preview
- mã QR
- URL trung gian
- trạng thái
- thông tin khoa/phòng

Nút:

`Lưu nháp`

`Gửi duyệt`

---

# 7. CƠ CHẾ QR URL

KHÔNG tạo QR chứa destination URL trực tiếp.

QR phải chứa URL trung gian ổn định:

`https://<DOMAIN-BENH-VIEN>/q/<PUBLIC_CODE>`

Ví dụ:

`https://patient.benhvien.vn/q/BVAP-7F4K9X`

Khi người dùng quét:

`GET /q/BVAP-7F4K9X`

Server:

1. tìm QR theo public_code;
2. kiểm tra trạng thái;
3. kiểm tra hiệu lực;
4. kiểm tra QR có bị disable không;
5. ghi scan log;
6. lấy destination_url từ database;
7. redirect tới destination_url.

Tuyệt đối không nhận destination URL từ query string để redirect.

Ví dụ KHÔNG được làm:

`/q/ABC?url=https://...`

Điều này nhằm chống open redirect.

---

# 8. CHỐNG ĐỔI LINK SAU KHI DUYỆT

Đây là yêu cầu bắt buộc.

Khi QR ở `DRAFT`:
- có thể sửa URL.

Khi `PENDING_REVIEW`:
- không cho sửa URL.

Khi `APPROVED/ACTIVE`:
- không cho sửa:
  - public_code
  - destination_url
  - destination_hash
  - QR identity

Nếu cần đổi URL:
1. clone/tạo QR mới;
2. URL mới được kiểm tra;
3. gửi duyệt lại;
4. approve;
5. disable QR cũ nếu cần.

## Database protection

Không chỉ khóa ở UI.

Phải khóa ở API/server/database.

Nếu sử dụng PostgreSQL trigger/RLS:
- approved/active record không được update destination_url;
- không được update destination_hash;
- không được đổi public_code.

UI chỉ là lớp bảo vệ thứ nhất.
Server/database phải là lớp bảo vệ cuối cùng.

---

# 9. HASH URL

Khi tạo/approve QR:

`destination_hash = SHA-256(normalized_destination_url)`

Lưu hash vào database.

Khi rà soát:
- lấy URL hiện tại;
- normalize;
- SHA-256;
- so với destination_hash.

Nếu khác:

`TAMPERED / URL MISMATCH`

Không tự động sửa hash.

---

# 10. TRANG RÀ SOÁT QR

Route:

`/admin/qr/audit`

Giao diện:

# Rà soát mã QR

Có 3 phương thức:

### A. Quét camera

Nút:

`[ Quét QR bằng camera ]`

Sau khi quét:
- đọc URL;
- kiểm tra URL có phải QR của bệnh viện;
- lấy public_code;
- gọi API verify.

### B. Nhập mã

Ô:

`Nhập mã QR...`

Nút:

`Kiểm tra`

### C. Dán URL

Ô:

`https://...`

Nút:

`Kiểm tra`

---

# 11. KẾT QUẢ RÀ SOÁT

## QR HỢP LỆ

Hiển thị:

🟢 QR HỢP LỆ

- Tên QR
- Mã QR
- Khoa/phòng
- Mục đích
- Trạng thái
- Ngày phê duyệt
- Người phê duyệt
- URL đích
- Hash
- Lần rà soát gần nhất

## QR KHÔNG THUỘC HỆ THỐNG

🔴 QR KHÔNG THUỘC HỆ THỐNG BỆNH VIỆN

## QR ĐÃ VÔ HIỆU HÓA

🔴 QR ĐÃ BỊ VÔ HIỆU HÓA

## QR HẾT HẠN

🟠 QR ĐÃ HẾT HẠN

## URL BỊ THAY ĐỔI

🔴 PHÁT HIỆN URL KHÔNG KHỚP

## DOMAIN KHÔNG ĐƯỢC PHÉP

🟠 DOMAIN KHÔNG NẰM TRONG DANH SÁCH ĐƯỢC PHÉP

---

# 12. RÀ SOÁT TỰ ĐỘNG

Tạo job/service để kiểm tra QR định kỳ.

Kiểm tra:

- QR còn tồn tại không
- status
- expiry
- destination URL
- HTTPS
- domain whitelist
- destination_hash
- HTTP response
- redirect chain
- final URL
- final domain
- SSL/TLS cơ bản
- QR có redirect sang domain lạ không

Không follow redirect vô hạn.

Giới hạn redirect chain.

Nếu redirect cuối cùng khác policy:
→ cảnh báo.

---

# 13. WHITELIST DOMAIN

Trang:

`/admin/qr/settings`

Ví dụ:

- `patient.benhvien.vn`
- `www.benhvien.vn`
- `portal.benhvien.vn`

Chỉ ADMIN được quản lý whitelist.

Khi tạo QR:
- URL ngoài whitelist → cảnh báo hoặc từ chối theo policy.

Không hard-code domain trong nhiều file.
Đưa vào cấu hình/database.

---

# 14. TRANG CHỜ DUYỆT

Route:

`/admin/qr/review`

Table:

| QR | Khoa/phòng | Người tạo | Ngày tạo | URL | Trạng thái |
|---|---|---|---|---|---|

Click vào QR:

Hiển thị màn hình review:

## Thông tin QR

- QR name
- code
- loại
- mục đích
- vị trí
- khoa/phòng
- người tạo
- thời gian tạo
- destination URL
- normalized URL
- destination hash
- QR preview

## Security Check

- HTTPS: PASS
- Domain: PASS
- URL format: PASS
- Redirect: PASS
- Hash: PASS

Buttons:

`TỪ CHỐI`

`PHÊ DUYỆT`

Người tạo không được tự phê duyệt QR của mình.

---

# 15. NHẬT KÝ AUDIT

Route:

`/admin/qr/logs`

Ghi log cho:

- CREATE
- UPDATE
- SUBMIT
- APPROVE
- REJECT
- DISABLE
- EXPIRE
- AUDIT
- SCAN
- VERIFY
- SECURITY_WARNING

Mỗi log:

- timestamp
- user_id
- action
- qr_id
- public_code
- old_value nếu cần
- new_value nếu cần
- IP nếu hệ thống cho phép
- user agent nếu hệ thống cho phép
- result
- reason

Không ghi token/password/secret vào log.

Audit log không được sửa/xóa bởi user thông thường.

---

# 16. SCAN LOG

Bảng riêng cho lượt quét:

- qr_id
- scanned_at
- source
- user_agent
- IP đã được xử lý theo policy privacy
- result
- destination
- security_status

Không lưu thông tin bệnh nhân trong scan log trừ khi có yêu cầu nghiệp vụ rõ ràng.

---

# 17. DATABASE

Tạo migration Supabase/PostgreSQL.

Bảng chính đề xuất:

## hospital_qr_codes

Các field:

- id UUID PK
- public_code VARCHAR UNIQUE NOT NULL
- name
- description
- qr_type
- purpose
- department_id hoặc department_name tùy schema hiện có
- location
- owner_user_id
- destination_url
- normalized_destination_url
- destination_hash
- status
- start_at
- expires_at
- created_by
- submitted_by
- approved_by
- approved_at
- rejected_by
- rejected_at
- rejection_reason
- disabled_by
- disabled_at
- disabled_reason
- last_audited_at
- last_audit_status
- created_at
- updated_at

Không tự ý tạo department table mới nếu hệ thống đã có bảng khoa/phòng.

---

# 18. QR AUDIT TABLE

`hospital_qr_audits`

Field:

- id
- qr_id
- audited_by
- audit_type
- scanned_value
- destination_url_detected
- final_url_detected
- domain
- hash_match
- https_ok
- whitelist_ok
- redirect_ok
- result
- warning
- details JSONB
- created_at

---

# 19. AUDIT LOG TABLE

`hospital_qr_audit_logs`

Field:

- id
- qr_id
- actor_user_id
- action
- before_data JSONB
- after_data JSONB
- reason
- ip
- user_agent
- created_at

---

# 20. RLS / SECURITY

Supabase RLS phải được bật.

Nguyên tắc:

- VIEWER chỉ SELECT.
- OPERATOR được INSERT và UPDATE DRAFT của mình.
- APPROVER được review/approve/reject theo permission.
- AUDITOR được audit và xem log.
- ADMIN toàn quyền.
- Không user nào được tự bypass permission bằng cách gọi API trực tiếp.

Các thao tác nhạy cảm:
- approve
- disable
- change whitelist
- change security policy

phải thực hiện server-side.

---

# 21. API

Tận dụng Next.js API architecture hiện tại.

Các endpoint đề xuất:

`GET /api/admin/qr`

`POST /api/admin/qr`

`GET /api/admin/qr/:id`

`PATCH /api/admin/qr/:id`

`POST /api/admin/qr/:id/submit`

`POST /api/admin/qr/:id/approve`

`POST /api/admin/qr/:id/reject`

`POST /api/admin/qr/:id/disable`

`POST /api/admin/qr/:id/audit`

`GET /api/admin/qr/:id/logs`

`POST /api/admin/qr/verify`

`GET /q/:public_code`

Không tạo endpoint cho phép:

`PATCH /api/admin/qr/:id` thay đổi destination_url khi status APPROVED/ACTIVE.

---

# 22. QR GENERATION

Có thể dùng thư viện QR Code đã có trong project nếu có.

Nếu chưa có:
- chọn thư viện QR phổ biến, maintained, chạy server/client phù hợp.
- không gọi API của website tạo QR bên ngoài.
- QR image được generate trong hệ thống.

Format ưu tiên:
- SVG cho in ấn
- PNG để tải/in nếu cần

Có nút:

`Tải QR`

`In QR`

`Tải tem QR`

---

# 23. TEM QR

Tạo layout in:

--------------------------------

TÊN BỆNH VIỆN

[ QR CODE ]

Mã QR: BVAP-XXXXXX

Tên: Đăng ký khám

Khoa/phòng: Khoa Khám bệnh

Mục đích: Đăng ký khám trực tuyến

Trạng thái: Đã kiểm duyệt

Ngày phê duyệt: dd/mm/yyyy

Kiểm tra QR:
https://<domain>/q/verify/...

--------------------------------

Không đưa dữ liệu bệnh nhân lên tem.

---

# 24. GIAO DIỆN DANH SÁCH QR

Table desktop:

| QR | Tên | Khoa/phòng | Mục đích | Trạng thái | Lần rà soát | Thao tác |
|---|---|---|---|---|---|---|

Filters:

- Trạng thái
- Khoa/phòng
- Loại QR
- Người tạo
- Khoảng thời gian
- Có cảnh báo
- Chưa rà soát

Search:
- tên
- public_code
- URL

Actions:
- Xem
- Sửa
- Gửi duyệt
- Duyệt
- Từ chối
- Vô hiệu
- Rà soát
- In
- Tạo phiên bản mới

---

# 25. CHI TIẾT QR

Route:

`/admin/qr/:id`

Layout:

## Header

Tên QR

Badge trạng thái

[ Rà soát ]

[ In ]

[ Tạo phiên bản mới ]

## Thông tin

- Code
- URL
- Hash
- Khoa/phòng
- Vị trí
- Người tạo
- Người duyệt
- Ngày duyệt
- Hạn sử dụng

## Security

Các badge:

PASS HTTPS
PASS DOMAIN
PASS HASH
PASS STATUS

## QR Preview

QR lớn.

## Timeline

Tạo
→ Gửi duyệt
→ Phê duyệt
→ Kích hoạt
→ Rà soát
→ ...

## Audit logs

Danh sách lịch sử.

---

# 26. PUBLIC QR ROUTE

Route:

`/q/[public_code]`

Yêu cầu:

- không yêu cầu login nếu QR là public;
- kiểm tra trạng thái trước redirect;
- log scan;
- không lộ database ID;
- không lộ dữ liệu nội bộ;
- không chấp nhận destination URL từ client;
- không open redirect.

Nếu QR invalid:

Hiển thị trang:

`Mã QR không hợp lệ hoặc đã bị vô hiệu hóa.`

`Vui lòng liên hệ bệnh viện.`

Không redirect sang URL không xác định.

---

# 27. QR VERIFY PUBLIC

Có thể có:

`/q/verify/[public_code]`

Hiển thị trang xác thực:

🟢 QR CHÍNH THỨC CỦA BỆNH VIỆN

- Tên QR
- Mục đích
- Khoa/phòng
- trạng thái
- thời điểm kiểm tra

Không hiển thị thông tin quản trị nội bộ.

---

# 28. MOBILE APP

Không đưa toàn bộ QR Manager vào app bệnh nhân.

Mobile app bệnh nhân chỉ cần:
- có thể quét QR nếu app đã có scanner;
- mở URL `/q/:public_code`;
- xử lý invalid/disabled QR đẹp và rõ ràng.

Nếu app hiện tại chưa có scanner:
- không bắt buộc thêm scanner trong phase 1.
- web browser/camera vẫn phải hoạt động tốt.

---

# 29. UI/UX

Phong cách:

- Enterprise Hospital
- sạch
- ít màu
- dễ đọc
- desktop-first cho Admin
- responsive mobile
- sử dụng Tailwind + component system hiện tại
- dùng Lucide icon hiện có
- không đưa thư viện UI mới nếu không cần.

Status colors:

- Draft: neutral
- Pending: warning
- Approved/Active: success
- Rejected: danger
- Disabled: danger
- Expired: neutral/danger
- Security warning: warning

Có confirmation dialog trước:
- approve
- reject
- disable

---

# 30. VALIDATION

Frontend validation + server validation.

Kiểm tra:

- required fields
- URL format
- HTTPS
- domain
- length
- duplicate QR name nếu policy yêu cầu
- duplicate destination URL có cảnh báo
- expiry
- public_code uniqueness

Không tin dữ liệu từ client.

---

# 31. ANTI-TAMPERING

Bắt buộc:

### Layer 1
UI khóa field.

### Layer 2
API kiểm tra status.

### Layer 3
Database/RLS/trigger nếu phù hợp.

### Layer 4
destination_hash.

Nếu phát hiện mismatch:
- không sửa tự động;
- tạo security audit;
- hiển thị cảnh báo;
- nếu cần disable QR theo policy.

---

# 32. KHÔNG ĐƯỢC LÀM

Codex KHÔNG được:

1. Tạo authentication riêng.
2. Tạo admin portal riêng.
3. Tạo user/role system mới nếu đã có.
4. Dùng QR generator online.
5. Lưu destination URL trực tiếp trong QR nếu có thể dùng route trung gian.
6. Cho phép sửa URL QR APPROVED/ACTIVE.
7. Cho phép open redirect.
8. Cho phép tự duyệt QR của chính mình.
9. Ghi password/token/secret vào audit log.
10. Expose Oracle HIS ra internet.
11. Thay đổi các module patient portal đang chạy.
12. Hard-code domain ở nhiều nơi.
13. Bypass RLS/permission bằng API client.
14. Xóa lịch sử QR cũ khi tạo version mới.

---

# 33. ACCEPTANCE TEST

Codex phải tự kiểm tra các case sau:

### Test 1
OPERATOR tạo QR.
→ DRAFT.

### Test 2
OPERATOR submit.
→ PENDING_REVIEW.

### Test 3
OPERATOR không được approve QR của chính mình.
→ DENIED.

### Test 4
APPROVER approve.
→ ACTIVE.

### Test 5
Sau approve, gọi API PATCH destination_url.
→ DENIED.

### Test 6
Thay đổi destination_url trực tiếp DB nếu trigger/RLS bảo vệ.
→ DENIED.

### Test 7
Quét QR ACTIVE.
→ redirect đúng destination.

### Test 8
Quét QR DISABLED.
→ không redirect.

### Test 9
QR giả:
`https://evil.example/...`
→ QR KHÔNG THUỘC HỆ THỐNG.

### Test 10
QR hospital code hợp lệ nhưng hash mismatch.
→ SECURITY WARNING.

### Test 11
URL redirect sang domain ngoài whitelist.
→ WARNING/BLOCK theo policy.

### Test 12
Không có open redirect.

### Test 13
Audit log được tạo cho create/submit/approve/reject/disable/audit.

### Test 14
VIEWER không thể approve/disable.

### Test 15
Không có dữ liệu bệnh nhân trong QR.

---

# 34. TESTING

Sau khi code:

1. chạy lint;
2. chạy typecheck;
3. chạy unit tests;
4. chạy integration tests;
5. chạy build;
6. kiểm tra RLS;
7. kiểm tra API authorization;
8. kiểm tra QR redirect;
9. kiểm tra mobile/web responsive.

Nếu có lỗi:
- tự phân tích;
- sửa;
- chạy test lại;
- không chỉ báo lỗi mà bỏ dở.

---

# 35. CÁCH CODEX PHẢI TRIỂN KHAI

Trước khi sửa code:

1. Inspect repository.
2. Xác định:
   - auth hiện tại
   - RBAC hiện tại
   - Admin layout
   - database client
   - Supabase schema
   - API pattern
   - component/design system
   - existing QR/scanner package nếu có.
3. Không tạo abstraction trùng với hệ thống hiện tại.

Sau đó:

### Phase 1
Database + migration + RLS.

### Phase 2
Server service + validation + permission.

### Phase 3
Admin list/dashboard/detail.

### Phase 4
Create/edit/review/approve/reject/disable.

### Phase 5
QR generation + print.

### Phase 6
Public `/q/:public_code`.

### Phase 7
Audit/verify/security checks.

### Phase 8
Logs.

### Phase 9
Tests.

### Phase 10
UI polish + responsive + build.

---

# 36. QUY TẮC QUAN TRỌNG CHO CODEX

Không viết lại cả project.

Ưu tiên:
- reuse code;
- reuse auth;
- reuse RBAC;
- reuse UI;
- reuse Supabase client;
- reuse API patterns;
- migration nhỏ, rõ ràng;
- thay đổi có phạm vi;
- không phá chức năng đang chạy.

Trước mỗi thay đổi lớn:
- inspect code liên quan;
- xác định dependency;
- implement nhỏ;
- test;
- tiếp tục.

Nếu phát hiện schema/role/API hiện tại khác tài liệu này:
→ ưu tiên kiến trúc thực tế của repository;
→ điều chỉnh module QR để tương thích;
→ không tạo hệ thống song song.

---

# 37. DEFINITION OF DONE

Module được coi là hoàn thành khi:

- [ ] Có menu QR trong Admin.
- [ ] Dashboard hoạt động.
- [ ] Tạo QR.
- [ ] QR preview.
- [ ] Lưu draft.
- [ ] Gửi duyệt.
- [ ] Duyệt/từ chối.
- [ ] Không tự duyệt.
- [ ] QR approved không sửa URL.
- [ ] Có hash.
- [ ] Có public QR route.
- [ ] Không open redirect.
- [ ] Có whitelist domain.
- [ ] Có verify QR.
- [ ] Có audit.
- [ ] Có scan log.
- [ ] Có audit log.
- [ ] Có disable.
- [ ] Có expiry.
- [ ] Có in QR.
- [ ] Có security warning.
- [ ] RLS/permission đúng.
- [ ] Test pass.
- [ ] Build pass.
- [ ] Không ảnh hưởng patient portal.
- [ ] Không tạo auth/RBAC/database song song không cần thiết.

---

# 38. YÊU CẦU OUTPUT CỦA CODEX

Sau khi triển khai, Codex phải báo cáo:

1. Files đã tạo.
2. Files đã sửa.
3. Database migrations.
4. API endpoints.
5. Permission đã thêm/map.
6. Các security controls.
7. Tests đã chạy.
8. Kết quả lint/typecheck/build.
9. Các vấn đề còn tồn tại.
10. Hướng dẫn chạy local.
11. Hướng dẫn cấu hình domain whitelist.
12. Hướng dẫn tạo tài khoản/permission cho người vận hành QR.

KHÔNG báo cáo chung chung kiểu "đã hoàn thành".
Phải đưa kết quả kiểm tra cụ thể.

---

# 39. PROMPT NGẮN ĐỂ GIAO CHO CODEX

Bạn đang làm việc trên một hệ thống patient portal bệnh viện hiện có.

Hãy inspect repository trước và tích hợp module "Hospital QR Manager" vào Admin hiện tại.

Mục tiêu là quản lý tập trung QR Code bệnh viện theo quy trình:
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → DISABLED/EXPIRED.

Không tạo authentication, RBAC hoặc Admin Portal mới. Tận dụng kiến trúc hiện tại.

Module phải có:
- Dashboard
- Danh sách QR
- Tạo/sửa QR
- Review/Approve/Reject
- Disable
- QR preview/print
- Public `/q/:public_code`
- QR verification
- Camera/manual audit
- Domain whitelist
- SHA-256 destination hash
- Scan log
- Audit log
- RLS/API authorization
- Anti-open-redirect
- Anti-tampering
- Không cho sửa destination_url sau APPROVED/ACTIVE
- Đổi URL phải tạo QR/version mới
- Không cho người tạo tự approve
- Không dùng QR generator online
- Không đưa dữ liệu bệnh nhân vào QR.

Hãy triển khai theo tài liệu đầy đủ trong file `HOSPITAL_QR_MANAGER_CODEX_SPEC.md`.

Trước khi code: inspect auth, RBAC, admin layout, Supabase schema, API patterns và design system hiện tại.

Sau khi code: chạy lint, typecheck, tests và build; tự sửa lỗi cho đến khi pass.

Không phá các chức năng hiện có.
