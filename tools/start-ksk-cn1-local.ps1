[CmdletBinding()]
param(
  [string]$EnvPath='E:\HIS\APP_BENHAN\artifacts\patientapi-service.env',
  [int]$AgentPort=5094,
  [int]$WebPort=3014,
  [switch]$EnableKskChangeLab,
  [switch]$EnableKskManagement,
  [switch]$Stop
)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskStatePath=Join-Path $taskRoot 'artifacts\ksk-cn1-local-processes.json'
function Test-LocalProcessIdentity($Entry, $Process){
  if(-not $Process -or $Process.Path -ne $Entry.path){return $false}
  # PowerShell 7.5 may already deserialize an ISO date as DateTime. Do not round-trip through locale text.
  $taskStarted=if($Entry.started -is [datetime]){$Entry.started.ToUniversalTime()}else{
    [datetime]::Parse($Entry.started,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
  }
  return $Process.StartTime.ToUniversalTime().Ticks -eq $taskStarted.Ticks
}
if($Stop){
  if(Test-Path -LiteralPath $taskStatePath){
    $taskState=Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
    foreach($taskEntry in $taskState.processes){
      $taskProcess=Get-Process -Id $taskEntry.id -ErrorAction SilentlyContinue
      if(Test-LocalProcessIdentity $taskEntry $taskProcess){
        & taskkill /PID $taskProcess.Id /T /F | Out-Null
      }
    }
    Write-Output 'Stopped only matching local KSK process trees. Hospital services unchanged.'
  }
  exit
}
if(Test-Path -LiteralPath $taskStatePath){
  $taskState=Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
  foreach($taskEntry in $taskState.processes){
    $taskRunning=Get-Process -Id $taskEntry.id -ErrorAction SilentlyContinue
    if(Test-LocalProcessIdentity $taskEntry $taskRunning){throw 'Local KSK is already running; stop it with this script -Stop before restarting.'}
  }
}
$taskSettings=@{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {if($_ -match '^([^#=\s]+)=(.*)$'){$taskSettings[$matches[1]]=$matches[2].Trim().Trim('"')}}
if($taskSettings['PatientPortal__BranchCode'] -ne 'CN1'){throw 'Refusing non-CN1 configuration.'}
if(-not $taskSettings['ConnectionStrings__OracleHis']){throw 'Existing CN1 Oracle connection not configured.'}
$taskAgentBase="http://127.0.0.1:$AgentPort"
$taskWebBase="http://127.0.0.1:$WebPort"
$taskToken=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$taskManagementToken=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$taskLogs=Join-Path $taskRoot 'artifacts\ksk-cn1-local'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
$taskAgentEnv=@{
  ASPNETCORE_ENVIRONMENT='Production'; ASPNETCORE_URLS=$taskAgentBase
  PatientPortal__BranchCode='CN1'; PatientPortal__DataMode='OracleDirect';PatientPortal__DisableHttpsRedirection='true'
  PatientPortal__EnableSupabaseQueueAgent='false';PatientPortal__EnableBookingHisMatchWorker='false'
  PatientPortal__EnableBookingHisOnlineSyncWorker='false';PatientPortal__EnableNotificationOutboxWorker='false'
  Ksk__Enabled='true';Ksk__ServerToken=$taskToken
  # Explicit operator-authorized LOCAL TEST reuse; repository still has no automatic writable fallback.
  ConnectionStrings__OracleKskReadOnly=$taskSettings['ConnectionStrings__OracleHis']
  Ksk__MasterSchema='HGSOFT_BV';Ksk__MonthlySchemaPrefix='HGSOFT_BV';Ksk__ClinicalSchema='HGSOFT_BV'
  KskManagement__Enabled=$(if($EnableKskManagement){'true'}else{'false'});KskManagement__ServerToken=$taskManagementToken
  KskManagement__WriteEnabled='false'
}
$taskWebEnv=@{KSK_ENABLED='true';KSK_DATA_MODE='his';KSK_API_BASE_URL=$taskAgentBase;KSK_API_SERVER_TOKEN=$taskToken;NODE_ENV='development';VERCEL=''}
$taskStaffDir=Join-Path $taskRoot 'artifacts\admin-staff'
New-Item -ItemType Directory -Path $taskStaffDir -Force | Out-Null
$taskOperator=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $taskStaffDir /inheritance:r /grant:r "$($taskOperator):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect staff credential directory.'}
$taskWebEnv['ADMIN_STAFF_ENABLED']='true'
$taskWebEnv['ADMIN_STAFF_STORE_PATH']=Join-Path $taskStaffDir 'users.json'
$taskWebEnv['KSK_CHANGE_LAB_ENABLED']=if($EnableKskChangeLab){'true'}else{'false'}
$taskWebEnv['KSK_CHANGE_STORE_PATH']=Join-Path $taskStaffDir 'ksk-change-lab.json'
$taskWebEnv['KSK_MANAGEMENT_ENABLED']=if($EnableKskManagement){'true'}else{'false'}
$taskWebEnv['KSK_MANAGEMENT_TOKEN']=$taskManagementToken
$taskWebEnv['KSK_MANAGEMENT_BRANCH']='CN1'
$taskWebEnv['KSK_MANAGEMENT_STORE_PATH']=Join-Path $taskStaffDir 'ksk-management.enc'
$taskDll=Join-Path $taskRoot 'backend\PatientApi\bin\Debug\net9.0\PatientApi.dll'
$taskNext=Join-Path $taskRoot 'node_modules\next\dist\bin\next'
$taskProcesses=@()
$taskSuccess=$false
Add-Type -AssemblyName System.Net.Http
$taskClient=[System.Net.Http.HttpClient]::new()
$taskClient.Timeout=[TimeSpan]::FromSeconds(60)
$taskClient.DefaultRequestHeaders.Add('X-Ksk-Token',$taskToken)
function Read-LocalKsk([string]$Path){
  $taskResponse=$taskClient.GetAsync("$taskAgentBase$Path").GetAwaiter().GetResult()
  try {
    if(-not $taskResponse.IsSuccessStatusCode){throw "Local KSK API failed with HTTP $([int]$taskResponse.StatusCode); no response records printed."}
    return ($taskResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json)
  } finally {$taskResponse.Dispose()}
}
try{
  $taskAgent=Start-Process -FilePath 'dotnet' -ArgumentList @($taskDll,'--urls',$taskAgentBase) -Environment $taskAgentEnv -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogs 'agent.stdout.log') -RedirectStandardError (Join-Path $taskLogs 'agent.stderr.log')
  $taskProcesses+= $taskAgent
  for($taskAttempt=0;$taskAttempt -lt 30;$taskAttempt++){
    if($taskAgent.HasExited){throw 'Local test agent exited.'}
    try {$taskHealth=Read-LocalKsk '/health';if($taskHealth.branchCode -eq 'CN1'){break}}catch{}
    Start-Sleep -Milliseconds 250
  }
  $taskData=Read-LocalKsk '/api/internal/ksk?from=2026-08-01&to=2026-10-14'
  if($taskData.scope.branch -ne 'CN1' -or $taskData.scope.mode -ne 'his'){throw 'Incorrect branch/mode.'}
  $taskCohort=@($taskData.cohorts | Where-Object {($_.name -match 'Hoàng.*Phương|Hoang.*Phuong') -or ($_.customer -match 'Hoàng.*Phương|Hoang.*Phuong')} | Select-Object -First 1)
  if($taskCohort.Count -gt 0){
    $taskData=Read-LocalKsk ("/api/internal/ksk?from=2026-08-01&to=2026-10-14&cohort="+$taskCohort[0].id)
  }
  # Metadata, flags and counts only. Never persist clinical/patient payloads or secrets.
  [pscustomobject]@{Branch=$taskData.scope.branch;Mode=$taskData.scope.mode;CohortCount=@($taskData.cohorts).Count;Members=@($taskData.members).Count;Visits=@($taskData.visits).Count;Charges=@($taskData.charges).Count;Clinical=@($taskData.clinical).Count;Labs=@($taskData.labs).Count;Imaging=@($taskData.imaging).Count;Sections=$taskData.sections;Warnings=$taskData.warnings} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskLogs 'audit-counts.json') -Encoding UTF8
  Write-Output ('CN1 real-data read: cohorts={0}; members={1}; visits={2}; charges={3}; labs={4}; imaging={5}' -f @($taskData.cohorts).Count,@($taskData.members).Count,@($taskData.visits).Count,@($taskData.charges).Count,@($taskData.labs).Count,@($taskData.imaging).Count)
  $taskData.warnings | ForEach-Object {Write-Output "Scope: $_"}
  $taskWeb=Start-Process -FilePath 'node' -ArgumentList @($taskNext,'dev','-H','127.0.0.1','-p',"$WebPort") -Environment $taskWebEnv -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogs 'web.stdout.log') -RedirectStandardError (Join-Path $taskLogs 'web.stderr.log')
  $taskProcesses+= $taskWeb
  $taskProcessInfo=@($taskProcesses | ForEach-Object {[pscustomobject]@{id=$_.Id;started=$_.StartTime.ToUniversalTime().ToString('O');path=$_.Path}})
  [pscustomobject]@{processes=$taskProcessInfo;web=$taskWebBase;agent=$taskAgentBase} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $taskStatePath -Encoding UTF8
  $taskUrl="$taskWebBase/admin/ksk?from=2026-08-01&to=2026-10-14"
  if($taskCohort.Count -gt 0){$taskUrl+='&cohort='+$taskCohort[0].id}
  Write-Output "Local URL: $taskUrl"
  Write-Output 'Oracle credential and KSK token only in child-process environment; existing env files/services unchanged.'
  $taskSuccess=$true
} finally {
  $taskClient.Dispose()
  if(-not $taskSuccess){foreach($taskProcess in $taskProcesses){if(-not $taskProcess.HasExited){& taskkill /PID $taskProcess.Id /T /F | Out-Null}}}
}
