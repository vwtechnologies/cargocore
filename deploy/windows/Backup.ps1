param([Parameter(Mandatory=$true)][string]$ConfigPath)
. "$PSScriptRoot\Common.ps1"
$config = Read-CargoConfig $ConfigPath
$lock = $null
$stage = $null
try {
    New-Item -ItemType Directory -Force -Path $config.StagingPath | Out-Null
    $lock = [System.IO.File]::Open((Join-Path $config.StagingPath 'backup.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $stage = Join-Path $config.StagingPath ([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    $sql = Join-Path $stage 'database.sql'
    Invoke-CargoCommand $config.MariaDbDump @("--defaults-extra-file=$($config.DatabaseDefaults)", '--single-transaction', '--quick', '--skip-lock-tables', '--hex-blob', "--result-file=$sql", $config.Database)
    # Uploaded files are immutable: replacement writes a new path and retains
    # the old file. A database dump followed by a file copy is consistent.
    $private = Join-Path $config.AppPath 'storage\app\private'
    Copy-Item -LiteralPath $private -Destination (Join-Path $stage 'private') -Recurse
    Copy-Item -LiteralPath (Join-Path $config.AppPath '.env') -Destination (Join-Path $stage 'application.env')
    Copy-Item -LiteralPath (Join-Path $config.AppPath 'composer.lock') -Destination $stage
    @{ created_at = [DateTime]::UtcNow.ToString('o'); database = $config.Database; app = $config.AppPath; schema = 1 } | ConvertTo-Json | Set-Content (Join-Path $stage 'manifest.json') -Encoding UTF8
    Set-ResticEnvironment $config
    Invoke-CargoCommand $config.ResticPath @('backup', $stage, '--tag', 'cargocore', '--host', 'cargocore-server')
    Invoke-CargoCommand $config.ResticPath @('forget', '--tag', 'cargocore', '--host', 'cargocore-server', '--group-by', 'host,tags', '--keep-within', '30d', '--keep-last', '1', '--prune')
    Invoke-CargoCommand $config.ResticPath @('check', '--read-data-subset=5%')
    Write-CargoStatus $config 'backup' $true 'Encrypted database and document backup completed and checked.'
} catch {
    Write-CargoStatus $config 'backup' $false "Backup failed: $($_.Exception.Message)"
    throw
} finally {
    if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force }
    if ($lock) { $lock.Dispose() }
    Remove-Item Env:RESTIC_PASSWORD_FILE -ErrorAction SilentlyContinue
}
