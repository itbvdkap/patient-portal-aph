# Tiep tuc du an sau khi mo lai bang Codex IDE

Ngay cap nhat: 2026-08-14

## Trang thai hien tai

- Frontend Next.js chay local o `http://localhost:3001`.
- Backend PatientApi .NET 9 chay local o `http://127.0.0.1:5080`.
- Portal dang dung backend that, khong con demo mode.
- Kien truc muc tieu moi: portal khong truy van truc tiep DB HIS chinh tu request web/app.
- Huong moi: PatientApi doc Portal Reporting DB; Sync Worker on-demand dong bo HIS theo `MABN`, `MAVAOVIEN`, `MAQL`.
- Tai lieu kien truc moi: `docs/PORTAL-DATA-ARCHITECTURE.md`.
- SQL schema draft: `docs/sql/portal_schema_draft.sql`.
- Benh nhan test hien tai: HIS patient code `23006552`.
- Login hien tai dung xac minh so dien thoai + CCCD/CMND tu Oracle, khong dung OTP.
- Phone lay tu `DIENTHOAI.DIDONG` / `DIENTHOAI.NHA` / `DIENTHOAI.COQUAN`.
- CCCD/CMND lay tu `BTDBN.CMND` / `BTDBN.CMND_BN` / `DIENTHOAI.CMND`.

## File local/secret can giu rieng

Khong commit cac file nay:

- `.env.local`
- `backend/PatientApi/appsettings.Development.json`

`.env.local` dang can co:

```env
NEXT_PUBLIC_DEMO_MODE=false
PATIENT_API_BASE_URL=http://127.0.0.1:5080
PATIENT_API_SERVER_TOKEN=change-this-local-token
```

## Chay backend

Mo PowerShell tai thu muc du an:

```powershell
cd E:\HIS\APP_BENHAN
```

Chay:

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:ASPNETCORE_URLS='http://127.0.0.1:5080'
dotnet run --project backend/PatientApi/PatientApi.csproj --no-restore
```

Test nhanh:

```powershell
curl.exe -H "Authorization: Bearer change-this-local-token" http://127.0.0.1:5080/api/me/summary
curl.exe -H "Authorization: Bearer change-this-local-token" http://127.0.0.1:5080/api/me/visits
```

## Chay frontend

Mo terminal khac:

```powershell
cd E:\HIS\APP_BENHAN
npm run dev -- --port 3001
```

Mo:

```text
http://localhost:3001
```

## Cac module da tich hop Oracle

- Ho so benh nhan: `BTDBN`, `DIENTHOAI`, `BHYT`.
- Dashboard summary: endpoint `GET /api/me/summary`.
- Lich su kham: `HGSOFT_BV.THEODOI_KCB`.
- Chi tiet lan kham: `THEODOI_KCB` theo `MAVAOVIEN`, ghep them chi dinh dich vu theo schema thang.
- Xet nghiem: `XN_PHIEU`, `XN_KETQUA`, `XN_BV_CHITIET`, `XN_TEN`, `XN_DONVI`, `V_GIAVP`.
- CDHA: `SA_BNCDHA`, `SA_BNCDHA_CT`, `XQ_BNCDHA_CTXQ`, `V_CHIDINH`, `V_GIAVP`, `V_LOAIVP`, `DMBS`.

## Cac thay doi quan trong gan nhat

- `BENHANDT` khong con la nguon lich su kham. Da doi sang `THEODOI_KCB` vi bang nay gom ca tiep don/KCB, khong chi dieu tri.
- Dashboard khong load full lab/CDHA nua, ma dung summary endpoint de nhanh hon.
- Trang lab/CDHA da group theo ngay/phieu.
- Trang chi tiet lan kham da hoan thien cac phan:
  - thong tin lan kham
  - chan doan va dien bien
  - dau hieu sinh ton
  - chi dinh dich vu
  - don thuoc neu co du lieu
  - ket qua xet nghiem cua dung luot
  - ket qua CDHA cua dung luot
  - loi dan bac si
- `VisitId` cua lab/CDHA uu tien `MAVAOVIEN` de ghep dung voi chi tiet lan kham.
- Neu `V_CHIDINH` thieu ngay, backend fallback ngay tu prefix ID HIS dang `yyMMdd`.

## Lenh kiem tra chat luong

```powershell
dotnet build backend/PatientApi/PatientApi.csproj --no-restore --no-incremental
npm run build
```

Ket qua gan nhat:

- `dotnet build`: pass
- `npm run build`: pass
- `http://localhost:3001/visits/260716130829833187`: HTTP 200

## File nen doc truoc khi tiep tuc

- `backend/PatientApi/Repositories/OracleHisPatientRepository.cs`
- `backend/PatientApi/Models/PatientModels.cs`
- `src/app/(portal)/dashboard/page.tsx`
- `src/app/(portal)/visits/page.tsx`
- `src/app/(portal)/visits/[id]/page.tsx`
- `src/app/(portal)/lab-results/page.tsx`
- `src/app/(portal)/imaging/page.tsx`
- `src/lib/data/api-patient-repository.ts`
- `src/types/patient.ts`

## Ghi chu van hanh

- Neu chay `npm run build` trong luc Next dev server dang chay, nen restart lai Next dev server sau do.
- Neu `dotnet build` bao file `PatientApi.exe` bi lock, dung backend PatientApi dang chay roi build lai.
- Oracle chi duoc goi tu backend; browser/Next client chi goi qua `/api/me/...`.
- Client khong nhan `mabn` tu URL. Benh nhan hien tai duoc xac dinh qua session/token demo.
