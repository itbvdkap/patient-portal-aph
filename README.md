# Cổng thông tin bệnh nhân An Phú

MVP Patient Portal bằng Next.js cho bệnh nhân Bệnh viện Đa khoa An Phú tra cứu lịch sử khám bệnh. Phiên bản này chỉ dùng dữ liệu mô phỏng, không kết nối Oracle và không dùng dữ liệu bệnh nhân thật.

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

## Demo login

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

Chạy `supabase/schema.sql`, sau đó `supabase/seed.sql`. Schema có UUID primary key, foreign key rõ ràng và đã bật Row Level Security để chuẩn bị policy theo authenticated patient.

## Build production

```bash
npm run lint
npm run test
npm run build
```

## Deploy Vercel

1. Push source lên Git repository.
2. Import project vào Vercel.
3. Cấu hình environment variables, tối thiểu `NEXT_PUBLIC_DEMO_MODE=true` cho MVP.
4. Deploy bằng preset Next.js mặc định.

## Architecture

UI chỉ gọi `PatientRepository` trong `src/lib/data`. MVP dùng `MockPatientRepository`; khi tích hợp thật có thể thay bằng repository gọi REST API mà không viết lại các trang.

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

Xem `docs/ORACLE-INTEGRATION.md`. Luồng tương lai là Browser -> HTTPS -> Patient Portal -> Patient API -> Oracle HIS. Không thiết kế API cho bệnh nhân tự truyền MABN để xem dữ liệu người khác.
