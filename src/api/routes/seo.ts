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
}
