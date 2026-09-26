import { env } from '../config/env.js';
import { logger } from '../db/client.js';

export interface WelcomeEmailOptions {
  to: string;
  apiKey: string;
  tier: string;
  monthlyQuota: number;
}

export class EmailService {
  /**
   * Sends a transactional welcome email with the subscriber's API key via Resend
   */
  static async sendWelcomeApiKeyEmail(options: WelcomeEmailOptions): Promise<boolean> {
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      logger.info({ to: options.to }, 'RESEND_API_KEY not configured, skipping transactional email');
      return false;
    }

    const fromEmail = env.RESEND_FROM_EMAIL || 'Dynep Micro-DaaS <onboarding@resend.dev>';
    const docsUrl = 'https://data.dynep.com/#playground';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #10b981; margin: 0 0 8px 0; }
    .subtitle { color: #94a3b8; font-size: 14px; margin: 0; }
    .key-box { background-color: #020617; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center; }
    .key-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
    .key-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; font-weight: bold; color: #34d399; word-break: break-all; }
    .meta-grid { display: flex; justify-content: space-between; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 16px; font-size: 13px; color: #94a3b8; }
    .btn { display: block; text-align: center; background-color: #10b981; color: #020617; font-weight: 700; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin-top: 24px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">⚡ Welcome to Dynep DaaS</h1>
      <p class="subtitle">Real-Time AI Cloud GPU & Model Spot Intelligence</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
      Your Micro-DaaS API access is activated. You can immediately begin querying real-time spot rates across 31 cloud providers (Lambda Labs, Vast.ai, RunPod, Vultr, and more).
    </p>

    <div class="key-box">
      <div class="key-label">Your Live Personal API Key</div>
      <div class="key-value">${options.apiKey}</div>
    </div>

    <div class="meta-grid">
      <div>Plan: <strong style="color: #fff; text-transform: capitalize;">${options.tier}</strong></div>
      <div>Monthly Quota: <strong style="color: #fff;">${options.monthlyQuota.toLocaleString()} requests</strong></div>
    </div>

    <a href="${docsUrl}" class="btn">Launch API Playground & Documentation →</a>

    <div style="margin-top: 24px; padding: 16px; background-color: #020617; border-radius: 8px; font-size: 12px;">
      <div style="color: #64748b; margin-bottom: 6px;">Quick cURL Example:</div>
      <pre style="margin: 0; color: #e2e8f0; font-family: monospace; overflow-x: auto;">curl -H "Authorization: Bearer ${options.apiKey}" "https://data.dynep.com/v1/data?limit=5"</pre>
    </div>

    <div class="footer">
      Dynep Autonomous Micro-DaaS Engine • <a href="https://data.dynep.com" style="color: #10b981; text-decoration: none;">data.dynep.com</a>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: '⚡ Your Dynep API Key — Real-Time Cloud GPU Intelligence',
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText, to: options.to }, 'Failed to deliver Resend transactional email');
        return false;
      }

      const data = await response.json();
      logger.info({ id: (data as any)?.id, to: options.to }, 'Delivered transactional API key email via Resend');
      return true;
    } catch (err: any) {
      logger.error({ error: err.message, to: options.to }, 'Exception in Resend EmailService');
      return false;
    }
  }

  /**
   * Sends confirmation when a developer sets up a GPU Spot Drop alert
   */
  static async sendAlertConfirmationEmail(options: {
    to: string;
    gpuModel: string;
    targetPrice: number;
    channel: string;
  }): Promise<boolean> {
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) return false;

    const fromEmail = env.RESEND_FROM_EMAIL || 'Dynep Micro-DaaS <keys@dynep.com>';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 800; color: #10b981; margin: 0 0 8px 0; }
    .alert-box { background-color: #020617; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
    .btn { display: block; text-align: center; background-color: #10b981; color: #020617; font-weight: 700; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">⚡ GPU Spot Drop Alert Activated</h1>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">Autonomous 31-Cloud Intelligence Monitor</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
      We are continuously indexing 31 cloud GPU providers (LeaderGPU, RunPod, Lambda Labs, Vast.ai, AWS, etc.) every 15 minutes.
    </p>

    <div class="alert-box">
      <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Target Alert Rule</div>
      <div style="font-size: 18px; font-weight: bold; color: #34d399;">${options.gpuModel}</div>
      <div style="font-size: 15px; color: #f8fafc; margin-top: 4px;">Trigger when hourly rate drops below: <strong style="color: #10b981;">$${options.targetPrice.toFixed(2)}/hr</strong></div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Delivery: ${options.channel.toUpperCase()}</div>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      The moment an instance matches or beats your trigger price, you will receive an immediate notification with direct host deployment details.
    </p>

    <a href="https://data.dynep.com" class="btn">View Live Market Terminal →</a>
  </div>
</body>
</html>`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: `⚡ Alert Confirmed: ${options.gpuModel} < $${options.targetPrice.toFixed(2)}/hr`,
          html: htmlContent,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches real-time price drop alert when market rates fall below target
   */
  static async sendGpuPriceDropAlertEmail(options: {
    to: string;
    gpuModel: string;
    provider: string;
    currentPrice: number;
    targetPrice: number;
    awsPrice: number;
    savingsPercent: string;
    directUrl?: string;
  }): Promise<boolean> {
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) return false;

    const fromEmail = env.RESEND_FROM_EMAIL || 'Dynep Micro-DaaS <keys@dynep.com>';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }
    .badge { display: inline-block; background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .price-box { background-color: #020617; border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .btn { display: block; text-align: center; background-color: #10b981; color: #020617; font-weight: 700; padding: 14px 24px; border-radius: 10px; text-decoration: none; margin-top: 24px; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🚨 Price Drop Detected</div>
    <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0;">
      ${options.gpuModel} dropped to $${options.currentPrice.toFixed(2)}/hr!
    </h1>
    <p style="color: #94a3b8; font-size: 14px; margin: 0;">
      Available on <strong>${options.provider}</strong> • Your target alert was $${options.targetPrice.toFixed(2)}/hr.
    </p>

    <div class="price-box">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
        <span style="font-size: 13px; color: #94a3b8;">Live Spot Rate:</span>
        <span style="font-size: 24px; font-weight: 800; color: #10b981;">$${options.currentPrice.toFixed(2)} / hr</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #94a3b8; border-top: 1px solid #1e293b; padding-top: 8px;">
        <span>AWS EC2 Equivalent:</span>
        <span style="color: #f87171; text-decoration: line-through;">$${options.awsPrice.toFixed(2)} / hr</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #94a3b8; margin-top: 6px;">
        <span>Arbitrage Cost Savings:</span>
        <span style="color: #34d399; font-weight: bold;">${options.savingsPercent} below AWS</span>
      </div>
    </div>

    <a href="${options.directUrl || 'https://data.dynep.com'}" class="btn">Deploy Instance on ${options.provider} →</a>

    <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #64748b;">
      Dynep Autonomous Spot Market Engine • <a href="https://data.dynep.com" style="color: #10b981; text-decoration: none;">data.dynep.com</a>
    </div>
  </div>
</body>
</html>`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: `🚨 SPOT DROP: ${options.gpuModel} at $${options.currentPrice.toFixed(2)}/hr on ${options.provider} (${options.savingsPercent} off AWS)`,
          html: htmlContent,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
