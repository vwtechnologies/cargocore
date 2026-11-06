param([Parameter(Mandatory=$true)][string]$ConfigPath)
. "$PSScriptRoot\Common.ps1"
$config = Read-CargoConfig $ConfigPath
$originalLocation = Get-Location
$previousUser = $env:DB_USERNAME
$previousPassword = $env:DB_PASSWORD
try {
    Set-Location -LiteralPath $config.AppPath
    if (-not (Test-Path 'public\build\manifest.json')) { throw 'Frontend build is missing.' }
    Invoke-CargoCommand $config.PhpPath @('artisan','down','--retry=30')
    $credentials = Get-Content -Raw -LiteralPath $config.MigrationEnvironment | ConvertFrom-Json
    $env:DB_USERNAME = $credentials.username
    $env:DB_PASSWORD = $credentials.password
    Invoke-CargoCommand $config.PhpPath @('artisan','config:clear')
    Invoke-CargoCommand $config.PhpPath @('artisan','migrate','--force','--no-interaction')
    Invoke-CargoCommand $config.PhpPath @('artisan','db:seed','--force','--no-interaction')
    $env:DB_USERNAME = $previousUser
    $env:DB_PASSWORD = $previousPassword
    Invoke-CargoCommand $config.PhpPath @('artisan','config:cache')
    Invoke-CargoCommand $config.PhpPath @('artisan','route:cache')
    Invoke-CargoCommand $config.PhpPath @('artisan','view:cache')
    Invoke-CargoCommand $config.PhpPath @('artisan','queue:restart')
    Invoke-CargoCommand $config.PhpPath @('artisan','up')
    Write-Host 'Application updated. Run Health.ps1 and the acceptance checklist.'
} catch {
    Write-Error "Update failed; keep the application in maintenance mode and follow the rollback runbook. $($_.Exception.Message)"
    exit 1
} finally {
    $env:DB_USERNAME = $previousUser
    $env:DB_PASSWORD = $previousPassword
    Set-Location $originalLocation
}
