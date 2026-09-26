# Dynep Autonomous Micro-DaaS Engine Watchdog Monitor (PowerShell)
# Pings http://localhost:3000/health every 3 minutes.
# If unresponsive, restarts the process and dispatches urgent alert to ntfy.sh/dynep_alerts.

$HealthUrl = "http://localhost:3000/health"
$NtfyUrl = "https://ntfy.sh/dynep_alerts"
$IntervalSeconds = 180

Write-Host "🛡️ [WATCHDOG] Initialized. Monitoring $HealthUrl every $IntervalSeconds seconds." -ForegroundColor Cyan

function Send-NtfyAlert($Title, $Message) {
    try {
        $headers = @{
            "Title" = $Title
            "Priority" = "5"
            "Tags" = "rotating_light,fire,sos"
        }
        Invoke-RestMethod -Uri $NtfyUrl -Method Post -Headers $headers -Body $Message -TimeoutSec 10 | Out-Null
        Write-Host "📢 [WATCHDOG] Dispatched urgent alert to ntfy.sh/dynep_alerts" -ForegroundColor Yellow
    } catch {
        Write-Warning "Failed to dispatch ntfy alert: $_"
    }
}

function Restart-DaaSServices {
    Write-Warning "🔄 [WATCHDOG] Initiating automatic recovery restart..."
    
    # Check if PM2 is available
    $pm2 = Get-Command "pm2.cmd" -ErrorAction SilentlyContinue
    if ($pm2) {
        & pm2.cmd restart dynep-daas
        Write-Host "✅ [WATCHDOG] PM2 restarted dynep-daas" -ForegroundColor Green
    } else {
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $BatPath = Join-Path $ScriptDir "start-daas-service.bat"
        Start-Process "cmd.exe" -ArgumentList "/c `"$BatPath`"" -WindowStyle Minimized
        Write-Host "🚀 [WATCHDOG] Spawned start-daas-service.bat" -ForegroundColor Green
    }
}

while ($true) {
    $now = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    try {
        $res = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
        if ($res.status -eq "ok") {
            Write-Host "[$now] 💚 [WATCHDOG] Health OK (status: 200, uptime: $($res.uptime_seconds)s)" -ForegroundColor Green
        } else {
            throw "Unexpected response payload: $($res | ConvertTo-Json -Compress)"
        }
    } catch {
        Write-Host "[$now] ❌ [WATCHDOG] Health check probe failed: $_" -ForegroundColor Red
        Start-Sleep -Seconds 5
        
        # Second attempt before alert
        try {
            $res = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
            Write-Host "[$now] ⚠️ [WATCHDOG] Transient blip recovered on retry." -ForegroundColor Yellow
        } catch {
            Write-Host "[$now] 🚨 [WATCHDOG] Confirmed failure! Sending ntfy alert and triggering restart." -ForegroundColor Red
            Send-NtfyAlert -Title "🚨 Dynep DaaS Health Check Failed" -Message "Endpoint $HealthUrl unresponsive at $now.`nError: $_`nTriggering automatic restart."
            Restart-DaaSServices
        }
    }
    Start-Sleep -Seconds $IntervalSeconds
}
