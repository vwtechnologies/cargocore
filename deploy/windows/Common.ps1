Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Read-CargoConfig([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Operations config not found: $Path" }
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}
function Invoke-CargoCommand([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
function Write-CargoStatus($Config, [string]$Name, [bool]$Success, [string]$Message) {
    $directory = Join-Path $Config.AppPath 'storage\app\operations'
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $state = @{ success = $Success; at = [DateTime]::UtcNow.ToString('o'); message = $Message }
    $temp = Join-Path $directory ($Name + '.tmp')
    $state | ConvertTo-Json | Set-Content -LiteralPath $temp -Encoding UTF8
    Move-Item -LiteralPath $temp -Destination (Join-Path $directory ($Name + '.json')) -Force
    if (-not $Success) { Write-EventLog -LogName Application -Source 'CargoCore ERP' -EventId 1001 -EntryType Error -Message $Message }
}
function Set-ResticEnvironment($Config) {
    $env:RESTIC_REPOSITORY = $Config.BackupRepository
    $env:RESTIC_PASSWORD_FILE = $Config.BackupPasswordFile
}
