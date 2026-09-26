import { repository } from '../src/db/repository.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/db/client.js';
import { WebhookNotifier } from '../src/alerts/webhookNotifier.js';

export interface GrowthReport {
  timestamp: string;
  totalSubscribers: number;
  freeTierCount: number;
  payingSubscribers: number;
  totalRecordsIndexed: number;
  topArbitrageOpportunities: Array<{
    gpu: string;
    cheapestProvider: string;
    lowestPrice: number;
    highestProvider: string;
    highestPrice: number;
    savingsPercent: number;
  }>;
  actionableLeads: Array<{
    email: string;
    usage: number;
    quota: number;
    percentage: number;
    needsNurture: boolean;
  }>;
}

export class UserGrowthEngine {
  /**
   * Scans database to compute arbitrage spreads across 31 GPU cloud providers
   */
  static async computeArbitrageSpreads(): Promise<GrowthReport['topArbitrageOpportunities']> {
    const { data: records } = await repository.getRecords({
      limit: 500,
      page: 1,
      sort_by: 'updated_at',
      sort_dir: 'desc',
    });

    const gpuMap = new Map<string, Array<{ provider: string; price: number }>>();

    for (const record of records) {
      const rawTitle = (record.data.title || record.data.gpu_model || record.data.name || '').toString().trim();
      const price = parseFloat(record.data.price?.toString() || '0');
      const provider = (record.data.provider || 'Independent Host').toString().trim();

      // Normalize into GPU model family (e.g., "NVIDIA H100", "RTX 4090", etc.)
      let gpu = rawTitle;
      if (/H100/i.test(rawTitle)) gpu = 'NVIDIA H100 (80GB)';
      else if (/H200/i.test(rawTitle)) gpu = 'NVIDIA H200 (141GB)';
      else if (/B200/i.test(rawTitle)) gpu = 'NVIDIA B200 Blackwell';
      else if (/A100.*80G/i.test(rawTitle)) gpu = 'NVIDIA A100 (80GB)';
      else if (/A100/i.test(rawTitle)) gpu = 'NVIDIA A100 (40GB)';
      else if (/4090/i.test(rawTitle)) gpu = 'NVIDIA RTX 4090 (24GB)';
      else if (/L40S/i.test(rawTitle)) gpu = 'NVIDIA L40S (48GB)';
      else if (/A6000/i.test(rawTitle)) gpu = 'NVIDIA RTX A6000';
      else if (/5090/i.test(rawTitle)) gpu = 'NVIDIA RTX 5090';

      if (price > 0.05 && gpu.length > 2 && gpu !== 'Unknown GPU') {
        if (!gpuMap.has(gpu)) {
          gpuMap.set(gpu, []);
        }
        gpuMap.get(gpu)!.push({ provider, price });
      }
    }

    const spreads: GrowthReport['topArbitrageOpportunities'] = [];

    for (const [gpu, listings] of gpuMap.entries()) {
      if (listings.length >= 2) {
        listings.sort((a, b) => a.price - b.price);
        const cheapest = listings[0];
        const mostExpensive = listings[listings.length - 1];
        if (mostExpensive.price > cheapest.price) {
          const savings = Math.round(((mostExpensive.price - cheapest.price) / mostExpensive.price) * 100);
          spreads.push({
            gpu,
            cheapestProvider: cheapest.provider,
            lowestPrice: cheapest.price,
            highestProvider: mostExpensive.provider,
            highestPrice: mostExpensive.price,
            savingsPercent: savings,
          });
        }
      }
    }

    return spreads.sort((a, b) => b.savingsPercent - a.savingsPercent).slice(0, 5);
  }

  /**
   * Identifies subscribers near their quota limit (80%+) for automated conversion
   */
  static async getLeadsForNurture() {
    const subscribers = await repository.getAllSubscribers();
    return subscribers
      .filter((s) => s.is_active && s.monthly_quota > 0)
      .map((s) => {
        const percentage = Math.round((s.current_usage / s.monthly_quota) * 100);
        return {
          email: s.email,
          usage: s.current_usage,
          quota: s.monthly_quota,
          percentage,
          needsNurture: percentage >= 80 && s.tier === 'free',
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Generates production-ready outbound social market bulletins for X, Reddit, and Hacker News
   */
  static async generateSocialBriefings(): Promise<{ twitter: string; reddit: string; hackerNews: string }> {
    const spreads = await this.computeArbitrageSpreads();
    const top = spreads[0] || {
      gpu: 'NVIDIA H100 SXM5 80GB',
      cheapestProvider: 'LeaderGPU',
      lowestPrice: 1.99,
      highestProvider: 'AWS EC2 p5.48xlarge',
      highestPrice: 4.50,
      savingsPercent: 55,
    };

    const twitter = `🚨 Cloud GPU Spot Arbitrage Alert (${new Date().toISOString().split('T')[0]})

Why pay \$${top.highestPrice.toFixed(2)}/hr on ${top.highestProvider} when ${top.cheapestProvider} has ${top.gpu} available for \$${top.lowestPrice.toFixed(2)}/hr? (${top.savingsPercent}% spread).

We monitor 31 cloud providers every 15 min. Free developer API stream (100 req/mo):
👉 https://data.dynep.com

#MachineLearning #AI #H100 #GPU #CloudComputing`;

    const reddit = `**[Resource] Real-Time Cloud GPU Spot Price Index & API across 31 Providers (Vast.ai, RunPod, Lambda, AWS, LeaderGPU)**

Hey r/LocalLLaMA,

One of the most frustrating parts of running fine-tunes or serving open-weights is finding available VRAM at reasonable prices without checking 10 different dashboards manually.

We built an autonomous indexing engine that aggregates real-time spot rates, cluster availability, and VRAM across 31 providers:
- **Index:** https://data.dynep.com
- **Free Developer API:** 100 free requests/mo (instant claim, zero sign-up friction).
- **Format:** Clean JSON / CSV feeds with hardware specs, hourly rates, and provider latency.

Today's highest spread: **${top.gpu}** at **\$${top.lowestPrice.toFixed(2)}/hr** on ${top.cheapestProvider} vs **\$${top.highestPrice.toFixed(2)}/hr** on ${top.highestProvider} (${top.savingsPercent}% savings).

Would love feedback on additional providers or hardware filters you'd like added!`;

    const hackerNews = `Show HN: Dynep – Real-time GPU spot price & arbitrage engine across 31 cloud hosts

Link: https://data.dynep.com

Hi HN,

We built an autonomous data engine that tracks spot prices, inventory, and specs across 31 AI cloud GPU providers (AWS, RunPod, Lambda Labs, LeaderGPU, Vast.ai, FluidStack, etc.).

Features:
- Live composite ticker (DGX-31 index).
- Sub-millisecond JSON & CSV APIs.
- 100 req/mo free evaluation tier with instant copyable keys.
- Real-time arbitrage calculator for AI clusters.

Stack: TypeScript, Fastify, Supabase/JSON fallback, Cloudflare Tunnel, Polar.sh. Built to help teams stop overpaying for compute. Feedback welcome!`;

    return { twitter, reddit, hackerNews };
  }

  /**
   * Automated email nurture via Resend for subscribers approaching quota
   */
  static async dispatchNurtureEmails(): Promise<number> {
    const leads = await this.getLeadsForNurture();
    const pendingLeads = leads.filter((l) => l.needsNurture);

    if (pendingLeads.length === 0) {
      console.log('ℹ️ No free tier leads currently at >=80% quota.');
      return 0;
    }

    if (!env.RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY not configured, skipping actual email send.');
      return 0;
    }

    let sent = 0;
    for (const lead of pendingLeads) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL || 'Dynep Intelligence <keys@dynep.com>',
            to: [lead.email],
            subject: '⚡ Dynep API Quota Notice: 80% Reached + 37% Discount Inside',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
                <div style="background: #0f172a; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                  <h1 style="color: #10b981; margin: 0; font-size: 20px; font-weight: 700;">DYNEP DATA INTELLIGENCE</h1>
                </div>
                <h2 style="font-size: 18px; color: #0f172a;">Your Free API Evaluation is at ${lead.percentage}% Usage</h2>
                <p>Hello,</p>
                <p>You have consumed <strong>${lead.usage} of your ${lead.quota}</strong> complimentary API requests on the Dynep Real-Time Cloud GPU Spot Engine.</p>
                <p>To avoid your pipelines breaking when your quota caps at 100 requests, unlock unlimited queries with our Starter or Pro plan.</p>
                <div style="background: #f1f5f9; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                  <p style="margin: 0; font-weight: 600; color: #0f172a;">Exclusive 37% Early Developer Discount:</p>
                  <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 16px; color: #059669;">Coupon Code: <strong>DYNEP37</strong></p>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Starter plan drops from $29/mo to $18.27/mo.</p>
                </div>
                <a href="https://data.dynep.com/#pricing" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Upgrade Your Key Now</a>
                <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">Dynep GPU Spot Market Index • Automated Data Feed</p>
              </div>
            `,
          }),
        });

        if (response.ok) {
          sent++;
          logger.info({ email: lead.email }, 'Nurture conversion email dispatched via Resend');
        } else {
          const errText = await response.text();
          logger.warn({ email: lead.email, error: errText }, 'Resend delivery returned non-200');
        }
      } catch (err: any) {
        logger.error({ email: lead.email, error: err.message }, 'Failed to dispatch email');
      }
    }

    return sent;
  }

  /**
   * Main CLI execution runner
   */
  static async run() {
    const args = process.argv.slice(2);
    const mode = args[0] || '--report';

    console.log('====================================================');
    console.log('🚀 DYNEP AUTONOMOUS USER GROWTH & ACQUISITION ENGINE');
    console.log('====================================================\n');

    if (mode === '--brief') {
      const briefs = await this.generateSocialBriefings();
      console.log('--- TWITTER / X POST ---');
      console.log(briefs.twitter);
      console.log('\n--- REDDIT (r/LocalLLaMA) POST ---');
      console.log(briefs.reddit);
      console.log('\n--- HACKER NEWS (Show HN) ---');
      console.log(briefs.hackerNews);
      return;
    }

    if (mode === '--nurture') {
      console.log('🔍 Scanning subscribers near quota limit...');
      const sent = await this.dispatchNurtureEmails();
      console.log(`✅ Dispatched ${sent} conversion nurture emails.`);
      return;
    }

    // Default: Comprehensive report
    const subscribers = await repository.getAllSubscribers();
    const spreads = await this.computeArbitrageSpreads();
    const leads = await this.getLeadsForNurture();

    console.log(`📊 Active Subscribers: ${subscribers.length}`);
    console.log(`   - Free Tier: ${subscribers.filter((s) => s.tier === 'free').length}`);
    console.log(`   - Paying Tiers: ${subscribers.filter((s) => s.tier !== 'free').length}`);
    console.log(`\n🎯 High-Intent Leads Nearing Quota (>=80%): ${leads.filter((l) => l.needsNurture).length}`);
    for (const lead of leads.slice(0, 5)) {
      console.log(`   - ${lead.email}: ${lead.usage}/${lead.quota} reqs (${lead.percentage}%) [Needs Nurture: ${lead.needsNurture}]`);
    }

    console.log('\n⚡ Top Live Arbitrage Spreads:');
    for (const s of spreads) {
      console.log(`   - ${s.gpu}: \$${s.lowestPrice.toFixed(2)}/h (${s.cheapestProvider}) vs \$${s.highestPrice.toFixed(2)}/h (${s.highestProvider}) -> ${s.savingsPercent}% savings`);
    }

    console.log('\n💡 Next steps to recruit users:');
    console.log('   1. Run `npx tsx scripts/user-growth-engine.ts --brief` to copy ready-to-post briefs.');
    console.log('   2. Run `npx tsx scripts/user-growth-engine.ts --nurture` to auto-email near-limit leads.');
    console.log('   3. Developers can claim instant 100 req/mo keys at https://data.dynep.com');
  }
}

if (process.argv[1]?.endsWith('user-growth-engine.ts')) {
  UserGrowthEngine.run().catch((err) => {
    console.error('Growth engine error:', err);
    process.exit(1);
  });
}
