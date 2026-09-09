# Patient API

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
- dùng phòng/khoa, STT khám và MAQL làm tín hiệu phụ.

Nếu thay đổi worker này, cần publish lại Windows sync agent.

## Nguyên tắc bảo mật

- Browser không gọi Oracle trực tiếp.
- API không nhận route `/patients/{mabn}` từ bệnh nhân.
- Patient được xác định từ token/session.
- Booking worker không log CCCD/CMND đã giải mã.
- Không log OTP, access token, refresh token, Oracle password.
- Query phải có điều kiện patient scope theo `MABN` đã xác thực.
