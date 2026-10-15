[CmdletBinding()]
param(
  [string]$EnvPath = 'E:\HIS\APP_BENHAN\artifacts\patientapi-service.env',
  [string]$AgentPath = 'E:\HIS\APP_BENHAN\artifacts\patientapi-agent-cloud-20261015\PatientApi.exe',
  [int]$Port = 5095,
  [string]$From = '2026-08-01',
  [string]$To = '2026-10-14',
  [string]$Cohort = '260819155634396016'
)
$ErrorActionPreference = 'Stop'
$settings = @{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {
  if ($_ -match '^([^#=\s]+)=(.*)$') { $settings[$matches[1]] = $matches[2].Trim().Trim('"') }
}
if ($settings['PatientPortal__BranchCode'] -ne 'CN1') { throw 'Cloud smoke test only allows CN1.' }
if ($settings['PatientPortal__NotificationOutboxAutoSendEnabled'] -ne 'false') { throw 'Refusing while Zalo auto-send is enabled.' }
foreach ($key in @('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ConnectionStrings__OracleKskReadOnly','Ksk__ServerToken')) {
  if ([string]::IsNullOrWhiteSpace($settings[$key])) { throw "Missing protected setting: $key" }
}
$resolvedAgent = (Resolve-Path -LiteralPath $AgentPath).Path
$agentBase = "http://127.0.0.1:$Port"
$settings['ASPNETCORE_URLS'] = $agentBase
$settings['KskCloud__LocalApiBase'] = $agentBase
$settings['KskCloud__Enabled'] = 'true'
$settings['PatientPortal__EnableSupabaseQueueAgent'] = 'false'
$settings['PatientPortal__EnableBookingHisMatchWorker'] = 'false'
$settings['PatientPortal__EnableBookingHisOnlineSyncWorker'] = 'false'
$settings['PatientPortal__EnableNotificationOutboxWorker'] = 'false'
$logDirectory = Join-Path (Split-Path $resolvedAgent) 'cloud-smoke-logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$process = $null
try {
  $process = Start-Process -FilePath $resolvedAgent -Environment $settings -WorkingDirectory (Split-Path $resolvedAgent) -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDirectory 'stdout.log') -RedirectStandardError (Join-Path $logDirectory 'stderr.log')
  $started = $process.StartTime.ToUniversalTime()
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ($process.HasExited) { throw 'Cloud smoke-test agent exited during startup.' }
    try { $health = Invoke-RestMethod -Uri "$agentBase/health" -TimeoutSec 2; if ($health.branchCode -eq 'CN1') { break } } catch {}
    Start-Sleep -Milliseconds 250
  }
  if ($health.branchCode -ne 'CN1') { throw 'Cloud smoke-test agent health check failed.' }
  & node (Join-Path $PSScriptRoot 'ksk-cloud-smoke-client.mjs') $EnvPath $From $To $Cohort
  if ($LASTEXITCODE -ne 0) { throw 'Cloud smoke client failed.' }
} finally {
  if ($process) {
    $current = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
    if ($current -and $current.Path -eq $resolvedAgent -and $current.StartTime.ToUniversalTime().Ticks -eq $started.Ticks) { Stop-Process -Id $current.Id -Force }
  }
}
