/**
 * Dynep Autonomous Micro-DaaS Engine Watchdog Monitor
 * Pings http://localhost:3000/health every 3 minutes.
 * If unresponsive, restarts the process and dispatches urgent alert to ntfy.sh/dynep_alerts.
 */

import { exec, spawn } from 'child_process';
import path from 'path';

const HEALTH_URL = process.env.HEALTH_URL || 'http://localhost:3000/health';
const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.sh/dynep_alerts';
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_SEC || '180', 10) * 1000; // 3 minutes
const REQUEST_TIMEOUT_MS = 10000; // 10s

console.log(`🛡️ [WATCHDOG] Initialized. Monitoring ${HEALTH_URL} every ${CHECK_INTERVAL_MS / 1000}s`);

async function sendNtfyAlert(title, message, priority = 5) {
  try {
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': String(priority),
        'Tags': 'rotating_light,fire,sos',
      },
      body: message,
    });
    if (res.ok) {
      console.log(`📢 [WATCHDOG] Dispatched urgent alert to ntfy.sh/dynep_alerts`);
    }
  } catch (err) {
    console.error(`⚠️ [WATCHDOG] Failed to dispatch ntfy alert: ${err.message}`);
  }
}

async function checkHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, status: res.status, data };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: err.message };
  }
}

function restartServices() {
  console.warn(`🔄 [WATCHDOG] Initiating automatic recovery restart...`);

  // Try PM2 restart first
  exec('pm2.cmd restart dynep-daas', (pm2Err, stdout, stderr) => {
    if (!pm2Err) {
      console.log(`✅ [WATCHDOG] PM2 successfully restarted dynep-daas service`);
      return;
    }

    console.warn(`⚠️ [WATCHDOG] PM2 restart not available (${pm2Err.message}), executing batch supervisor...`);
    const projectRoot = path.resolve(import.meta.dirname || '.', '..');
    const batPath = path.join(projectRoot, 'scripts', 'start-daas-service.bat');

    try {
      spawn('cmd.exe', ['/c', batPath], {
        detached: true,
        stdio: 'ignore',
        cwd: projectRoot,
      }).unref();
      console.log(`🚀 [WATCHDOG] Spawned start-daas-service.bat in background`);
    } catch (spawnErr) {
      console.error(`❌ [WATCHDOG] Failed to spawn recovery script: ${spawnErr.message}`);
    }
  });

  // Ensure Cloudflare Tunnel is running
  exec('tasklist /fi "imagename eq cloudflared.exe"', (cfErr, stdout) => {
    if (cfErr || !stdout.toLowerCase().includes('cloudflared.exe')) {
      console.log(`🌐 [WATCHDOG] Cloudflare Tunnel not found running. Starting tunnel...`);
      const projectRoot = path.resolve(import.meta.dirname || '.', '..');
      const cfExe = path.join(projectRoot, 'cloudflared.exe');
      spawn(cfExe, ['tunnel', 'run', 'dynep-daas'], {
        detached: true,
        stdio: 'ignore',
        cwd: projectRoot,
      }).unref();
    }
  });
}

let consecutiveFailures = 0;

async function runCheck() {
  const result = await checkHealth();

  if (result.ok) {
    consecutiveFailures = 0;
    console.log(`[${new Date().toISOString()}] 💚 [WATCHDOG] Health OK (status: ${result.status}, uptime: ${result.data?.uptime_seconds}s)`);
    return;
  }

  consecutiveFailures++;
  console.error(`[${new Date().toISOString()}] ❌ [WATCHDOG] Health check failure #${consecutiveFailures}: ${result.error}`);

  // Confirm failure with an immediate retry in 5 seconds to prevent false alarms
  await new Promise((r) => setTimeout(r, 5000));
  const retryResult = await checkHealth();

  if (retryResult.ok) {
    console.log(`[${new Date().toISOString()}] ⚠️ [WATCHDOG] Transient blip recovered on immediate retry.`);
    consecutiveFailures = 0;
    return;
  }

  // Still failing: trigger alert and restart
  console.error(`[${new Date().toISOString()}] 🚨 [WATCHDOG] Confirmed outage on ${HEALTH_URL}! Restarting engine.`);
  await sendNtfyAlert(
    '🚨 Dynep DaaS Health Check Failed',
    `Endpoint ${HEALTH_URL} unresponsive.\nError: ${result.error}\nAutomated process restart initiated at ${new Date().toISOString()}.`
  );

  restartServices();
}

// Initial check after 5s startup grace period
setTimeout(() => {
  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
}, 5000);
