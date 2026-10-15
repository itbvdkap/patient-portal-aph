param([int]$Port = 5094)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskDll = Join-Path $taskRoot 'backend\PatientApi\bin\Debug\net9.0\PatientApi.dll'
if (-not (Test-Path -LiteralPath $taskDll)) { throw 'Build PatientApi Debug first.' }
$taskBase = "http://127.0.0.1:$Port"
$taskSecret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$taskEnvironment = @{
  ASPNETCORE_ENVIRONMENT='Production'; ASPNETCORE_URLS=$taskBase
  PatientPortal__DataMode='OracleDirect'; PatientPortal__DisableHttpsRedirection='true'
  PatientPortal__EnableSupabaseQueueAgent='false'; PatientPortal__EnableBookingHisMatchWorker='false'
  PatientPortal__EnableBookingHisOnlineSyncWorker='false'; PatientPortal__EnableNotificationOutboxWorker='false'
  Ksk__Enabled='false'; Ksk__ServerToken=$taskSecret
  Ksk__MasterSchema='HGSOFT_BV'; Ksk__MonthlySchemaPrefix='HGSOFT_BV'; Ksk__ClinicalSchema='HGSOFT_BV'
  # Intentionally invalid: authorized smoke requests must never contact Oracle.
  ConnectionStrings__OracleKskReadOnly='invalid-smoke-test-configuration'
}
$taskPrevious = @{}
$taskProcess = $null
$taskLogDir = Join-Path $taskRoot 'artifacts\ksk-smoke'
New-Item -ItemType Directory -Path $taskLogDir -Force | Out-Null
Add-Type -AssemblyName System.Net.Http
$taskClient = [System.Net.Http.HttpClient]::new()
$taskClient.Timeout = [TimeSpan]::FromSeconds(5)
function Start-TestAgent {
  $script:taskProcess = Start-Process -FilePath 'dotnet' -ArgumentList @($taskDll, '--urls', $taskBase) -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'agent.stdout.log') -RedirectStandardError (Join-Path $taskLogDir 'agent.stderr.log')
  for ($taskAttempt=0; $taskAttempt -lt 20; $taskAttempt++) {
    if ($taskProcess.HasExited) { throw 'Test agent exited before readiness.' }
    try { if (($taskClient.GetAsync("$taskBase/health").GetAwaiter().GetResult()).IsSuccessStatusCode) { return } } catch { }
    Start-Sleep -Milliseconds 250
  }
  throw 'Test agent readiness timeout.'
}
function Assert-Status([string]$Path, [int]$Expected, [bool]$Authorized=$false, [string]$Method='GET') {
  $taskRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$taskBase$Path")
  if ($Authorized) { $taskRequest.Headers.Add('X-Ksk-Token', $taskSecret) }
  $taskResponse = $taskClient.SendAsync($taskRequest).GetAwaiter().GetResult()
  if ([int]$taskResponse.StatusCode -ne $Expected) { throw "Expected $Expected; got $([int]$taskResponse.StatusCode)" }
  if ($Path.StartsWith('/api/internal/ksk') -and $taskResponse.Headers.CacheControl -and -not $taskResponse.Headers.CacheControl.NoStore) { throw 'Missing no-store.' }
  $taskResponse.Dispose(); $taskRequest.Dispose()
  Write-Output "PASS $Method -> $Expected"
}
try {
  foreach ($taskKey in $taskEnvironment.Keys) {
    $taskPrevious[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey, 'Process')
    [Environment]::SetEnvironmentVariable($taskKey, $taskEnvironment[$taskKey], 'Process')
  }
  Start-TestAgent
  Assert-Status '/api/internal/ksk' 404
  $taskProcess.Kill(); $taskProcess.WaitForExit()
  [Environment]::SetEnvironmentVariable('Ksk__Enabled', 'true', 'Process')
  Start-TestAgent
  Assert-Status '/api/internal/ksk' 403
  Assert-Status '/api/internal/ksk' 405 $true 'POST'
  Assert-Status '/api/internal/ksk?from=2026-02-30&to=2026-03-01' 400 $true
  Assert-Status '/api/internal/ksk?from=2026-01-01&to=2026-10-14' 400 $true
  Assert-Status '/api/internal/ksk?from=2026-10-01&to=2026-10-14&cohort=1%20or%201=1' 400 $true
  Assert-Status '/api/internal/ksk?from=2026-10-01&to=2026-10-14&cohort=900001' 503 $true
  Write-Output 'KSK agent smoke passed. No Oracle connection or HIS writes attempted.'
} finally {
  if ($taskProcess -and -not $taskProcess.HasExited) { $taskProcess.Kill(); $taskProcess.WaitForExit() }
  $taskClient.Dispose()
  foreach ($taskKey in $taskPrevious.Keys) { [Environment]::SetEnvironmentVariable($taskKey, $taskPrevious[$taskKey], 'Process') }
}
