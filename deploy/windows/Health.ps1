param([Parameter(Mandatory=$true)][string]$ConfigPath)
. "$PSScriptRoot\Common.ps1"
$config = Read-CargoConfig $ConfigPath
$tcp = $null
$ssl = $null
try {
    $response = Invoke-WebRequest -Uri ("https://" + $config.PublicIp + '/up') -UseBasicParsing -TimeoutSec 20
    if ($response.StatusCode -ne 200) { throw 'Public HTTPS health check failed.' }
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($config.PublicIp, 443)
    $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false)
    $ssl.AuthenticateAsClient($config.PublicIp)
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
    if ($certificate.NotAfter.ToUniversalTime() -lt [DateTime]::UtcNow.AddHours(48)) { throw 'TLS certificate expires in less than 48 hours; check automated renewal.' }
    $original = Get-Location
    try { Set-Location $config.AppPath; Invoke-CargoCommand $config.PhpPath @('artisan','erp:health','--require-backup') } finally { Set-Location $original }
    Write-CargoStatus $config 'health' $true 'HTTPS, certificate, database, private storage and backup checks passed.'
} catch { Write-CargoStatus $config 'health' $false "Health check failed: $($_.Exception.Message)"; throw }
finally { if ($ssl) { $ssl.Dispose() }; if ($tcp) { $tcp.Dispose() } }
