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

Typecheck shared package:

```bash
npm --workspace @anphu/patient-domain run typecheck
```
