[CmdletBinding()]
param([switch]$Stop,[switch]$ConfigureFirewall,[ValidateSet(3014,3443)][int]$LanPort=3443)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskDir=Join-Path $taskRoot 'artifacts\ksk-cn1-lan'
$taskStateFile=Join-Path $taskDir $(if($LanPort -eq 3443){'process.json'}else{"process-$LanPort.json"})
$taskRule="AnPhu-KSK-CN1-HTTPS-$LanPort"
if($Stop){
  if(Test-Path -LiteralPath $taskStateFile){
    $taskState=Get-Content -LiteralPath $taskStateFile -Raw | ConvertFrom-Json
    $taskProcess=Get-Process -Id $taskState.id -ErrorAction SilentlyContinue
    $taskStarted=if($taskState.started -is [datetime]){$taskState.started.ToUniversalTime()}else{[datetime]::Parse($taskState.started,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()}
    if($taskProcess -and $taskProcess.Path -eq $taskState.path -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq $taskStarted.Ticks){& taskkill /PID $taskProcess.Id /T /F | Out-Null}
  }
  if($ConfigureFirewall){
    $taskExistingRule=Get-NetFirewallRule -Name $taskRule -ErrorAction SilentlyContinue
    if($taskExistingRule){Disable-NetFirewallRule -Name $taskRule | Out-Null}
  }
  Write-Output 'Stopped the owned LAN gateway. Use -ConfigureFirewall with -Stop as Administrator to disable its rule. Loopback app/HIS services unchanged.'
  exit
}
if(-not (Get-NetIPAddress -AddressFamily IPv4 -IPAddress '192.168.2.8' -ErrorAction SilentlyContinue)){throw 'CN1 IP 192.168.2.8 is not assigned to this computer.'}
$taskIdentity=[Security.Principal.WindowsIdentity]::GetCurrent()
$taskPrincipal=[Security.Principal.WindowsPrincipal]::new($taskIdentity)
if($ConfigureFirewall -and -not $taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run with -ConfigureFirewall in an elevated PowerShell.'}
$taskAlreadyListening=[bool](Get-NetTCPConnection -LocalPort $LanPort -LocalAddress '192.168.2.8' -State Listen -ErrorAction SilentlyContinue)
if($taskAlreadyListening -and -not $ConfigureFirewall){throw "LAN port $LanPort already has a listener; preserve the running process."}
if($taskAlreadyListening){
  if(-not (Test-Path -LiteralPath $taskStateFile)){throw 'Existing listener is not owned by this launcher; do not expose it.'}
  $taskExisting=Get-Content -LiteralPath $taskStateFile -Raw | ConvertFrom-Json
  $taskExistingProcess=Get-Process -Id $taskExisting.id -ErrorAction SilentlyContinue
  $taskExistingStart=if($taskExisting.started -is [datetime]){$taskExisting.started.ToUniversalTime()}else{[datetime]::Parse($taskExisting.started,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()}
  $taskListener=Get-NetTCPConnection -LocalPort $LanPort -LocalAddress '192.168.2.8' -State Listen -ErrorAction SilentlyContinue
  if(-not $taskExistingProcess -or $taskExistingProcess.Path -ne $taskExisting.path -or $taskExistingProcess.StartTime.ToUniversalTime().Ticks -ne $taskExistingStart.Ticks -or $taskListener.OwningProcess -ne $taskExisting.id){throw 'Listener identity does not match this gateway; preserve it and do not open firewall.'}
}
New-Item -ItemType Directory -Path $taskDir -Force | Out-Null
# Keep generated private key and process state readable only to current operator/SYSTEM.
if(-not $taskAlreadyListening){
& icacls $taskDir /inheritance:r /grant:r "$($taskIdentity.Name):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not protect LAN certificate directory.'}
}
$taskCert=Join-Path $taskDir 'cn1-server.cert.pem'
$taskKey=Join-Path $taskDir 'cn1-server.key.pem'
$taskPublic=Join-Path $taskDir 'cn1-server.cer'
if(-not (Test-Path -LiteralPath $taskCert)){
  if(Test-Path -LiteralPath $taskKey){throw 'Partial TLS state found; preserve existing key and resolve before recreating.'}
  $taskRsa=[Security.Cryptography.RSA]::Create(3072)
  try{
    $taskRequest=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=AnPhu-KSK-CN1-192.168.2.8',$taskRsa,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $taskSan=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $taskSan.AddIpAddress([Net.IPAddress]::Parse('192.168.2.8'))
    $taskRequest.CertificateExtensions.Add($taskSan.Build())
    $taskRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
    $taskRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true))
    $taskUsage=[Security.Cryptography.OidCollection]::new(); $null=$taskUsage.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
    $taskRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($taskUsage,$true))
    $taskCertificate=$taskRequest.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5),[DateTimeOffset]::UtcNow.AddMonths(6))
    try{
      [IO.File]::WriteAllText($taskKey,$taskRsa.ExportPkcs8PrivateKeyPem())
      [IO.File]::WriteAllText($taskCert,$taskCertificate.ExportCertificatePem())
      [IO.File]::WriteAllBytes($taskPublic,$taskCertificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
    }finally{$taskCertificate.Dispose()}
  }finally{$taskRsa.Dispose()}
}
# Enable only one address/port, Private profile and the CN1 /24 subnet, not all LANs.
if($ConfigureFirewall){
$taskExistingRule=Get-NetFirewallRule -Name $taskRule -ErrorAction SilentlyContinue
if($taskExistingRule){
  $taskPortFilter=$taskExistingRule | Get-NetFirewallPortFilter
  $taskAddressFilter=$taskExistingRule | Get-NetFirewallAddressFilter
  if($taskPortFilter.LocalPort -ne "$LanPort" -or $taskAddressFilter.LocalAddress -ne '192.168.2.8' -or $taskAddressFilter.RemoteAddress -ne '192.168.2.0/24' -or $taskExistingRule.Profile -ne 'Private' -or $taskExistingRule.Direction -ne 'Inbound' -or $taskExistingRule.Action -ne 'Allow' -or $taskPortFilter.Protocol -ne 'TCP'){throw 'Existing firewall rule does not match intended scope; preserve it.'}
  Enable-NetFirewallRule -Name $taskRule | Out-Null
}else{
  New-NetFirewallRule -Name $taskRule -DisplayName "An Phu KSK CN1 HTTPS $LanPort - internal preview" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $LanPort -LocalAddress '192.168.2.8' -RemoteAddress '192.168.2.0/24' -Profile Private | Out-Null
}
Write-Output 'Scoped CN1 firewall rule enabled.'
}else{Write-Output 'Firewall unchanged. For other PCs, run this launcher once as Administrator with -ConfigureFirewall.'}
if($taskAlreadyListening){Write-Output 'Existing listener preserved; only the scoped firewall configuration was updated.'; exit}
$taskNode=Get-Command node -ErrorAction Stop
$taskProxy=Join-Path $PSScriptRoot 'ksk-lan-proxy.mjs'
$taskProcess=Start-Process -FilePath $taskNode.Source -ArgumentList @($taskProxy) -Environment @{KSK_LAN_CERT=$taskCert;KSK_LAN_KEY=$taskKey;KSK_LAN_PORT="$LanPort"} -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDir "stdout-$LanPort.log") -RedirectStandardError (Join-Path $taskDir "stderr-$LanPort.log")
[pscustomobject]@{id=$taskProcess.Id;started=$taskProcess.StartTime.ToUniversalTime().ToString('O');path=$taskProcess.Path} | ConvertTo-Json | Set-Content -LiteralPath $taskStateFile -Encoding UTF8
Write-Output "LAN URL: https://192.168.2.8:$LanPort/admin/login"
Write-Output ('Public certificate for authorized client trust: '+$taskPublic)
Write-Output ('Certificate SHA256: '+(Get-FileHash -LiteralPath $taskPublic -Algorithm SHA256).Hash)
Write-Output 'Self-signed internal preview certificate: distribute ONLY the .cer file after verifying fingerprint. Never copy .key.pem.'
