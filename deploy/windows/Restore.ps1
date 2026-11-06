param([Parameter(Mandatory=$true)][string]$ConfigPath,[Parameter(Mandatory=$true)][string]$Snapshot,[Parameter(Mandatory=$true)][string]$TargetDirectory)
. "$PSScriptRoot\Common.ps1"
$config = Read-CargoConfig $ConfigPath
if (Test-Path -LiteralPath $TargetDirectory) { throw 'Choose a new empty restore target. This command never overwrites the live application.' }
New-Item -ItemType Directory -Path $TargetDirectory | Out-Null
Set-ResticEnvironment $config
try {
    Invoke-CargoCommand $config.ResticPath @('restore', $Snapshot, '--target', $TargetDirectory, '--verify')
    $manifest = Get-ChildItem -LiteralPath $TargetDirectory -Recurse -Filter manifest.json | Select-Object -First 1
    if (-not $manifest) { throw 'Backup manifest was not found.' }
    $folder = $manifest.DirectoryName
    foreach ($item in @('database.sql','application.env','private','composer.lock')) {
        if (-not (Test-Path -LiteralPath (Join-Path $folder $item))) { throw "Restored backup is missing $item" }
    }
    Write-Host "Verified recovery set restored to $folder"
    Write-Host 'Follow the restore drill in docs/DEPLOYMENT.md to import into a NEW database, restore the original APP_KEY and private files, and validate before switching production.'
} finally { Remove-Item Env:RESTIC_PASSWORD_FILE -ErrorAction SilentlyContinue }
