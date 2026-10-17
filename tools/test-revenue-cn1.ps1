[CmdletBinding()]
param(
  [string]$EnvPath='E:\HIS\APP_BENHAN\artifacts\patientapi-service.env',
  [string]$AgentDll='E:\HIS\APP_BENHAN\backend\PatientApi\bin\Debug\net9.0\PatientApi.dll',
  [int]$Port=5096,
  [string]$From='2026-10-14T00:00:00',
  [string]$To='2026-10-14T23:59:59'
)
$ErrorActionPreference='Stop'
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'Test port already in use; existing process preserved.'}
$revSettings=@{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {if($_ -match '^([^#=\s]+)=(.*)$'){$revSettings[$matches[1]]=$matches[2].Trim().Trim('"')}}
if($revSettings['PatientPortal__BranchCode'] -ne 'CN1'){throw 'CN1 configuration required.'}
$revToken=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$revBase="http://127.0.0.1:$Port"
$revLogs=Join-Path $PSScriptRoot '..\artifacts\revenue-test'
New-Item -ItemType Directory -Force -Path $revLogs | Out-Null
$revEnv=@{
  ASPNETCORE_ENVIRONMENT='Production';ASPNETCORE_URLS=$revBase
  PatientPortal__BranchCode='CN1';PatientPortal__DataMode='OracleDirect';PatientPortal__DisableHttpsRedirection='true'
  PatientPortal__EnableSupabaseQueueAgent='false';PatientPortal__EnableBookingHisMatchWorker='false'
  PatientPortal__EnableBookingHisOnlineSyncWorker='false';PatientPortal__EnableNotificationOutboxWorker='false';KskCloud__Enabled='false'
  Ksk__Enabled='true';Ksk__ServerToken=$revToken;Ksk__MasterSchema='HGSOFT_BV';Ksk__MonthlySchemaPrefix='HGSOFT_BV'
  ConnectionStrings__OracleKskReadOnly=$(if($revSettings['ConnectionStrings__OracleKskReadOnly']){$revSettings['ConnectionStrings__OracleKskReadOnly']}else{$revSettings['ConnectionStrings__OracleHis']})
}
$revProcess=$null
try {
  $revProcess=Start-Process -FilePath 'dotnet' -ArgumentList @($AgentDll,'--urls',$revBase) -Environment $revEnv -WorkingDirectory (Join-Path $PSScriptRoot '..') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $revLogs 'agent.stdout.log') -RedirectStandardError (Join-Path $revLogs 'agent.stderr.log')
  for($revAttempt=0;$revAttempt -lt 40;$revAttempt++){
    if($revProcess.HasExited){throw 'Revenue test agent exited; see protected local logs.'}
    try {$null=Invoke-RestMethod "$revBase/health" -TimeoutSec 2;break}catch{Start-Sleep -Milliseconds 300}
  }
  $revQuery="from=$([Uri]::EscapeDataString($From))&to=$([Uri]::EscapeDataString($To))"
  $revDenied=Invoke-WebRequest "$revBase/api/internal/vienphi-revenue?$revQuery" -SkipHttpErrorCheck -TimeoutSec 10
  if($revDenied.StatusCode -ne 403){throw 'Internal endpoint did not reject anonymous access.'}
  $revInvalid=Invoke-WebRequest "$revBase/api/internal/vienphi-revenue?from=invalid&to=invalid" -Headers @{'X-Ksk-Token'=$revToken} -SkipHttpErrorCheck -TimeoutSec 10
  if($revInvalid.StatusCode -ne 400){throw 'Internal endpoint did not reject invalid timestamps.'}
  $revResponse=Invoke-WebRequest "$revBase/api/internal/vienphi-revenue?$revQuery" -Headers @{'X-Ksk-Token'=$revToken} -UseBasicParsing -TimeoutSec 65
  $revData=$revResponse.Content | ConvertFrom-Json
  if($revData.scope.branch -ne 'CN1' -or $revData.scope.reportType -ne 'cashier' -or $revData.scope.from -ne $From -or $revData.scope.to -ne $To){throw 'Revenue scope mismatch.'}
  $revResponse.Content | & node (Join-Path $PSScriptRoot 'audit-revenue-snapshot.mjs')
  if($LASTEXITCODE -ne 0){throw 'Receipt policy audit failed.'}
  [pscustomobject]@{Branch=$revData.scope.branch;Status=$revResponse.StatusCode;ReceiptCount=@($revData.receipts).Count;Sources=$revData.sections;Kinds=@($revData.receipts | Group-Object kind | ForEach-Object {[pscustomobject]@{Kind=$_.Name;Count=$_.Count}})} | ConvertTo-Json -Depth 6
  # Print counts only. No patient records, credentials or actual monetary values.
} finally {if($revProcess -and -not $revProcess.HasExited){Stop-Process -Id $revProcess.Id -Force}}
