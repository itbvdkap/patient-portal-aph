# PatientApi Windows Service

Use this package for the internal hospital sync agent. The public portal stays on Vercel; this service only polls Supabase jobs, reads Oracle HIS, and writes snapshots back to Supabase.

## Build package on dev machine

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows-service\publish-patientapi-agent.ps1
```

Output:

```text
artifacts\patientapi-agent-win-x64
artifacts\patientapi-agent-win-x64.zip
```

## Check Windows Server 2012 environment

Copy the package to the server, then run PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\check-windows2012-env.ps1 -SupabaseUrl "https://your-project.supabase.co" -OracleHost "192.168.2.250" -OraclePort 1521
```

If TLS 1.2 is not enabled on Windows Server 2012, run as Administrator and restart Windows:

```powershell
.\enable-tls12-windows2012.ps1
Restart-Computer
```

## Configure service

Copy:

```text
patientapi-service.env.example -> patientapi-service.env
```

Fill these values:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
AUTH_SYNC_ENCRYPTION_KEY=
ConnectionStrings__OracleHis=
```

`AUTH_SYNC_ENCRYPTION_KEY` must match the Vercel environment variable with the same name.

## Install

Run as Administrator inside the published folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-patientapi-service.ps1
```

Check:

```powershell
Get-Service AnPhuPatientPortalSyncAgent
Invoke-RestMethod http://127.0.0.1:5080/health
Get-EventLog -LogName Application -Newest 50 | Where-Object { $_.Source -like "*Patient*" -or $_.Message -like "*Supabase*" }
```

## Uninstall

```powershell
.\uninstall-patientapi-service.ps1
```
