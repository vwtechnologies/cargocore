#Requires -RunAsAdministrator
param([Parameter(Mandatory=$true)][string]$ConfigPath)
. "$PSScriptRoot\Common.ps1"
$config = Read-CargoConfig $ConfigPath
$address = $null
if (-not [System.Net.IPAddress]::TryParse($config.PublicIp, [ref]$address)) { throw 'Set a valid public static IP in the operations config.' }
foreach ($tool in @($config.PhpPath, $config.ApachePath, $config.CaddyPath, $config.ResticPath)) {
    if (-not (Test-Path -LiteralPath $tool)) { throw "Install prerequisite: $tool" }
}
if (-not (Test-Path (Join-Path $config.AppPath 'public\build\manifest.json'))) { throw 'Deploy a release with prebuilt frontend assets.' }
if (-not (Test-Path (Join-Path $config.AppPath '.env'))) { throw 'Create the production .env from production.env.example before installation.' }
New-Item -ItemType Directory -Force -Path $config.LogPath, (Split-Path $config.CaddyConfig), $config.StagingPath | Out-Null
$caddy = Get-Content -Raw "$PSScriptRoot\Caddyfile.template"
$caddy = $caddy.Replace('{{PUBLIC_IP}}', $config.PublicIp).Replace('{{ACME_EMAIL}}', $config.AcmeEmail).Replace('{{LOG_PATH}}', $config.LogPath.Replace('\','/'))
$caddy | Set-Content -LiteralPath $config.CaddyConfig -Encoding Ascii
$apache = Get-Content -Raw "$PSScriptRoot\httpd-cargocore.conf.template"
$apache = $apache.Replace('{{PUBLIC_IP}}', $config.PublicIp).Replace('{{APP_PATH}}', $config.AppPath.Replace('\','/')).Replace('{{LOG_PATH}}', $config.LogPath.Replace('\','/'))
$apacheFile = Join-Path (Split-Path $config.CaddyConfig) 'httpd-cargocore.conf'
$apache | Set-Content -LiteralPath $apacheFile -Encoding Ascii
Invoke-CargoCommand $config.CaddyPath @('validate', '--config', $config.CaddyConfig, '--adapter', 'caddyfile')
if (-not [System.Diagnostics.EventLog]::SourceExists('CargoCore ERP')) { New-EventLog -LogName Application -Source 'CargoCore ERP' }
# The gateway service runs under a dedicated identity. Configure its service
# credentials in Services before starting; no credentials are stored here.
if (-not (Get-Service $config.CaddyService -ErrorAction SilentlyContinue)) {
    $binary = '"' + $config.CaddyPath + '" run --config "' + $config.CaddyConfig + '" --adapter caddyfile'
    New-Service -Name $config.CaddyService -BinaryPathName $binary -DisplayName 'CargoCore HTTPS Gateway' -StartupType Automatic | Out-Null
}
foreach ($port in @(80,443)) {
    $rule = "CargoCore HTTPS $port"
    if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null }
}
Write-Host "Generated gateway and Apache configurations at $(Split-Path $config.CaddyConfig)."
Write-Host 'Complete Apache loopback binding, service identity/ACLs, database grants, migrations, and router forwarding in docs/DEPLOYMENT.md before starting services.'
