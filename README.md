# Cổng thông tin bệnh nhân An Phú

Repo: `patient-portal-aph`

Patient Portal bằng Next.js cho bệnh nhân Bệnh viện Đa khoa An Phú tra cứu lịch sử khám, xét nghiệm, chẩn đoán hình ảnh, đơn thuốc, BHYT và trạng thái khám hôm nay.

## Tech stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase PostgreSQL/Auth ready
- Lucide React, Zod, React Hook Form, date-fns
- ESLint, Prettier, Vitest

## Yêu cầu môi trường

- Node.js 20+
- npm 10+

## Cài dependency

```bash
npm install
```

## Chạy development

```bash
npm run dev
```

Mở `http://localhost:3000`.

## Demo/local login

- Phone: `0901234567`
- Patient code: `23006552`
- OTP: `123456`

## Environment variables

Tạo `.env.local` từ `.env.example`:

```bash
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Không đưa service role key hoặc database credentials vào browser.

## Supabase setup

Public deployment dùng Supabase project `patientportal` và on-demand sync theo bệnh nhân. Chạy migration:

```text
supabase/migrations/202608160001_patient_portal_reporting.sql
```

Checklist triển khai nằm tại `docs/DEPLOY-PATIENTPORTAL-CHECKLIST.md`.

## Build production

```bash
npm run lint
npm run test
npm run build
```

## Deploy Vercel

1. Push source lên Git repository.
2. Import project vào Vercel.
3. Cấu hình environment variables theo `.env.production.example`.
4. Deploy bằng preset Next.js mặc định.

## Architecture

UI chỉ gọi `PatientRepository` trong `src/lib/data`. Local có thể dùng PatientApi/OracleDirect; public app dùng `SupabasePatientRepository` khi bật `PATIENT_DATA_MODE=supabase`.

MVP cũng có các endpoint nội bộ dùng session hiện tại:

- `GET /api/me`
- `GET /api/me/visits`
- `GET /api/me/visits/{id}`
- `GET /api/me/lab-results`
- `GET /api/me/imaging`
- `GET /api/me/prescriptions`
- `GET /api/me/insurance`
- `GET /api/me/appointments`

## Oracle integration roadmap

Xem `docs/ORACLE-INTEGRATION.md` và `docs/PORTAL-DATA-ARCHITECTURE.md`. Luồng public là Browser -> Vercel -> Supabase reporting DB; chỉ sync agent nội bộ bệnh viện được đọc Oracle HIS bằng user read-only.
