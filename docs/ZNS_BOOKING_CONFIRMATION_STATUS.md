# ZNS xác nhận đăng ký khám và trạng thái trên HIS

Ngày cập nhật: 30/09/2026

## Ghi chú vận hành ngày 30/09/2026

`BookingHisMatchWorker` đã được xử lý để không làm rollback toàn bộ lượt match
khi bảng `portal_patient_branch_mappings` gặp một unique index cũ
(`ux_patient_branch_mapping_identity` hoặc `ux_patient_branch_mapping_account`).
Nếu mapping đã tồn tại, worker chỉ làm mới `verified_at`, `last_seen_at` và
`updated_at`; nếu phát sinh xung đột mapping phụ khác, worker bỏ qua phần mapping
đó nhưng vẫn tiếp tục lưu `his_match`, history và tạo `notification_outbox`.

Lỗi `23505 duplicate key ... ux_patient_branch_mapping_identity` trước đây làm
transaction bị rollback, vì vậy booking bị giữ ở `RETRY` và không có tin Zalo để
gửi. Sau khi triển khai bản agent mới, không cần xóa mapping cũ; booking `RETRY`
có `his_match_next_check_at` đã đến hạn sẽ được worker thử lại ở chu kỳ kế tiếp.

## Mục tiêu

- Dùng mẫu ZBS/ZNS đã duyệt `628108` để gửi tin Zalo xác nhận đăng ký khám sau khi HIS đã tiếp nhận.
- Tin chỉ gửi khi booking đã có dữ liệu HIS cần thiết như mã đăng ký, mã bệnh nhân, ngày giờ khám, phòng khám và STT.
- Form HIS `Danh sách đăng ký online` phân biệt được:
  - bệnh nhân chưa đăng ký / đã đăng ký vào HIS;
  - Zalo chưa gửi / chờ gửi lại / lỗi / đã gửi.

## Luồng xử lý

1. Portal tạo lịch hẹn trong `portal.lich_hen_kham`.
2. `BookingHisOnlineSyncWorker` đẩy lịch hẹn sang Oracle `HGSOFT_SOYBA.DANGKYKHAM`.
3. Người dùng HIS tiếp nhận/cập nhật đăng ký, HIS ghi `maql_tiepdon` và STT/phòng khám.
4. `BookingHisMatchWorker` match lại booking với HIS, tạo dòng `portal.notification_outbox` kênh `zalo`.
5. Khi auto-send đang tắt, tin nằm ở trạng thái chờ để admin gửi thủ công. Chỉ bật auto-send khi đã kiểm tra dữ liệu cũ an toàn.
6. Sau khi gửi thủ công hoặc bật auto-send để worker gửi, hệ thống cập nhật:
   - Supabase: `portal.notification_outbox.status`, `portal.lich_hen_kham.zalo_confirm_sent_at`;
   - Oracle: `HGSOFT_SOYBA.DANGKYKHAM.trangthai_zalo`, `ngaygui_zalo`, `loi_zalo`.

## Nghiệp vụ đổi lịch và gửi lại xác nhận (thiết kế, chưa triển khai)

Hiện tại hệ thống không tự gửi lại khi một lịch đã `DA_GUI` nhưng bệnh nhân đổi ngày,
giờ hoặc phòng khám. Không được dùng lại bản ghi outbox đã `sent`, vì việc đó có thể
gây gửi trùng hoặc làm mất lịch sử tin đã gửi.

### Nguyên tắc nguồn dữ liệu

- Lịch hẹn online trong `portal.lich_hen_kham` là nguồn chính cho các thay đổi do
  bệnh nhân/nhân viên portal yêu cầu.
- Oracle `HGSOFT_SOYBA.DANGKYKHAM` là bản đồng bộ để HIS tiếp nhận và hiển thị.
- Không sửa riêng Oracle rồi chờ worker tự suy ngược; thay đổi đó có thể bị worker
  online-sync ghi đè từ portal.

### Luồng đổi lịch đề xuất

1. Nhân viên chọn **Đổi lịch/Gửi lại xác nhận**, nhập ngày/giờ/phòng mới và lý do.
2. Trong một transaction, cập nhật `portal.lich_hen_kham`, tăng
   `schedule_revision`, ghi `portal.lich_hen_kham_history`, đặt lại
   `his_match_status='PENDING'` và xóa `zalo_confirm_sent_at` của phiên bản mới.
3. Bản ghi notification cũ được giữ để audit và đánh dấu `superseded`; không reset
   bản ghi `sent` cũ để gửi lại âm thầm.
4. Tạo một outbox mới cho phiên bản lịch mới với `schedule_revision`, dữ liệu giờ/phòng
   mới và loại thông báo `booking_rescheduled`.
5. Booking HIS online-sync cập nhật bản ghi Oracle. Nếu đã có `MAQL_TIEPDON`, `STT`
   hoặc lượt tiếp nhận cũ, nhân viên phải xác nhận hủy/đăng ký lại theo quy trình HIS;
   hệ thống không tự ghi đè lượt đã tiếp nhận.
6. Sau khi HIS match lại, outbox mới ở `pending` để nhân viên duyệt và gửi (auto-send
   chỉ bật sau khi đã kiểm thử).
7. Khi Zalo gửi thành công, chỉ phiên bản mới chuyển `sent/DA_GUI`; phiên bản cũ vẫn
   giữ lịch sử gửi trước đó.

### Trạng thái và chống gửi trùng

- Mỗi lần đổi lịch có một `schedule_revision` riêng; retry trong cùng revision không
  tạo thêm tin.
- `DA_GUI` của phiên bản cũ không được xem là xác nhận cho phiên bản mới.
- Worker reconcile chỉ cập nhật trạng thái HIS, không gọi Zalo lại cho outbox đã gửi.
- Cần có bước xác nhận khi đổi lịch sau khi HIS đã tạo `MAQL_TIEPDON`.

Phần này là đặc tả nghiệp vụ để triển khai sau. Việc cập nhật tài liệu này chưa thay
đổi schema, form HIS, portal hay worker.

## Cấu hình đã thêm

- Supabase migration: `supabase/migrations/20260909152000_zns_booking_confirmation_template_628108.sql`
  - đặt `booking.zalo_auto_send_enabled = false` để chưa tự gửi hàng loạt;
  - đặt `zalo.template.booking_his_confirmed = 628108`.
- Supabase migration tắt auto-send nếu trước đó đã bật: `supabase/migrations/20260909153500_disable_auto_zalo_send_manual_first.sql`
- Env mẫu: `deploy/windows-service/patientapi-service.env.example`
  - `PatientPortal__NotificationOutboxAutoSendEnabled=false`;
  - `ZALO_BOOKING_CONFIRMED_TEMPLATE_ID=628108`.
- Oracle script: `deploy/oracle/hgsoft_soyba_dangkykham_online.sql`
  - thêm `MAVAOVIEN` để HIS ghi ngược mã vào viện/lượt tiếp đón sau khi lưu đăng ký online;
  - thêm `TRANGTHAI_ZALO`;
  - thêm `NGAYGUI_ZALO`;
  - thêm `LOI_ZALO`.

## Trạng thái Zalo trong Oracle

- `CHUA_GUI`: booking đã được sync sang HIS nhưng chưa gửi Zalo.
- `CHO_GUI`: gửi lỗi tạm thời, worker sẽ retry.
- `LOI`: gửi lỗi hết số lần retry.
- `DA_GUI`: đã gửi ZNS thành công.

## HIS `Danh sách đăng ký online`

Patch IL của `BenhNhan.exe` đã đổi câu SQL `Load_DSDK`:

- bỏ điều kiện chỉ lấy dòng `maql_tiepdon = 0`, để danh sách thấy cả bệnh nhân đã đăng ký và chưa đăng ký;
- cột `Phòng khám` hiển thị thêm nhãn:
  - `[Chua DK]` hoặc `[Da DK]`;
  - `[Zalo chua gui]`, `[Zalo cho gui]`, `[Zalo loi]`, `[Zalo da gui]`.

### Tab gửi nhiều hồ sơ

Bản `BenhNhan_zalo_batch_20260926_v2` có thêm tab **Gửi Zalo nhiều hồ sơ** trong
form này. Tab chỉ lấy hồ sơ đã `DA DK` trong khoảng ngày đang lọc, hiển thị
checkbox từng dòng và các nút **Tải lại**, **Chọn tất cả**, **Gửi Zalo**.

Khi xác nhận gửi, HIS chỉ chạy cập nhật Oracle:

```sql
update hgsoft_soyba.dangkykham
   set trangthai_zalo = 'CHO_GUI',
       loi_zalo = null,
       ngaygui_zalo = null
 where id in (...);
```

Form không gọi Zalo và không ghi trực tiếp Supabase. Worker đọc các hồ sơ `CHO_GUI`,
tìm/promote outbox tương ứng rồi gửi ZNS, sau đó cập nhật `DA_GUI` hoặc `LOI` về Oracle. Dòng
`CHO_GUI` đang chờ sẽ được bỏ qua nếu chọn gửi lại; dòng `DA_GUI` cần xác nhận riêng
trước khi resend. Tab tự tải lại khoảng 30 giây hoặc bấm **Tải lại**.

Trước khi dùng bản HIS mới, cần chạy script Oracle ở trên để có cột `TRANGTHAI_ZALO`, nếu không câu SQL trên HIS sẽ báo thiếu cột.

## Artifact

- Agent Windows: `artifacts/patientapi-agent-win-x64.zip`
- Gói HIS thử nghiệm: `artifacts/BenhNhan_zalo_batch_20260926_v2.zip`
- Hướng dẫn gói: `artifacts/BenhNhan_zalo_batch_20260926_README.md`
- SHA-256 ZIP: `3BCDA43A332B3288234354E1FC0ED60497CA2D06D84221D3786992B763806A85`
- SHA-256 `BenhNhan.exe` trong gói: `1C6DB8236A3A8E64EB50AD297B5CB8E142AE76A7F834E12294A391C613ED1585`
- Không chép đè khi `BenhNhan.exe` còn đang chạy; sao lưu file hiện tại trước khi thay.
