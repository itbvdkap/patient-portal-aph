# Patient API

[Quản lý đoàn/gói/danh sách HIS qua web](../../docs/KSK_MANAGEMENT.md): API `/api/internal/ksk-management`, POST `patient`, `validate`, `apply`; token quản lý riêng. Nháp/duyệt ở web, agent kiểm tra và ghi transaction + ledger bằng credential riêng. Mặc định ghi tắt; chưa cài ledger hoặc commit DML CN1 trong đợt phát triển. Không thay endpoint báo cáo thành endpoint ghi.

KSK 15/10/2026: hợp đồng `scope.episodePolicy=2`, bổ sung MABN/MAVAOVIEN của chỉ định, MAVAOVIEN đầu phiếu và số lượng/đơn giá chi tiết. [Quy tắc và kiểm thử](../../docs/KSK_EPISODE_PAYMENT_POLICY.md); không thay Oracle hoặc service bệnh viện tự động.

KSK theo đoàn: endpoint staff-only `GET /api/internal/ksk`, mặc định tắt, dùng token và kết nối `OracleKskReadOnly` riêng. Snapshot có chứng từ thu, miễn giảm, trả sau, hoàn và tạm ứng trong phần `payments`; thiếu nguồn không được xem là chưa thu. Xem [cấu hình và giới hạn bản chỉ đọc](../../docs/KSK_READONLY_MODULE.md).

Bổ sung tổng hợp nhiều đoàn: cùng endpoint với `all=1`, `from/to` (ngày tiếp nhận), `collectedFrom/collectedTo` (ngày phiếu thu), `cohort=`. Scope xác nhận `collections=true`, thêm cohortid/registereddate/cashierid/cashiername; không tải XN/CLS. Giữ READ ONLY, giới hạn 20.000 dòng/tập, không thay chế độ workers. Xem [báo cáo thu tổng hợp](../../docs/KSK_COLLECTIONS_REPORT.md).

ASP.NET Core API trung gian giữa Next.js Patient Portal và Oracle HIS.

## Yêu cầu

- .NET SDK 9.0+
- Network access tới Oracle HIS
- Oracle user chỉ có quyền đọc các bảng/view cần thiết

Máy hiện tại chỉ có .NET runtime, chưa có SDK, nên chưa thể `dotnet restore/build` tại chỗ.

## Cấu hình secret

Không commit secret. Dùng environment variables hoặc user-secrets:

```powershell
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:OracleHis" "User Id=...;Password=...;Data Source=host:1521/service;"
dotnet user-secrets set "PatientPortal:ServerToken" "long-random-token"
dotnet user-secrets set "PatientPortal:DemoHisPatientCode" "23006552"
```

Portal Next.js gọi API bằng:

```env
NEXT_PUBLIC_DEMO_MODE=false
PATIENT_API_BASE_URL=https://patient-api.example.com
PATIENT_API_SERVER_TOKEN=long-random-token
```

`PATIENT_API_SERVER_TOKEN` là server-only env var, không có prefix `NEXT_PUBLIC_`.

## Chạy local sau khi cài SDK

```powershell
dotnet restore
dotnet run --project backend/PatientApi/PatientApi.csproj
```

## Booking HIS match

Khi bật `PatientPortal:EnableBookingHisMatchWorker`, agent đối soát lịch đăng ký online trong booking DB với `TIEPDON` trong HIS.

Trong mô hình CN1/CN3 dùng hai Oracle server riêng, mỗi agent phải có `PatientPortal:BranchCode` và `PatientPortal:BranchName`. Booking và thông báo được lọc cứng theo `branch_code`; agent sẽ không khởi động các worker này nếu thiếu mã chi nhánh hợp lệ.

Luồng match hiện tại ưu tiên:

- giải mã CCCD/CMND từ `portal.lich_hen_kham."soCCCD_encrypt"` bằng `BOOKING_ENCRYPTION_KEY`;
- tìm `MABN` trong Oracle qua `BTDBN.CMND`, `BTDBN.CMND_BN`, `DIENTHOAI.CMND`;
- chỉ match các lượt `TIEPDON` đúng `ngay_kham` của booking;
- nếu cùng CCCD/MABN có nhiều lượt trong ngày, chọn lượt có giờ `TIEPDON.NGAY` nhỏ nhất (chỉ giữ cần xem lại khi các lượt có cùng giờ);
- dùng phòng/khoa, STT khám và MAQL làm tín hiệu phụ.

Nếu thay đổi worker này, cần publish lại Windows sync agent.

## Nghiệp vụ đổi lịch và Zalo

Chức năng đổi ngày/giờ/phòng sau khi đã gửi xác nhận chưa được triển khai trong
worker hiện tại. Khi triển khai, không reset trực tiếp outbox `sent`; cần tạo một
notification revision mới và giữ bản ghi cũ để audit.

Luồng dự kiến:

- cập nhật lịch chính trong `portal.lich_hen_kham`;
- tăng `schedule_revision`, ghi `lich_hen_kham_history` và đưa HIS match về `PENDING`;
- đồng bộ lại `HGSOFT_SOYBA.DANGKYKHAM`;
- tạo outbox `booking_rescheduled` cho giờ/phòng mới;
- nếu HIS đã có `MAQL_TIEPDON`/STT, yêu cầu nhân viên xác nhận hủy và đăng ký lại
  trước khi gửi tin mới;
- worker chỉ gửi một lần cho mỗi revision, retry không tạo tin trùng.

Thay đổi này cần migration, cập nhật form thao tác và kiểm thử riêng; tài liệu hiện
chỉ mô tả thiết kế, chưa thay đổi mã nguồn.

## Nguyên tắc bảo mật

- Browser không gọi Oracle trực tiếp.
- API không nhận route `/patients/{mabn}` từ bệnh nhân.
- Patient được xác định từ token/session.
- Booking worker không log CCCD/CMND đã giải mã.
- Không log OTP, access token, refresh token, Oracle password.
- Query phải có điều kiện patient scope theo `MABN` đã xác thực.
