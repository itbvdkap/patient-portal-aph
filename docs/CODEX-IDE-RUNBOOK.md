# Codex IDE Runbook

Muc dich: mo lai du an trong Codex IDE va chay nhanh frontend + backend that.

## Thu muc du an

```text
E:\HIS\APP_BENHAN
```

## Terminal 1: Reporting DB

```powershell
cd E:\HIS\APP_BENHAN
docker compose -f docker-compose.reporting.yml up -d
```

Reporting DB chi luu du lieu portal. Sync Worker la thanh phan duy nhat doc Oracle HIS.
Khi DB da healthy, bat backend local sang reporting:

```powershell
$env:PatientPortal__DataMode='Reporting'
```

Neu Docker/PostgreSQL chua chay, `appsettings.Development.json` tam giu `OracleDirect` de app local khong bi gian doan. Moi truong public bat buoc `Reporting` trong `docker-compose.public.yml`.

## Terminal 2: Backend

```powershell
cd E:\HIS\APP_BENHAN
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:ASPNETCORE_URLS='http://127.0.0.1:5080'
dotnet run --project backend/PatientApi/PatientApi.csproj --no-restore
```

Backend URL:

```text
http://127.0.0.1:5080
```

Health check bang API that:

```powershell
curl.exe -H "Authorization: Bearer change-this-local-token" http://127.0.0.1:5080/api/me/summary
```

## Terminal 3: Frontend

```powershell
cd E:\HIS\APP_BENHAN
npm run dev -- --port 3001
```

Frontend URL:

```text
http://localhost:3001
```

## Login test

- Dang nhap bang so dien thoai + CCCD/CMND da dang ky trong Oracle.
- Phone lay tu `DIENTHOAI.DIDONG` / `DIENTHOAI.NHA` / `DIENTHOAI.COQUAN`.
- CCCD/CMND lay tu `BTDBN.CMND` / `BTDBN.CMND_BN` / `DIENTHOAI.CMND`.
- Sau khi xac minh thanh cong, portal lay HIS patient code `MABN` de load du lieu.

## Pages can test nhanh

```text
http://localhost:3001/dashboard
http://localhost:3001/visits
http://localhost:3001/visits/260716130829833187
http://localhost:3001/lab-results
http://localhost:3001/imaging
```

## Neu co loi thuong gap

- Next bao cross origin tu IP LAN: local test van dung `http://localhost:3001`; sau nay co the them `allowedDevOrigins` trong `next.config.ts` neu can truy cap bang IP.
- `PatientApi.exe` bi lock khi build: dung process backend dang chay roi build lai.
- Sau `npm run build`: restart lai `npm run dev -- --port 3001`.
- Neu API 401: kiem tra `PATIENT_API_SERVER_TOKEN` trong `.env.local` co trung token backend khong.

## Tai lieu can doc tiep

Doc chi tiet trang thai du an tai:

```text
docs/CONTINUE-AFTER-RESTART.md
```
