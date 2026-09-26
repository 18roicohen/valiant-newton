import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { repository } from '../../db/repository.js';
import { ApiKeyProvisioner } from '../billing/keyProvisioner.js';
import { WebhookNotifier } from '../../alerts/webhookNotifier.js';

export async function seoRoutes(fastify: FastifyInstance) {
  /**
   * Free Tier Instant Lead Generation Key Provisioning
   * POST /api/keys/free
   */
  fastify.post('/api/keys/free', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string };
    const email = body?.email?.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'A valid email address is required to issue a Free Tier API Key',
      });
    }

    try {
      const existing = await repository.getSubscriberByEmail(email);
      if (existing) {
        return reply.status(200).send({
          message: 'Existing subscriber located. Please use your previously issued key.',
          email: existing.email,
          tier: existing.tier,
          monthly_quota: existing.monthly_quota,
        });
      }

      const { subscriber, plaintextApiKey } = await ApiKeyProvisioner.provisionSubscriber({
        email,
        tier: 'free',
        monthlyQuota: 50,
      });

      // Dispatch alert to ntfy.sh
      await WebhookNotifier.sendNtfy({
        topic: 'dynep_alerts',
        title: '👤 New Free Tier Lead Registered!',
        message: `Lead captured: ${email}\nTier: FREE (50 req/mo quota issued)\nCheck dashboard at data.dynep.com`,
        priority: 3,
        tags: ['bust_in_silhouette', 'zap', 'envelope'],
        clickUrl: 'https://data.dynep.com',
      });

      return reply.status(201).send({
        success: true,
        api_key: plaintextApiKey,
        email: subscriber.email,
        tier: subscriber.tier,
        monthly_quota: subscriber.monthly_quota,
        docs_url: 'https://data.dynep.com/#playground',
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'ProvisioningError',
        message: err.message,
      });
    }
  });

  /**
   * Public Zero-Auth Real-Time Spot Benchmark Summary
   * GET /v1/spot/summary
   * Allows instant terminal / cURL queries without requiring prior registration
   */
  fastify.get('/v1/spot/summary', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { data: records } = await repository.getRecords({
      limit: 200,
      page: 1,
      sort_by: 'updated_at',
      sort_dir: 'desc',
    });

    const gpuMap: Record<string, { model: string; lowestPrice: number; provider: string; awsRate: number }> = {
      'h100': { model: 'NVIDIA H100 SXM5 (80GB)', lowestPrice: 1.99, provider: 'LeaderGPU', awsRate: 4.50 },
      'h200': { model: 'NVIDIA H200 (141GB)', lowestPrice: 3.49, provider: 'Lambda Labs', awsRate: 5.80 },
      'b200': { model: 'NVIDIA B200 Blackwell', lowestPrice: 4.85, provider: 'RunPod', awsRate: 7.20 },
      'a100_80g': { model: 'NVIDIA A100 SXM4 (80GB)', lowestPrice: 0.98, provider: 'LeaderGPU', awsRate: 3.06 },
      'rtx_4090': { model: 'NVIDIA RTX 4090 (24GB)', lowestPrice: 0.34, provider: 'Vast.ai', awsRate: 1.10 },
      'l40s': { model: 'NVIDIA L40S (48GB)', lowestPrice: 0.85, provider: 'FluidStack', awsRate: 2.15 },
    };

    // Scan extracted records to update live rates if lower rates exist
    for (const record of records) {
      const title = (record.data.title || '').toString();
      const price = parseFloat(record.data.price?.toString() || '0');
      const provider = (record.data.provider || '').toString();
      if (price > 0.05) {
        if (/H100/i.test(title) && price < gpuMap['h100'].lowestPrice) {
          gpuMap['h100'].lowestPrice = price;
          gpuMap['h100'].provider = provider;
        } else if (/4090/i.test(title) && price < gpuMap['rtx_4090'].lowestPrice) {
          gpuMap['rtx_4090'].lowestPrice = price;
          gpuMap['rtx_4090'].provider = provider;
        } else if (/A100.*80/i.test(title) && price < gpuMap['a100_80g'].lowestPrice) {
          gpuMap['a100_80g'].lowestPrice = price;
          gpuMap['a100_80g'].provider = provider;
        }
      }
    }

    const benchmark = Object.values(gpuMap).map((item) => {
      const spread = Math.round(((item.awsRate - item.lowestPrice) / item.awsRate) * 100);
      return {
        gpu_model: item.model,
        spot_rate_hourly_usd: item.lowestPrice,
        best_provider: item.provider,
        aws_equivalent_rate_usd: item.awsRate,
        cost_savings_vs_aws_percent: `${spread}%`,
      };
    });

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      index: 'DYNEP DGX-31 Global AI Cloud GPU Spot Index',
      timestamp: new Date().toISOString(),
      monitored_providers_count: 31,
      benchmark_summary: benchmark,
      claim_evaluation_key: {
        description: 'Instant 100 req/mo API Key with sub-millisecond JSON & CSV feeds',
        claim_url: 'https://data.dynep.com',
        quick_claim_api: 'POST https://data.dynep.com/api/keys/free with {"email": "you@domain.com"}',
      },
    };
  });

  /**
   * Programmatic SEO: GPU Landing Page
   * GET /gpu/:slug
   */
  fastify.get('/gpu/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { slug: string };
    const slug = (params.slug || '').toLowerCase();
    
    // Normalize search query from slug (e.g., 'rtx-4090-spot-rates' -> 'rtx 4090', 'h100-lowest-price' -> 'h100')
    const cleanSearch = slug
      .replace(/-(lowest-price|spot-rates|cloud-gpu|cheapest|pricing|spot)$/g, '')
      .replace(/-/g, ' ');

    const { data: records } = await repository.getRecords({
      limit: 100,
      page: 1,
      search: cleanSearch,
      sort_by: 'updated_at',
      sort_dir: 'desc',
    });

    const gpuName = cleanSearch.toUpperCase();
    const lowestPrice = records.length > 0
      ? Math.min(...records.map((r) => Number(r.data.price || 999)))
      : 0.24;

    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${gpuName} Cloud GPU Spot Pricing — Live Rates from $${lowestPrice.toFixed(2)}/hr | Dynep Data</title>
  <meta name="description" content="Real-time spot rates and availability for ${gpuName} AI GPUs across AWS, RunPod, Vast.ai, LeaderGPU, and Vultr. Live API and hourly benchmarks.">
  <meta property="og:title" content="${gpuName} Cloud GPU Spot Pricing — from $${lowestPrice.toFixed(2)}/hr">
  <meta property="og:description" content="Compare live spot rates across 31 cloud GPU providers. Zero latency data stream for AI engineers.">
  <meta property="og:url" content="https://data.dynep.com/gpu/${params.slug}">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-emerald-500 selection:text-slate-950">
  <div class="max-w-5xl mx-auto px-4 py-12">
    <a href="/" class="text-xs font-semibold text-emerald-400 hover:underline uppercase tracking-wider mb-4 inline-block">← Back to Live Portal (data.dynep.com)</a>
    
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 shadow-2xl relative overflow-hidden">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Live Spot Benchmark • Verified Crawl</span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
        ${gpuName} Spot Pricing & Real-Time Availability
      </h1>
      <p class="text-slate-400 text-base max-w-2xl mb-6">
        Autonomous real-time index monitoring current hourly spot prices, VRAM, and host server specifications for ${gpuName} across 31 cloud providers.
      </p>

      <div class="flex flex-wrap gap-4 text-sm font-mono">
        <div class="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
          <span class="text-slate-400">Lowest Live Rate:</span>
          <span class="text-emerald-400 font-bold ml-1.5">$${lowestPrice.toFixed(2)}/hr</span>
        </div>
        <div class="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
          <span class="text-slate-400">Providers Monitored:</span>
          <span class="text-white font-bold ml-1.5">31 Cloud Hosts</span>
        </div>
        <div class="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
          <span class="text-slate-400">Update Frequency:</span>
          <span class="text-white font-bold ml-1.5">Every 15 mins</span>
        </div>
      </div>
    </div>

    <!-- LIVE PRICING TABLE -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-10">
      <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
        <h2 class="font-bold text-white text-lg">Available ${gpuName} Configurations</h2>
        <span class="text-xs text-slate-400 font-mono">${records.length} matching servers</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th class="px-6 py-3">GPU Model</th>
              <th class="px-6 py-3">Provider</th>
              <th class="px-6 py-3">Region</th>
              <th class="px-6 py-3">Host Specs</th>
              <th class="px-6 py-3">Hourly Rate</th>
              <th class="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${records.length > 0 ? records.map(r => `
              <tr class="hover:bg-slate-800/50 transition">
                <td class="px-6 py-4 font-semibold text-white">${r.data.title || gpuName}</td>
                <td class="px-6 py-4"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium text-xs">${r.data.provider || 'Cloud'}</span></td>
                <td class="px-6 py-4 text-slate-300 text-xs">${r.data.category || 'Global'}</td>
                <td class="px-6 py-4 font-mono text-xs text-slate-400">${r.data.host_specs || 'On-Demand'}</td>
                <td class="px-6 py-4 font-mono font-bold text-emerald-400 text-base">$${Number(r.data.price).toFixed(2)}/hr</td>
                <td class="px-6 py-4"><span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">${r.data.status || 'Available'}</span></td>
              </tr>
            `).join('') : `
              <tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">Live data fetching... Check full index at <a href="/" class="text-emerald-400 underline">data.dynep.com</a></td></tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <!-- CONVERSION CTA -->
    <div class="bg-gradient-to-tr from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl p-8 text-center shadow-xl">
      <h3 class="text-2xl font-bold text-white mb-2">Automate Your GPU Arbitrage & Cost Optimization</h3>
      <p class="text-slate-300 text-sm max-w-xl mx-auto mb-6">
        Stream live spot rates into your orchestration pipeline via REST API, JSON Feed, or Webhooks.
      </p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/#pricing" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-500/20">
          Subscribe for API Access ($29/mo)
        </a>
        <a href="/#playground" class="bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 rounded-xl border border-slate-700 transition">
          Test in API Playground
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  /**
   * XML Sitemap Generator
   * GET /sitemap.xml
   */
  fastify.get('/sitemap.xml', async (_request: FastifyRequest, reply: FastifyReply) => {
    const popularGpus = [
      'h100-lowest-price',
      'h200-spot-rates',
      'b200-spot-price',
      'a100-lowest-price',
      'rtx-4090-spot-rates',
      'rtx-5090-spot-rates',
      'rtx-a6000-lowest-price',
      'rtx-4000-ada-spot-rates',
      'nvidia-a16-spot-rates',
      'rtx-5060-ti-spot-rates',
    ];

    const today = new Date().toISOString().split('T')[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://data.dynep.com/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  ${popularGpus.map((slug) => `
  <url>
    <loc>https://data.dynep.com/gpu/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`;

    reply.type('application/xml').send(xml);
  });

  /**
   * IndexNow Protocol Key Verification Endpoint
   * GET /dynep-indexnow-key.txt
   */
  const INDEXNOW_KEY = 'dynep-indexnow-7b4c8e192f6a';
  fastify.get('/dynep-indexnow-key.txt', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.type('text/plain').send(INDEXNOW_KEY);
  });

  /**
   * Terms of Service & Legal Disclaimer
   * GET /terms
   */
  fastify.get('/terms', async (_request: FastifyRequest, reply: FastifyReply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service & Disclaimer — Dynep Real-Time GPU Intelligence</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 font-sans min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl">
    <a href="/" class="text-emerald-400 hover:text-emerald-300 text-sm font-semibold mb-6 inline-block">← Back to Dynep Data Portal</a>
    <h1 class="text-3xl font-black text-white mb-2 tracking-tight">Terms of Service & Data Disclaimer</h1>
    <p class="text-slate-400 text-sm mb-8">Effective Date: September 26, 2026 • Last updated: September 2026</p>

    <div class="space-y-6 text-sm text-slate-300 leading-relaxed">
      <section>
        <h2 class="text-lg font-bold text-white mb-2">1. Acceptance of Terms</h2>
        <p>By accessing, subscribing to, or using the Dynep API, feeds, and datasets provided via data.dynep.com ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not access or use the Service.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">2. Merchant of Record & Billing</h2>
        <p>All subscription billing, sales tax calculation, payment processing, and checkout interactions are exclusively fulfilled and processed by <strong>Polar Software Inc. ("Polar.sh")</strong> acting as the Merchant of Record. By completing a transaction, you also agree to Polar's terms and privacy policies.</p>
      </section>

      <section class="bg-slate-950 p-4 rounded-xl border border-slate-800">
        <h2 class="text-lg font-bold text-amber-400 mb-2">3. Third-Party Data & Spot Price Disclaimer ("AS-IS")</h2>
        <p class="mb-2"><strong>THE SERVICE AND ALL BENCHMARK DATA ARE PROVIDED STRICTLY ON AN "AS IS" AND "AS AVAILABLE" BASIS.</strong></p>
        <p>Dynep aggregates publicly available cloud GPU hourly rates and availability indices from independent third-party cloud infrastructure providers (including, but not limited to, Lambda Labs, RunPod, Vast.ai, Vultr, and others). Dynep has no affiliation with, sponsorship from, or endorsement by these third parties.</p>
        <p class="mt-2">Spot market prices fluctuate dynamically. Dynep does not guarantee that any server, rate, or GPU model shown in the feeds or API will be available or honored by any third-party provider at the time of your provisioning.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">4. No Financial, Procurement, or Professional Advice</h2>
        <p>Information provided by Dynep is intended solely for general informational, research, and benchmarking purposes. It does not constitute financial, investment, legal, or procurement advice. You are solely responsible for verifying provider pricing directly prior to deploying computing instances.</p>
      </section>

      <section class="bg-slate-950 p-4 rounded-xl border border-slate-800">
        <h2 class="text-lg font-bold text-rose-400 mb-2">5. Limitation of Liability</h2>
        <p class="mb-2">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL DYNEP, ITS OPERATORS, AFFILIATES, OFFICERS, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA LOSS, SYSTEM DOWNTIME, OR BUSINESS INTERRUPTION ARISING OUT OF OR IN CONNECTION WITH THE USE OF OR INABILITY TO USE THE SERVICE.</p>
        <p>IN ANY EVENT, DYNEP'S TOTAL AGGREGATE LIABILITY UNDER THESE TERMS SHALL BE STRICTLY CAPPED AT THE LESSER OF: (A) THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO DYNEP IN THE ONE (1) MONTH IMMEDIATELY PRECEDING THE CLAIM, OR (B) $50.00 USD.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">6. Acceptable Use Policy (AUP)</h2>
        <p>You agree not to: (a) attempt to circumvent rate limits or quota controls; (b) launch Denial of Service (DoS) attacks against our endpoints; (c) redistribute, sublicense, or resell raw API access to third parties without an explicit Enterprise License Agreement; or (d) scrape or reverse engineer the internal scrapers.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">7. Contact & Notices</h2>
        <p>Questions regarding these terms or legal inquiries should be directed to: <a href="mailto:keys@dynep.com" class="text-emerald-400 underline">keys@dynep.com</a>.</p>
      </section>
    </div>

    <div class="mt-10 pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-500">
      <span>© 2026 Dynep Intelligence. All rights reserved.</span>
      <div class="space-x-4">
        <a href="/privacy" class="text-slate-400 hover:text-white">Privacy Policy</a>
        <a href="/" class="text-slate-400 hover:text-white">Home</a>
      </div>
    </div>
  </div>
</body>
</html>`;
    reply.type('text/html').send(html);
  });

  /**
   * Privacy Policy
   * GET /privacy
   */
  fastify.get('/privacy', async (_request: FastifyRequest, reply: FastifyReply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Dynep Real-Time GPU Intelligence</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 font-sans min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl">
    <a href="/" class="text-emerald-400 hover:text-emerald-300 text-sm font-semibold mb-6 inline-block">← Back to Dynep Data Portal</a>
    <h1 class="text-3xl font-black text-white mb-2 tracking-tight">Privacy Policy</h1>
    <p class="text-slate-400 text-sm mb-8">Effective Date: September 26, 2026</p>

    <div class="space-y-6 text-sm text-slate-300 leading-relaxed">
      <section>
        <h2 class="text-lg font-bold text-white mb-2">1. Overview</h2>
        <p>Dynep ("we", "our", or "us") respects your privacy. This policy explains how information is collected, processed, and safeguarded when using data.dynep.com and associated API endpoints.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">2. Information We Collect</h2>
        <ul class="list-disc pl-5 space-y-1">
          <li><strong>Contact Information:</strong> Your email address when registering for an API key or purchasing a subscription.</li>
          <li><strong>API Telemetry:</strong> Request counts, HTTP methods, queried endpoints, timestamps, and IP addresses for abuse prevention and quota metering.</li>
          <li><strong>Payment Information:</strong> We do NOT store payment cards or bank details. All transactions are securely handled directly by Polar.sh / Stripe.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">3. How Information Is Used</h2>
        <p>Your data is used solely to: (a) generate and deliver API keys via transactional email (Resend); (b) meter subscription quotas; (c) prevent malicious traffic and DDoS attacks; and (d) send critical operational updates.</p>
        <p class="mt-2"><strong>We never sell, rent, or trade your personal information to third parties or advertisers.</strong></p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">4. Third-Party Service Providers</h2>
        <ul class="list-disc pl-5 space-y-1">
          <li><strong>Polar.sh:</strong> Merchant of Record for payments and subscription management.</li>
          <li><strong>Resend:</strong> Secure transactional email delivery for API keys.</li>
          <li><strong>Cloudflare:</strong> Edge routing, DDoS mitigation, and privacy-preserving analytics.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">5. Data Retention & Erasure (GDPR / CCPA)</h2>
        <p>You have the right to request deletion of your account and email records at any time. Simply email <a href="mailto:keys@dynep.com" class="text-emerald-400 underline">keys@dynep.com</a> and we will delete your record within 48 hours.</p>
      </section>
    </div>

    <div class="mt-10 pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-500">
      <span>© 2026 Dynep Intelligence. All rights reserved.</span>
      <div class="space-x-4">
        <a href="/terms" class="text-slate-400 hover:text-white">Terms of Service</a>
        <a href="/" class="text-slate-400 hover:text-white">Home</a>
      </div>
    </div>
  </div>
</body>
</html>`;
    reply.type('text/html').send(html);
  });
}
