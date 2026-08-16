param(
    [string]$SupabaseUrl,
    [string]$OracleHost = "192.168.2.250",
    [int]$OraclePort = 1521,
    [string]$ServiceName = "AnPhuPatientPortalSyncAgent",
    [int]$HealthPort = 5080
)

$ErrorActionPreference = "Continue"

function Write-Check($Name, $Value) {
    Write-Host ("{0,-34} {1}" -f $Name, $Value)
}

function Test-Tcp($HostName, $Port) {
    try {
        $client = New-Object Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(5000, $false)
        if ($ok) { $client.EndConnect($iar) }
        $client.Close()
        return $ok
    } catch {
        return $false
    }
}

$os = Get-CimInstance Win32_OperatingSystem
Write-Check "OS" "$($os.Caption) $($os.Version)"
Write-Check "Architecture" $os.OSArchitecture
Write-Check "PowerShell" $PSVersionTable.PSVersion
Write-Check "Machine" $env:COMPUTERNAME

$is2012 = $os.Version -like "6.2.*" -or $os.Version -like "6.3.*"
Write-Check "Windows Server 2012/2012 R2" ($(if ($is2012) { "YES" } else { "NO or newer" }))

$tlsClient = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Client"
$tlsServer = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Server"
Write-Check "TLS 1.2 Client key" ($(if (Test-Path $tlsClient) { "Present" } else { "Missing, check hardening policy" }))
Write-Check "TLS 1.2 Server key" ($(if (Test-Path $tlsServer) { "Present" } else { "Missing, OK for outbound-only agent" }))

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnet) {
    Write-Check "dotnet" $dotnet.Source
    & dotnet --info
} else {
    Write-Check "dotnet" "Not installed. OK if using self-contained publish."
}

Write-Check "Oracle TCP $OracleHost`:$OraclePort" ($(if (Test-Tcp $OracleHost $OraclePort) { "OK" } else { "FAILED" }))

if ($SupabaseUrl) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $uri = $SupabaseUrl.TrimEnd("/") + "/rest/v1/"
        $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -Method Head -TimeoutSec 15
        Write-Check "Supabase HTTPS" "OK HTTP $($response.StatusCode)"
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 401 -or $status -eq 404) {
            Write-Check "Supabase HTTPS" "Reachable HTTP $status"
        } else {
            Write-Check "Supabase HTTPS" "FAILED $($_.Exception.Message)"
        }
    }
} else {
    Write-Check "Supabase HTTPS" "Skipped. Pass -SupabaseUrl https://xxxx.supabase.co"
}

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Check "Service $ServiceName" $svc.Status
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$HealthPort/health" -TimeoutSec 5
        Write-Check "Local health" ($health | ConvertTo-Json -Compress)
    } catch {
        Write-Check "Local health" "FAILED $($_.Exception.Message)"
    }
} else {
    Write-Check "Service $ServiceName" "Not installed"
}
