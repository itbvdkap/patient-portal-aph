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

## Nguyên tắc bảo mật

- Browser không gọi Oracle trực tiếp.
- API không nhận route `/patients/{mabn}` từ bệnh nhân.
- Patient được xác định từ token/session.
- Không log OTP, access token, refresh token, Oracle password.
- Query phải có điều kiện patient scope theo `MABN` đã xác thực.
