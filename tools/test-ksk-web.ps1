param([int]$Port = 3014)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskBase = "http://127.0.0.1:$Port"
$taskPassword = [Guid]::NewGuid().ToString('N')
$taskEnvironment = @{
  KSK_ENABLED='true'; KSK_DATA_MODE='demo'; VERCEL=''; NODE_ENV='development'
  PORTAL_SESSION_SECRET=([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
  ADMIN_USERS_JSON=(@(@{username='ksk-test-admin';password=$taskPassword;role='super_admin'}, @{username='ksk-test-support';password=$taskPassword;role='support'}) | ConvertTo-Json -Compress)
}
$taskPrevious = @{}
$taskProcess = $null
$taskLogDir = Join-Path $taskRoot 'artifacts\ksk-smoke'
New-Item -ItemType Directory -Path $taskLogDir -Force | Out-Null
Add-Type -AssemblyName System.Net.Http
$taskHandler = [System.Net.Http.HttpClientHandler]::new()
$taskHandler.AllowAutoRedirect = $false
$taskClient = [System.Net.Http.HttpClient]::new($taskHandler)
$taskClient.Timeout = [TimeSpan]::FromSeconds(45)
function Get-Check([string]$Path, [int]$Status) {
  $taskResponse = $taskClient.GetAsync("$taskBase$Path").GetAwaiter().GetResult()
  if ([int]$taskResponse.StatusCode -ne $Status) { throw "Expected $Status; got $([int]$taskResponse.StatusCode)" }
  Write-Host "PASS web GET -> $Status"
  return $taskResponse
}
function Login-Test([string]$UserName) {
  $taskPayload = @{username=$UserName;password=$taskPassword} | ConvertTo-Json -Compress
  $taskContent = [System.Net.Http.StringContent]::new($taskPayload,[System.Text.Encoding]::UTF8,'application/json')
  $taskResponse = $taskClient.PostAsync("$taskBase/api/admin/login",$taskContent).GetAwaiter().GetResult()
  if ([int]$taskResponse.StatusCode -ne 200) { throw 'Local smoke login failed.' }
  $taskResponse.Dispose(); $taskContent.Dispose()
}
try {
  foreach($taskKey in $taskEnvironment.Keys) {
    $taskPrevious[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey,'Process')
    [Environment]::SetEnvironmentVariable($taskKey,$taskEnvironment[$taskKey],'Process')
  }
  $taskNext = Join-Path $taskRoot 'node_modules\next\dist\bin\next'
  $taskProcess = Start-Process -FilePath 'node' -ArgumentList @($taskNext,'dev','-H','127.0.0.1','-p',"$Port") -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'web.stdout.log') -RedirectStandardError (Join-Path $taskLogDir 'web.stderr.log')
  for($taskAttempt=0;$taskAttempt -lt 40;$taskAttempt++) {
    if($taskProcess.HasExited) { throw 'Web smoke process exited.' }
    try { $taskProbe=$taskClient.GetAsync("$taskBase/api/admin/ksk").GetAwaiter().GetResult(); if([int]$taskProbe.StatusCode -eq 401){$taskProbe.Dispose();break};$taskProbe.Dispose() } catch { }
    Start-Sleep -Milliseconds 250
  }
  $taskPath='/api/admin/ksk?from=2026-10-01&to=2026-10-14&cohort=900001'
  $taskResponse=Get-Check $taskPath 401; $taskResponse.Dispose()
  Login-Test 'ksk-test-support'
  $taskResponse=Get-Check $taskPath 403; $taskResponse.Dispose()
  $taskResponse=Get-Check '/admin/ksk' 307; $taskResponse.Dispose()
  Login-Test 'ksk-test-admin'
  $taskResponse=Get-Check $taskPath 200
  $taskData=$taskResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
  if($taskData.scope.mode -ne 'demo' -or $taskData.members.Count -ne 3){throw 'Wrong synthetic snapshot.'}
  if(-not $taskResponse.Headers.CacheControl.NoStore){throw 'API is cacheable.'}
  $taskResponse.Dispose()
  $taskResponse=Get-Check '/admin/ksk?from=2026-10-01&to=2026-10-14&cohort=900001' 200
  $taskHtml=$taskResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if($taskHtml -notmatch '250.000' -or $taskHtml -notmatch 'DEMO001'){throw 'Dashboard SSR content missing.'}
  if($taskHtml.Contains($taskPassword)){throw 'Credential leaked into page.'}
  if(-not $taskResponse.Headers.CacheControl.NoStore){throw 'Page is cacheable.'}
  $taskResponse.Dispose()
  Write-Output 'KSK web smoke passed. Synthetic data only; no HIS connection.'
} finally {
  # Next dev spawns a child server: terminate only this owned PID tree.
  if($taskProcess -and -not $taskProcess.HasExited) { & taskkill /PID $taskProcess.Id /T /F | Out-Null }
  $taskClient.Dispose()
  foreach($taskKey in $taskPrevious.Keys){[Environment]::SetEnvironmentVariable($taskKey,$taskPrevious[$taskKey],'Process')}
}
