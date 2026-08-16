param(
    [string]$ServiceName = "AnPhuPatientPortalSyncAgent"
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run PowerShell as Administrator."
}

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName -Force
        $svc.WaitForStatus("Stopped", "00:00:30")
    }
    sc.exe delete $ServiceName | Out-Null
    Write-Host "Deleted service: $ServiceName"
} else {
    Write-Host "Service not found: $ServiceName"
}
