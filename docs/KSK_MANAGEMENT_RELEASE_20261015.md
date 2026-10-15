# Bàn giao quản lý đoàn / gói HIS — 15/10/2026

## Chế độ đang dùng

Theo xác nhận của người vận hành: **chưa có Oracle TEST; giữ CN1 chỉ đọc và lưu nháp trước**. Local đã mở menu `/admin/ksk-manage`, đọc dữ liệu thật để lập phiếu; nháp mã hóa lưu riêng trên máy web. Có thể gửi duyệt nội bộ, không ghi thay đổi về HIS. Chưa chạy script ledger/sequence, chưa cấp kết nối ghi, không sửa env hoặc service CN1/CN3. Worker/Zalo không được bật trong phiên thử local này.

Hướng dẫn thao tác và giới hạn: [KSK_MANAGEMENT.md](KSK_MANAGEMENT.md). Thêm người hiện yêu cầu MABN thật đã tồn tại; chưa cấp MABN mới, chưa import Excel hoặc xóa dữ liệu HIS.

## Kiểm chứng

- Vitest: 198/198; production Next build thành công, không cảnh báo sau dọn import thừa.
- .NET build thành công, 0 cảnh báo/lỗi; model test 24 assertion; transport test 6 checks không nối Oracle.
- CN1 thật: API/page/preflight đều 200, người chưa đăng nhập 401, `writeEnabled=false`. Không tạo nháp thử trong kho vận hành, không ghi HIS.
- Hồi quy báo cáo CN1: 13 người, 13 lượt, 127 chỉ định/chi tiết thu liên kết, 540 thông số xét nghiệm, 21 dòng CLS; xuất báo cáo thu/kết quả đạt. Chỉ ghi số lượng trong log kiểm thử.
- Edge 1366×768 và 682×1012: 5 tab, 14 trường form thêm đợt, nút lưu nháp hiện rõ, không tràn ngang toàn trang, ghi HIS tắt.
- Mã ghi Oracle mới **chưa được kiểm thử transaction trên database TEST**, chưa sẵn sàng mở ghi production.

## Gói agent đã xuất — chưa triển khai lên server

- File: `artifacts/patientapi-agent-ksk-management-20261015.zip`
- Kích thước: 52.453.702 byte; 355 mục.
- SHA-256: `C920C0DD0DA9C4D319BB96FF34B3A3CEFB2038E35BFC8C6AC9652F6DDAFB5897`
- Kiểm tra ZIP: không chứa env thật, appsettings.Development, kho nhân viên hoặc kho nháp. Cấu hình management và write đều mặc định false; kết nối ghi để trống.
- Gói cũ được giữ nguyên. Không dùng gói này để tự bật ghi; giữ env thật trên server nếu triển khai agent theo đợt vận hành riêng. ZIP chỉ là agent, không phải gói web.
