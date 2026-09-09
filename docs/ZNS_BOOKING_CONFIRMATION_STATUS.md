# ZNS xác nhận đăng ký khám và trạng thái trên HIS

Ngày cập nhật: 09/09/2026

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

Trước khi dùng bản HIS mới, cần chạy script Oracle ở trên để có cột `TRANGTHAI_ZALO`, nếu không câu SQL trên HIS sẽ báo thiếu cột.

## Artifact

- Agent Windows: `artifacts/patientapi-agent-win-x64.zip`
- Bản HIS đã build nhưng chưa chép đè nếu app còn đang chạy: `D:\HGMedical\HGSoft\bin\Debug\BenhNhan_zns_status.exe`
