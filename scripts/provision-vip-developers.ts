import { ApiKeyProvisioner } from '../src/api/billing/keyProvisioner.js';
import { repository } from '../src/db/repository.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/db/client.js';

interface TargetDeveloper {
  name: string;
  organization: string;
  email: string;
  useCase: string;
  focusGpu: string;
}

const TARGET_DEVELOPERS: TargetDeveloper[] = [
  {
    name: 'AI Infrastructure Team',
    organization: 'LocalLLaMA Cluster Ops',
    email: 'cluster-lead@localllama-community.org',
    useCase: 'Benchmarking 8x H100 vs Vast.ai RTX 4090 clusters for 70B model inference',
    focusGpu: 'H100 SXM5 / RTX 4090',
  },
  {
    name: 'ML Platform Lead',
    organization: 'Open-Weights Training Lab',
    email: 'infra@weights-finetuning.io',
    useCase: 'Automating multi-cloud Spot GPU preemption failovers with Slurm/Ray',
    focusGpu: 'H100 PCIe / A100 80GB',
  },
  {
    name: 'DevOps & FinOps Architect',
    organization: 'Synthetica AI',
    email: 'devops@synthetica-models.com',
    useCase: 'Slashing AWS EC2 p5 cloud bills by arbitraging RunPod and LeaderGPU rates',
    focusGpu: 'H100 SXM5 80GB',
  },
  {
    name: 'Research Engineer',
    organization: 'DeepFine Research',
    email: 'research@deepfine-labs.ai',
    useCase: 'High-throughput LoRA batch finetuning on Ada Lovelace L40S/RTX 6000',
    focusGpu: 'L40S 48GB / RTX 6000 Ada',
  },
  {
    name: 'GPU Pipeline Maintainer',
    organization: 'OpenCompute Aggregators',
    email: 'integrations@open-gpu-metrics.dev',
    useCase: 'Ingesting 31-provider composite pricing into Prometheus & Grafana alerting',
    focusGpu: 'DGX-31 Composite Index',
  },
];

export async function provisionVipDevelopers(sendEmail: boolean = false) {
  console.log('====================================================');
  console.log('💎 DYNEP VIP DEVELOPER ACQUISITION & KEY PROVISIONER');
  console.log('====================================================\n');

  const results: Array<{ dev: TargetDeveloper; apiKey: string; emailSent: boolean }> = [];

  for (const dev of TARGET_DEVELOPERS) {
    try {
      let existing = await repository.getSubscriberByEmail(dev.email);
      let apiKey = '';

      if (!existing) {
        const { subscriber, plaintextApiKey } = await ApiKeyProvisioner.provisionSubscriber({
          email: dev.email,
          tier: 'starter', // Give full starter capabilities (1,000 req/mo) complimentary
          monthlyQuota: 1000,
        });
        apiKey = plaintextApiKey;
        console.log(`✅ Provisioned VIP Key for ${dev.organization} (${dev.email})`);
        console.log(`   Key: ${apiKey}`);
      } else {
        console.log(`ℹ️ Existing subscriber found for ${dev.email}`);
        apiKey = 'sk_live_active_key_on_record';
      }

      let emailSent = false;
      if (sendEmail && env.RESEND_API_KEY && apiKey.startsWith('sk_live_')) {
        const emailBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
            <div style="background: #0f172a; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
              <h1 style="color: #10b981; margin: 0; font-size: 20px; font-weight: 700;">DYNEP GPU SPOT MARKET TERMINAL</h1>
            </div>
            <p>Hi ${dev.name},</p>
            <p>We saw your team at <strong>${dev.organization}</strong> is actively working on ${dev.useCase}.</p>
            <p>We built <strong>Dynep</strong> (data.dynep.com) to track real-time spot rates and cluster availability across 31 cloud GPU providers (LeaderGPU, Lambda, RunPod, Vast.ai, AWS, Vultr) so teams don't overpay for compute.</p>
            <p>To support your pipeline, we pre-provisioned an active <strong>VIP Evaluation API Key</strong> with 1,000 free requests/mo:</p>
            <div style="background: #0f172a; color: #10b981; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; margin: 20px 0; word-break: break-all;">
              ${apiKey}
            </div>
            <p>You can run this right now in terminal to inspect live ${dev.focusGpu} rates:</p>
            <pre style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">curl -s -H "Authorization: Bearer ${apiKey}" "https://data.dynep.com/v1/data?search=${encodeURIComponent(dev.focusGpu)}"</pre>
            <p>Or view the live web terminal at <a href="https://data.dynep.com" style="color: #10b981; font-weight: 600;">data.dynep.com</a>.</p>
            <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">Dynep Engine • Automated Cloud GPU Indexing</p>
          </div>
        `;

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL || 'Dynep Intelligence <keys@dynep.com>',
            to: [dev.email],
            subject: `⚡ Pre-Provisioned GPU Spot API Key for ${dev.organization}`,
            html: emailBody,
          }),
        });

        emailSent = res.ok;
        if (emailSent) {
          console.log(`   ✉️ VIP Invitation Email delivered via Resend`);
        }
      }

      results.push({ dev, apiKey, emailSent });
    } catch (err: any) {
      console.error(`❌ Failed provisioning for ${dev.email}:`, err.message);
    }
  }

  console.log(`\n🎉 Total VIP accounts processed: ${results.length}`);
  return results;
}

if (process.argv[1]?.endsWith('provision-vip-developers.ts')) {
  const sendEmail = process.argv.includes('--send');
  provisionVipDevelopers(sendEmail).catch(console.error);
}
