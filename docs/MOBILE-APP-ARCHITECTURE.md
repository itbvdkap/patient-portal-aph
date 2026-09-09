# Mobile App Architecture

Mục tiêu: thêm app bệnh nhân mobile bằng React Native + Expo nhưng giữ nguyên các phần đang chạy ổn định.

## Ranh Giới Giữ Nguyên

- Next.js portal hiện tại vẫn là public web portal và API gateway.
- Supabase reporting DB vẫn là nguồn dữ liệu public cho bệnh nhân.
- PatientApi/.NET vẫn là internal API/sync agent.
- Oracle/HIS sync vẫn chạy trong mạng bệnh viện, không mở trực tiếp cho mobile.

## Layout Mới

```text
apps/mobile-app              Expo React Native app
packages/patient-domain      Shared patient types, session schemas, format helpers
src/app                      Next.js portal + API routes hiện tại
backend/PatientApi           Internal Oracle/HIS sync agent
supabase                     Reporting schema/migrations
```

Root Next app chưa di chuyển vào `apps/portal-web` để tránh rủi ro với Vercel hiện tại. Khi ổn định có thể tách bước sau.

## Luồng Mobile

```text
Expo mobile app
  -> Next.js API /api/mobile/*
  -> Supabase reporting DB / portal session
  -> sync queue nếu cần dữ liệu mới
  -> PatientApi/Sync Agent trong nội bộ
  -> Oracle HIS
```

Mobile không gọi Oracle, PatientApi nội bộ, hoặc Supabase service role trực tiếp.

## Trạng Thái Mobile Hiện Tại

Đã có shell mobile bằng Expo Router với bottom navigation. Menu dưới hiện gồm `Trang chủ`, `Đăng ký`, `Thông báo`, `Hồ sơ`, `Tài khoản`; mục `Khám hôm nay` được gom vào màn `Thông báo`. Các màn hình chính đã dùng Next.js API/session hiện tại:

- đăng nhập bằng mật khẩu, OTP Zalo và đăng ký tài khoản;
- dashboard bệnh nhân với hồ sơ đang xem, BHYT, khám hôm nay và shortcut hồ sơ;
- chọn/thêm/gỡ hồ sơ y tế người thân;
- đăng ký khám, hỗ trợ hồ sơ cũ và quét QR CCCD;
- lịch sử đăng ký với filter nhanh, STT khám, mã phòng và trạng thái;
- khám hôm nay với STT bệnh nhân, hàng đợi phòng khám, số đang xử lý tới và thời gian ước tính;
- trung tâm `Thông báo` có 2 tab: `Khám hôm nay` và `Thông báo`, tổng hợp lịch hẹn sắp tới, BHYT sắp hết hạn, xét nghiệm bất thường và kết quả CĐHA mới;
- BHYT điện tử;
- tài khoản có tên hiển thị, hồ sơ đang xem, đổi mật khẩu, cài đặt thông báo thiết bị, passcode placeholder, thiết bị đăng nhập và nhóm pháp lý;
- danh sách hồ sơ y tế theo nhóm và chi tiết lần khám.

Màn `Khám hôm nay` đọc `queueStatus` từ `GET /api/me/today-visit`. Trường này được backend tính từ `TIEPDON.DONE`, `TIEPDON.STT_KHAM` và `TIEPDON.MAKP` cùng ngày/cùng phòng. Đây là ước tính vận hành, không thay thế bảng gọi số chính thức nếu HIS có module gọi số riêng.

Màn `Thông báo` hiện là notification center tại chỗ trong app, chưa phải push notification nền. Tab `Khám hôm nay` hiển thị cùng dữ liệu STT/hàng đợi của màn `/today`; tab `Thông báo` tổng hợp dữ liệu từ các API sẵn có:

- `GET /api/me/today-visit` cho lượt khám/STT/hàng đợi hôm nay;
- `GET /api/me/appointments` cho lịch hẹn trong 14 ngày tới;
- `GET /api/me` cho hạn BHYT;
- `GET /api/me/lab-results` cho chỉ số bất thường;
- `GET /api/me/imaging` cho kết quả CĐHA mới.

## Session Chuẩn Cho Mobile

Mobile lưu session cookie/token trong secure storage. API chuẩn đầu tiên:

```http
GET /api/mobile/session
```

Response:

```json
{
  "data": {
    "sessionId": "...",
    "accountId": "...",
    "accountKey": "...",
    "phoneMasked": "094****777",
    "currentMabn": "17777777",
    "profiles": [
      {
        "mabn": "17777777",
        "patientId": "his-17777777",
        "fullName": "..."
      }
    ]
  }
}
```

Các endpoint dữ liệu bệnh nhân hiện tại vẫn dùng được sau khi có session:

- `GET /api/me`
- `GET /api/me/summary`
- `GET /api/me/today-visit`
- `GET /api/me/visits`
- `GET /api/me/lab-results`
- `GET /api/me/imaging`
- `GET /api/me/prescriptions`
- `GET /api/me/insurance`
- `GET /api/me/appointments`
- `GET /api/me/registrations`

## Auth Mobile Giai Đoạn Đầu

Giai đoạn đầu nên để mobile dùng lại API auth hiện tại:

- `POST /api/auth/start-register`
- `POST /api/auth/verify-register-otp`
- `POST /api/auth/set-password`
- `POST /api/auth/login-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Sau khi login thành công, mobile lưu cookie/session nhận từ Next API vào secure storage.

## Package Shared Domain

`packages/patient-domain` chứa:

- `patient.ts`: patient, visit, lab, imaging, prescription, insurance, today visit types.
- `session.ts`: mobile session schema, API envelope schema.
- `format.ts`: formatter dùng chung web/mobile.

Next hiện re-export patient types qua `src/types/patient.ts` để giữ import cũ không vỡ.

## Lệnh Chạy

Web portal:

```bash
npm run dev
```

Mobile app:

```bash
npm install
npm --workspace @anphu/mobile-app run start
```

Test nhanh mobile web:

```bash
npm --workspace @anphu/mobile-app run web
```

Khi chạy Expo web local, app gọi portal web local ở `http://localhost:3001` để giữ cookie/session hoạt động trên trình duyệt.

Typecheck shared package:

```bash
npm --workspace @anphu/patient-domain run typecheck
```

Typecheck mobile app:

```bash
npm --workspace @anphu/mobile-app run typecheck
```

Dang ky kham tren mobile dung danh muc chi nhanh chung tu `@anphu/patient-domain`. UI chi hien CN1/CN3 va API tu choi booking khong co `branchCode` hop le.
