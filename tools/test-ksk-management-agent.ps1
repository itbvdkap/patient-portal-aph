[CmdletBinding()]
param([int]$Port=5098)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'Test port occupied; refusing to touch existing process.'}
$taskBase="http://127.0.0.1:$Port";$taskToken=([guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'))
$taskEnv=@{ASPNETCORE_ENVIRONMENT='Production';ASPNETCORE_URLS=$taskBase;KskManagement__Enabled='true';KskManagement__ServerToken=$taskToken;KskManagement__WriteEnabled='false';
  PatientPortal__DisableHttpsRedirection='true';PatientPortal__EnableSupabaseQueueAgent='false';PatientPortal__EnableBookingHisMatchWorker='false';PatientPortal__EnableBookingHisOnlineSyncWorker='false';PatientPortal__EnableNotificationOutboxWorker='false';
  ConnectionStrings__OracleKskReadOnly='';ConnectionStrings__OracleKskWrite=''}
$taskProcess=Start-Process -FilePath 'dotnet' -ArgumentList @((Join-Path $taskRoot 'backend\PatientApi\bin\Debug\net9.0\PatientApi.dll'),'--urls',$taskBase) -Environment $taskEnv -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot 'artifacts\ksk-management-agent-smoke.stdout.log') -RedirectStandardError (Join-Path $taskRoot 'artifacts\ksk-management-agent-smoke.stderr.log')
$taskClient=[System.Net.Http.HttpClient]::new();$taskClient.Timeout=[timespan]::FromSeconds(10);$taskCount=0
function Check([string]$Method,[string]$Path,[int]$Status,$Payload=$null){
  $taskRequest=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method),"$taskBase$Path")
  if($Payload){$taskRequest.Content=[System.Net.Http.StringContent]::new(($Payload|ConvertTo-Json -Depth 8 -Compress),[Text.Encoding]::UTF8,'application/json')}
  try{$taskResponse=$taskClient.SendAsync($taskRequest).GetAwaiter().GetResult();try{if([int]$taskResponse.StatusCode -ne $Status){throw "Expected $Status; got $([int]$taskResponse.StatusCode); no response records logged."};$script:taskCount++}finally{$taskResponse.Dispose()}}finally{$taskRequest.Dispose()}
}
try{
  for($taskAttempt=0;$taskAttempt -lt 40;$taskAttempt++){
    if($taskProcess.HasExited){throw 'Isolated test agent exited.'}
    try{$taskHealth=$taskClient.GetAsync("$taskBase/health").GetAwaiter().GetResult();$taskReady=$taskHealth.IsSuccessStatusCode;$taskHealth.Dispose();if($taskReady){break}}catch{}
    Start-Sleep -Milliseconds 200
  }
  Check GET '/api/internal/ksk-management' 403
  $taskClient.DefaultRequestHeaders.Add('X-Ksk-Management-Token',$taskToken)
  Check GET '/api/internal/ksk-management?from=2026-02-30&to=2026-03-01' 400
  Check GET '/api/internal/ksk-management?patient=not-valid' 400
  $taskCommand=@{commandId=[guid]::NewGuid().ToString();cohortId='2';from='2026-10-01';to='2026-10-14';expectedVersion=('a'*64);proposal=@{kind='customer';key='NEW';fields=@{ten='SYNTHETIC NO WRITE';stt='1'};items=@()};author='maker';reviewer='reviewer';appliedBy='operator';reason='Synthetic guard test'}
  Check POST '/api/internal/ksk-management/apply' 503 $taskCommand
  $taskCommand.reviewer='maker';Check POST '/api/internal/ksk-management/apply' 400 $taskCommand
  $taskCommand.reviewer='reviewer';$taskCommand['unexpected']='blocked';Check POST '/api/internal/ksk-management/apply' 400 $taskCommand
  Write-Output "KSK management transport: $taskCount checks passed. Isolated agent; no Oracle connection or writes."
}finally{
  $taskClient.Dispose();if(-not $taskProcess.HasExited){& taskkill /PID $taskProcess.Id /T /F | Out-Null}
}
