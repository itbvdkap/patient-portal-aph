param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$OutputDir = "artifacts\patientapi-agent-win-x64",
    [switch]$NoZip
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$project = Join-Path $repoRoot "backend\PatientApi\PatientApi.csproj"
$output = Join-Path $repoRoot $OutputDir
$zipPath = "$output.zip"

if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

dotnet publish $project `
    -c $Configuration `
    -r $Runtime `
    --self-contained true `
    -p:PublishSingleFile=false `
    -p:PublishTrimmed=false `
    -o $output

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "install-patientapi-service.ps1") -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "uninstall-patientapi-service.ps1") -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "check-windows2012-env.ps1") -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "enable-tls12-windows2012.ps1") -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "patientapi-service.env.example") -Destination $output -Force

if (-not $NoZip) {
    Compress-Archive -Path (Join-Path $output "*") -DestinationPath $zipPath -Force
    Write-Host "Created package: $zipPath"
}

Write-Host "Publish directory: $output"
Write-Host "Next: copy the directory or zip to Windows Server, fill patientapi-service.env, then run install-patientapi-service.ps1 as Administrator."
