param(
    [string]$ServiceName = "AnPhuPatientPortalSyncAgent",
    [string]$DisplayName = "An Phu Patient Portal Sync Agent",
    [string]$PublishDir = $PSScriptRoot,
    [string]$EnvFile = (Join-Path $PSScriptRoot "patientapi-service.env"),
    [int]$Port = 5080
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run PowerShell as Administrator."
    }
}

function Read-EnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path. Copy patientapi-service.env.example to patientapi-service.env and fill values first."
    }

    $items = New-Object System.Collections.Generic.List[string]
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
        if ($line -notmatch "^[A-Za-z_][A-Za-z0-9_]*=") { throw "Invalid env line: $line" }
        $items.Add($line)
    }
    return [string[]]$items
}

Assert-Admin

$exePath = Join-Path $PublishDir "PatientApi.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
    throw "PatientApi.exe not found in $PublishDir. Run publish-patientapi-agent.ps1 first."
}

$envItems = Read-EnvFile $EnvFile
if (-not ($envItems | Where-Object { $_ -like "ASPNETCORE_URLS=*" })) {
    $envItems += "ASPNETCORE_URLS=http://127.0.0.1:$Port"
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName -Force
        $existing.WaitForStatus("Stopped", "00:00:30")
    }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

$binPath = "`"$exePath`""
sc.exe create $ServiceName binPath= $binPath start= delayed-auto DisplayName= $DisplayName | Out-Null
sc.exe description $ServiceName "Polls Supabase sync jobs, reads Oracle HIS, and writes patient snapshots back to Supabase." | Out-Null

$serviceKey = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName"
New-ItemProperty -Path $serviceKey -Name "Environment" -Value $envItems -PropertyType MultiString -Force | Out-Null

Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName
Write-Host "Installed service: $($svc.Name) [$($svc.Status)]"
Write-Host "Health check: Invoke-RestMethod http://127.0.0.1:$Port/health"
