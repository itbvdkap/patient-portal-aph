# Oracle HIS Integration Roadmap

Ghi chu cap nhat 2026-08-16:

- Kien truc muc tieu moi khong cho request web/app truy van truc tiep DB HIS chinh.
- PatientApi se doc Portal Reporting DB.
- Sync Worker moi duoc doc Oracle HIS chinh, bang user read-only va gioi han concurrency.
- Dong bo theo on-demand sync: benh nhan nao truy cap thi moi dong bo ho so benh nhan do.
- Tham khao chi tiet: `docs/PORTAL-DATA-ARCHITECTURE.md`.
- SQL schema draft: `docs/sql/portal_schema_draft.sql`.

MVP hiện tại chạy demo mode và chỉ dùng mock data. Khi kết nối hệ thống thật, browser không được truy cập Oracle trực tiếp.

Luồng mục tiêu:

```text
Browser
-> HTTPS
-> Patient Portal
-> Patient API
-> Oracle HIS
```

Oracle username/password không bao giờ nằm trong Next.js client. Các secret được quản lý bằng environment variables trên backend hoặc secret manager.

## Backend đề xuất

Có thể xây Patient API bằng ASP.NET Core Web API:

- `Oracle.ManagedDataAccess` để kết nối Oracle.
- `Dapper` để query có kiểm soát.
- JWT/session token để xác định bệnh nhân đã xác thực.
- Rate limiting, audit log, sanitize error messages.

## Endpoint tương lai

MVP đã tạo sẵn các route nội bộ sau, hiện đọc từ `PatientRepository` và session demo:

- `GET /api/me`
- `GET /api/me/visits`
- `GET /api/me/visits/{id}`
- `GET /api/me/lab-results`
- `GET /api/me/imaging`
- `GET /api/me/prescriptions`
- `GET /api/me/insurance`
- `GET /api/me/appointments`

Không thiết kế endpoint dạng `/patients/{mabn}` cho bệnh nhân tự truyền mã bệnh nhân. Backend phải xác định patient từ authenticated user/token.

## HIS mapping dự kiến

Các nguồn Oracle có thể được map vào repository/API layer:

- `BTDBN`: hồ sơ bệnh nhân, `MABN`, `HOTEN`, `NGAYSINH`, `PHAI`.
- `BHYT`, `BHYTKB`: số thẻ, thời hạn, mã quyền lợi.
- `TIEPDON`, `BENHANDT`: lần tiếp nhận/lần khám, `MAQL`, `NGAY`, `CHANDOAN`.
- `V_CHIDINH`, `V_CHIDINH2`, `V_GIAVP`: dịch vụ cận lâm sàng.
- `BHYTTHUOC`, `D_DMBD`: thuốc, hoạt chất, hàm lượng, số lượng.
- `DMBS`: bác sĩ.
- `SA_BNCDHA`, `SA_BNCDHA_CT`, `SA_LOAICDHA`: chẩn đoán hình ảnh.

UI hiện chỉ phụ thuộc `PatientRepository`, nên có thể thay `MockPatientRepository` bằng `OracleApiPatientRepository` mà không viết lại giao diện.

## Bảo mật

- HTTPS only.
- Authentication required cho toàn bộ route bệnh nhân.
- Authorization theo patient, không tin MABN từ client.
- Supabase dùng Row Level Security nếu lưu dữ liệu portal.
- Không expose service role key.
- Không log password, OTP, access token, refresh token.
- Audit log các hành động nhạy cảm với `user_id`, `patient_id`, `action`, `resource`, `created_at`, `ip_address`.
