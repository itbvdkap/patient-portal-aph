[CmdletBinding()]
param([switch]$InstallStartup,[switch]$UninstallStartup,[switch]$NoBrowser,[switch]$SkipFirewall)
$ErrorActionPreference='Stop'
$cn1Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Windows ships powershell.exe; locate PowerShell 7 without requiring 'pwsh' on PATH.
if($PSVersionTable.PSVersion.Major -lt 7){
  $cn1Runtime=@(
    (Get-Command pwsh.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    (Join-Path $env:ProgramFiles 'PowerShell\7\pwsh.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe')
  ) | Where-Object {$_ -and (Test-Path -LiteralPath $_)} | Select-Object -First 1
  if(-not $cn1Runtime){throw 'PowerShell 7 not found. Install PowerShell 7, then run this BAT again.'}
  & $cn1Runtime -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @PSBoundParameters
  exit $LASTEXITCODE
}
$cn1Startup=Join-Path ([Environment]::GetFolderPath('Startup')) 'AnPhu-Admin-CN1.lnk'
if($InstallStartup -and $UninstallStartup){throw 'Choose InstallStartup or UninstallStartup, not both.'}
if(($InstallStartup -or $UninstallStartup) -and (Test-Path -LiteralPath $cn1Startup)){
  $cn1ExistingShell=New-Object -ComObject WScript.Shell
  $cn1ExistingShortcut=$cn1ExistingShell.CreateShortcut($cn1Startup)
  if(-not $cn1ExistingShortcut.Arguments.Contains($PSCommandPath)){throw 'Startup shortcut belongs to another installation; it was preserved.'}
}
if($UninstallStartup){
  if(Test-Path -LiteralPath $cn1Startup){Remove-Item -LiteralPath $cn1Startup}
  Write-Output 'Removed only AnPhu-Admin-CN1 startup shortcut. Run the BAT manually when needed.'
  exit
}
if($InstallStartup){
  $cn1Shell=New-Object -ComObject WScript.Shell
  $cn1Shortcut=$cn1Shell.CreateShortcut($cn1Startup)
  $cn1Shortcut.TargetPath=Join-Path $PSHOME 'pwsh.exe'
  $cn1Shortcut.Arguments='-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -NoBrowser -SkipFirewall'
  $cn1Shortcut.WorkingDirectory=$cn1Root; $cn1Shortcut.WindowStyle=7
  $cn1Shortcut.Description='Start An Phu admin CN1 LAN after Windows sign-in'
  $cn1Shortcut.Save()
  Write-Output ('Windows sign-in startup configured: '+$cn1Startup)
}
if(-not (Get-NetIPAddress -AddressFamily IPv4 -IPAddress '192.168.2.8' -ErrorAction SilentlyContinue)){throw 'This launcher requires CN1 computer 192.168.2.8.'}
$cn1StateFile=Join-Path $cn1Root 'artifacts\ksk-cn1-local-processes.json'
$cn1LocalScript=Join-Path $PSScriptRoot 'start-ksk-cn1-local.ps1'
$cn1LanScript=Join-Path $PSScriptRoot 'start-ksk-cn1-lan.ps1'
function Test-Cn1OwnedProcess($Entry){
  $cn1Process=Get-Process -Id $Entry.id -ErrorAction SilentlyContinue
  if(-not $cn1Process -or $cn1Process.Path -ne $Entry.path){return $false}
  $cn1Start=if($Entry.started -is [datetime]){$Entry.started.ToUniversalTime()}else{[datetime]::Parse($Entry.started,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()}
  return $cn1Process.StartTime.ToUniversalTime().Ticks -eq $cn1Start.Ticks
}
function Test-Cn1Descendant([int]$ProcessId,[int[]]$OwnedIds){
  for($cn1Depth=0;$cn1Depth -lt 16 -and $ProcessId -gt 0;$cn1Depth++){
    if($OwnedIds -contains $ProcessId){return $true}
    $cn1Parent=Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if(-not $cn1Parent){return $false};$ProcessId=[int]$cn1Parent.ParentProcessId
  }
  return $false
}
$cn1Owned=@()
if(Test-Path -LiteralPath $cn1StateFile){$cn1State=Get-Content -LiteralPath $cn1StateFile -Raw | ConvertFrom-Json;$cn1Owned=@($cn1State.processes | Where-Object {Test-Cn1OwnedProcess $_})}
$cn1Listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -eq '127.0.0.1' -and $_.LocalPort -in @(3014,5094)})
foreach($cn1Listener in $cn1Listeners){if(-not (Test-Cn1Descendant -ProcessId $cn1Listener.OwningProcess -OwnedIds @($cn1Owned.id))){throw ('Port '+$cn1Listener.LocalPort+' belongs to another process; it was preserved.')}}
$cn1Healthy=$false
if(@($cn1Listeners | Select-Object -ExpandProperty LocalPort -Unique).Count -eq 2){
  try {
    $cn1Health=Invoke-RestMethod 'http://127.0.0.1:5094/health' -TimeoutSec 10
    $cn1Web=Invoke-WebRequest 'http://127.0.0.1:3014/admin/login' -UseBasicParsing -TimeoutSec 45
    $cn1Healthy=$cn1Health.branchCode -eq 'CN1' -and $cn1Web.StatusCode -eq 200
  }catch{}
}
if($cn1Healthy){Write-Output 'Existing CN1 agent and web are healthy; no duplicate processes started.'}
else{
  if($cn1Owned.Count -gt 0){& $cn1LocalScript -Stop;if($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw 'Failed to stop owned local processes.'}}
  $cn1Dll=Join-Path $cn1Root 'backend\PatientApi\bin\Debug\net9.0\PatientApi.dll'
  if(-not (Test-Path -LiteralPath $cn1Dll)){
    & dotnet build (Join-Path $cn1Root 'backend\PatientApi\PatientApi.csproj')
    if($LASTEXITCODE -ne 0){throw 'Agent build failed.'}
  }
  & $cn1LocalScript -EnableKskChangeLab -EnableKskManagement
  if($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw 'Agent/web launcher failed.'}
}
for($cn1Wait=0;$cn1Wait -lt 30;$cn1Wait++){
  try{
    $cn1Health=Invoke-RestMethod 'http://127.0.0.1:5094/health' -TimeoutSec 4
    $cn1Web=Invoke-WebRequest 'http://127.0.0.1:3014/admin/login' -UseBasicParsing -TimeoutSec 4
    if($cn1Health.branchCode -eq 'CN1' -and $cn1Web.StatusCode -eq 200){break}
    throw 'Local app not ready.'
  }catch{if($cn1Wait -eq 29){throw 'Agent/web did not become ready. Check artifacts\ksk-cn1-local logs.'};Start-Sleep -Milliseconds 500}
}
$cn1Principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$cn1Elevated=$cn1Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$cn1LanListener=Get-NetTCPConnection -LocalAddress '192.168.2.8' -LocalPort 3014 -State Listen -ErrorAction SilentlyContinue
$cn1LanStateFile=Join-Path $cn1Root 'artifacts\ksk-cn1-lan\process-3014.json'
if($cn1LanListener){
  if(-not (Test-Path -LiteralPath $cn1LanStateFile)){throw 'Existing HTTPS listener ownership unknown; preserved.'}
  $cn1LanState=Get-Content -LiteralPath $cn1LanStateFile -Raw | ConvertFrom-Json
  if(-not (Test-Cn1OwnedProcess $cn1LanState) -or $cn1LanListener.OwningProcess -ne $cn1LanState.id){throw 'Existing HTTPS listener belongs to another process; preserved.'}
}
if($cn1Elevated -and -not $SkipFirewall){& $cn1LanScript -LanPort 3014 -ConfigureFirewall}
elseif(-not $cn1LanListener){& $cn1LanScript -LanPort 3014}
if(-not $cn1Elevated -and -not $SkipFirewall){Write-Output 'To configure the scoped firewall rule, run this BAT once using Run as administrator.'}
for($cn1Try=0;$cn1Try -lt 30;$cn1Try++){
  try {
    $cn1Probe=Invoke-WebRequest 'https://192.168.2.8:3014/admin/lan-ready.gif' -UseBasicParsing -TimeoutSec 3
    if($cn1Probe.StatusCode -eq 200){break}
  }catch{if($cn1Try -eq 29){throw 'LAN HTTPS readiness failed. Check certificate trust and artifacts\ksk-cn1-lan logs.'};Start-Sleep -Milliseconds 500}
}
$cn1Url='https://192.168.2.8:3014/admin/vienphi-revenue'
Write-Output ('CN1 LAN ready: '+$cn1Url)
Write-Output 'Correct path ends in /vienphi-revenue (with the final e).'
if(-not $NoBrowser){Start-Process $cn1Url}
