param(
    [switch]$RestartAfterChange
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run PowerShell as Administrator."
}

$paths = @(
    "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Client",
    "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Server"
)

foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        New-Item -Path $path -Force | Out-Null
    }
    New-ItemProperty -Path $path -Name "Enabled" -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $path -Name "DisabledByDefault" -Value 0 -PropertyType DWord -Force | Out-Null
}

$netPaths = @(
    "HKLM:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\.NETFramework\v4.0.30319"
)

foreach ($path in $netPaths) {
    if (Test-Path $path) {
        New-ItemProperty -Path $path -Name "SchUseStrongCrypto" -Value 1 -PropertyType DWord -Force | Out-Null
        New-ItemProperty -Path $path -Name "SystemDefaultTlsVersions" -Value 1 -PropertyType DWord -Force | Out-Null
    }
}

Write-Host "TLS 1.2 registry keys have been enabled. Restart Windows before production use."

if ($RestartAfterChange) {
    Restart-Computer -Force
}
