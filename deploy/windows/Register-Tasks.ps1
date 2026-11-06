#Requires -RunAsAdministrator
param([Parameter(Mandatory=$true)][string]$ConfigPath)
. "$PSScriptRoot\Common.ps1"
$config = Read-CargoConfig $ConfigPath
$credential = Get-Credential -UserName $config.ServiceAccount -Message 'Windows service account for CargoCore scheduled tasks'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3)
$definitions = @(
    @{ Name='CargoCore Scheduler'; Exe=$config.PhpPath; Args='artisan schedule:run'; Trigger=(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)) },
    @{ Name='CargoCore Queue'; Exe=$config.PhpPath; Args='artisan queue:work --stop-when-empty --tries=3 --timeout=60 --max-time=50'; Trigger=(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)) },
    @{ Name='CargoCore Backup'; Exe='powershell.exe'; Args=('-NoProfile -ExecutionPolicy RemoteSigned -File "'+$PSScriptRoot+'\Backup.ps1" -ConfigPath "'+$ConfigPath+'"'); Trigger=(New-ScheduledTaskTrigger -Daily -At '02:00') },
    @{ Name='CargoCore Health'; Exe='powershell.exe'; Args=('-NoProfile -ExecutionPolicy RemoteSigned -File "'+$PSScriptRoot+'\Health.ps1" -ConfigPath "'+$ConfigPath+'"'); Trigger=(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 15)) }
)
foreach ($definition in $definitions) {
    $action = New-ScheduledTaskAction -Execute $definition.Exe -Argument $definition.Args -WorkingDirectory $config.AppPath
    Register-ScheduledTask -TaskName $definition.Name -Action $action -Trigger $definition.Trigger -Settings $settings -User $credential.UserName -Password $credential.GetNetworkCredential().Password -Force | Out-Null
}
Write-Host 'Scheduled tasks installed. Set Windows timezone to Pakistan Standard Time for a 02:00 PKT backup.'
