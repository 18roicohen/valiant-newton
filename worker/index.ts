import { AffiliateService } from './affiliates.js';
import { EdgeScraperEngine } from './scraper.js';
import { docsHtml, termsHtml, privacyHtml, openApiSpec } from './pages.js';
import { SeoEngine } from './seo.js';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  ADMIN_API_KEY?: string;
  NTFY_TOPIC_SPOT?: string;
  NTFY_TOPIC_REVENUE?: string;
  NTFY_TOPIC_SYSTEM?: string;
  NTFY_TOPIC_DEV?: string;
  POLAR_PRODUCT_STARTER?: string;
  POLAR_PRODUCT_PRO?: string;
  POLAR_PRODUCT_ENTERPRISE?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

// Helpers
function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      ...headers,
    },
  });
}

function textResponse(text: string, status = 200, contentType = 'text/plain; charset=utf-8'): Response {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'getairmail.com',
  'mohmal.com',
]);

function enrichRecord(row: any) {
  let parsedData: any = {};
  try {
    parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
  } catch {
    parsedData = {};
  }

  const provider = row.provider || parsedData.provider || 'LeaderGPU';
  const title = row.gpu_model || parsedData.title || '';
  const deployUrl = row.deploy_url || AffiliateService.getDeployUrl(provider, title);
  const commissionPercent = AffiliateService.getCommissionPercent(provider);

  return {
    entity_id: row.entity_id,
    source_id: row.source_id,
    natural_key: row.natural_key,
    version: row.version,
    first_seen_at: row.first_seen_at,
    updated_at: row.updated_at,
    data: {
      ...parsedData,
      title: title || parsedData.title,
      provider: provider || parsedData.provider,
      price: row.price_hourly !== null && row.price_hourly !== undefined ? row.price_hourly : parsedData.price,
      vram: row.vram_gb ? `${row.vram_gb}GB` : parsedData.vram,
      category: row.region || parsedData.category || 'Global',
      deploy_url: deployUrl,
      affiliate_commission_rate: `${commissionPercent}%`,
    },
  };
}

async function sendNtfy(topic: string, title: string, message: string, priority = 3, clickUrl?: string) {
  try {
    // RFC 2047 MIME encoding prevents ByteString errors when title contains emojis
    const utf8Bytes = new TextEncoder().encode(title);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const encodedTitle = `=?utf-8?B?${btoa(binary)}?=`;

    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        Title: encodedTitle,
        Priority: String(priority),
        Tags: 'zap,bell',
        ...(clickUrl ? { Click: clickUrl } : {}),
      },
      body: message,
    });
  } catch (e) {
    console.error('Ntfy error:', e);
  }
}

async function sendResendEmail(env: Env, to: string, subject: string, html: string) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'Dynep Intelligence <keys@dynep.com>',
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error('Resend error:', e);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    // 1. Health check
    if (url.pathname === '/health') {
      const recordsCount = await env.DB.prepare('SELECT COUNT(*) as c FROM records').first<{ c: number }>();
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'cloudflare_d1_active',
        version: '2.0.0-edge-hardened',
        total_records: recordsCount?.c || 0,
        worker_region: request.cf?.colo || 'global',
      });
    }

    // 2. Metrics & Funnel
    if (url.pathname === '/v1/metrics' || url.pathname === '/v1/metrics/funnel') {
      const records = await env.DB.prepare('SELECT COUNT(*) as c FROM records').first<{ c: number }>();
      const subscribers = await env.DB.prepare('SELECT COUNT(*) as c FROM subscribers').first<{ c: number }>();
      const sources = await env.DB.prepare('SELECT COUNT(*) as c FROM sources').first<{ c: number }>();
      const alerts = await env.DB.prepare('SELECT COUNT(*) as c FROM alerts WHERE is_active = 1').first<{ c: number }>();

      return jsonResponse({
        timestamp: new Date().toISOString(),
        metrics: {
          total_records: records?.c || 0,
          total_subscribers: subscribers?.c || 0,
          total_sources: sources?.c || 0,
          active_alerts: alerts?.c || 0,
          active_sources: sources?.c || 0,
          status: 'EDGE_HEALTHY',
        },
      });
    }

    // 2.5 Documentation, Billing Portal & Legal Routes
    if (url.pathname === '/portal') {
      return Response.redirect('https://polar.sh/dynep/portal', 302);
    }

    if (url.pathname === '/docs') {
      return new Response(docsHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (url.pathname === '/openapi.json') {
      return jsonResponse(openApiSpec);
    }

    if (url.pathname === '/terms') {
      return new Response(termsHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (url.pathname === '/privacy') {
      return new Response(privacyHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 2.6 Programmatic SEO & Crawler Discovery Routes
    if (url.pathname === '/sitemap.xml') {
      return textResponse(SeoEngine.generateSitemapXml(), 200, 'application/xml; charset=utf-8');
    }

    if (url.pathname === '/dynep-indexnow-key.txt') {
      return textResponse('dynep-indexnow-7b4c8e192f6a', 200, 'text/plain; charset=utf-8');
    }

    if (url.pathname === '/.well-known/mcp.json') {
      return jsonResponse(SeoEngine.getMcpManifest(), 200, { 'Cache-Control': 'public, max-age=3600' });
    }

    if (url.pathname.startsWith('/gpu/')) {
      const profile = SeoEngine.resolveGpuProfile(url.pathname);
      if (profile) {
        let livePrice = profile.defaultSpotPrice;
        let liveProvider = profile.cheapestProvider;
        try {
          const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT 100').all<any>();
          for (const r of results) {
            const text = (r.gpu_model || r.natural_key || r.data || '').toLowerCase();
            if (text.includes(profile.gpuFamily.toLowerCase())) {
              const p = r.price_hourly;
              if (p && p > 0.05 && p < livePrice) {
                livePrice = p;
                liveProvider = r.provider || liveProvider;
              }
            }
          }
        } catch {}
        const html = SeoEngine.renderGpuPage(profile, livePrice, liveProvider);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=600',
          },
        });
      }
    }

    if (url.pathname.startsWith('/compare/')) {
      const slug = url.pathname.replace(/^\/compare\//, '').replace(/\/$/, '');
      const html = SeoEngine.renderComparisonPage(slug);
      if (html) {
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=600',
          },
        });
      }
    }

    // 3. Dynamic GitHub Badges: /badge/:gpu.svg (e.g. /badge/h100.svg)
    if (url.pathname.startsWith('/badge/')) {
      const gpuParam = url.pathname.replace('/badge/', '').replace('.svg', '').toLowerCase();
      let label = 'H100 SPOT';
      let price = '$1.99/h';
      let provider = 'LeaderGPU';

      if (gpuParam.includes('4090')) {
        label = 'RTX 4090';
        price = '$0.34/h';
        provider = 'Vast.ai';
      } else if (gpuParam.includes('5090')) {
        label = 'RTX 5090';
        price = '$0.79/h';
        provider = 'TensorDock';
      } else if (gpuParam.includes('a100')) {
        label = 'A100 80GB';
        price = '$0.68/h';
        provider = 'LeaderGPU';
      } else if (gpuParam.includes('b200')) {
        label = 'B200';
        price = '$4.85/h';
        provider = 'RunPod';
      } else if (gpuParam.includes('h200')) {
        label = 'H200';
        price = '$3.49/h';
        provider = 'Lambda';
      } else if (gpuParam.includes('l40s')) {
        label = 'L40S';
        price = '$0.85/h';
        provider = 'FluidStack';
      } else if (gpuParam.includes('a6000')) {
        label = 'RTX A6000';
        price = '$0.55/h';
        provider = 'RunPod';
      } else if (gpuParam.includes('composite')) {
        label = 'DGX-31';
        price = '31 Hosts';
        provider = 'LIVE';
      }

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="20" role="img" aria-label="${label}: ${price} (${provider})">
  <linearGradient id="b" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <mask id="a"><rect width="220" height="20" rx="3" fill="#fff"/></mask>
  <g mask="url(#a)">
    <path fill="#070a13" d="M0 0h85v20H0z"/>
    <path fill="#059669" d="M85 0h135v20H85z"/>
    <path fill="url(#b)" d="M0 0h220v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="11">
    <text x="42.5" y="15" fill="#94a3b8" font-weight="bold">${label}</text>
    <text x="152.5" y="15" font-weight="bold">${price} (${provider})</text>
  </g>
</svg>
      `.trim();

      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      });
    }

    // 4. Model Context Protocol (MCP) JSON-RPC 2.0 Endpoint for Cursor & Claude Desktop
    if (url.pathname === '/v1/agent/mcp' && method === 'POST') {
      try {
        const rpc: any = await request.json();
        const { id, method: rpcMethod, params } = rpc;

        if (rpcMethod === 'initialize') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'dynep-spot-intelligence', version: '2.0.0' },
            },
          });
        }

        if (rpcMethod === 'tools/list') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'get_cheapest_gpu',
                  description: 'Finds the lowest real-time spot price, best cloud provider, and direct deploy URL for any AI GPU accelerator across 31 clouds.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      gpu_model: { type: 'string', description: 'Target GPU family e.g. H100, H200, B200, A100, RTX 4090, L40S' },
                    },
                    required: ['gpu_model'],
                  },
                },
                {
                  name: 'calculate_cluster_arbitrage',
                  description: 'Calculates cost delta and monthly dollar savings between AWS EC2 On-Demand and Dynep verified spot clusters.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      gpu_model: { type: 'string', description: 'Target GPU e.g. H100, A100, 4090' },
                      gpu_count: { type: 'number', default: 8, description: 'Number of GPUs in cluster' },
                      hours: { type: 'number', default: 720, description: 'Hours per month (default 720)' },
                    },
                    required: ['gpu_model'],
                  },
                },
              ],
            },
          });
        }

        if (rpcMethod === 'tools/call') {
          const { name, arguments: args } = params || {};

          if (name === 'get_cheapest_gpu') {
            const targetGpu = (args?.gpu_model || 'H100').toLowerCase();
            const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT 150').all<any>();

            let bestMatch: any = null;
            let lowestPrice = 99999;

            for (const r of results) {
              const text = (r.gpu_model || r.natural_key || r.data || '').toLowerCase();
              if (text.includes(targetGpu)) {
                let price = r.price_hourly;
                if (!price) {
                  try {
                    const parsed = JSON.parse(r.data);
                    price = parseFloat(parsed.price);
                  } catch {}
                }
                if (price && price > 0.05 && price < lowestPrice) {
                  lowestPrice = price;
                  bestMatch = r;
                }
              }
            }

            const provider = bestMatch?.provider || (targetGpu.includes('4090') ? 'Vast.ai' : 'LeaderGPU');
            const finalPrice = lowestPrice < 99999 ? lowestPrice : (targetGpu.includes('4090') ? 0.34 : 1.99);
            const deployUrl = AffiliateService.getDeployUrl(provider, args.gpu_model);

            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Cheapest ${args.gpu_model.toUpperCase()}: $${finalPrice.toFixed(2)}/hr on ${provider}. Deploy directly: ${deployUrl}`,
                  },
                ],
              },
            });
          }

          if (name === 'calculate_cluster_arbitrage') {
            const gpu = (args?.gpu_model || 'H100').toLowerCase();
            const count = Number(args?.gpu_count) || 8;
            const hours = Number(args?.hours) || 720;

            const awsRate = gpu.includes('4090') ? 1.10 : gpu.includes('a100') ? 3.06 : gpu.includes('b200') ? 7.20 : 4.50;
            const spotRate = gpu.includes('4090') ? 0.34 : gpu.includes('a100') ? 0.68 : gpu.includes('b200') ? 4.85 : 1.99;
            const provider = gpu.includes('4090') ? 'Vast.ai' : 'LeaderGPU';

            const awsTotal = Math.round(awsRate * count * hours);
            const spotTotal = Math.round(spotRate * count * hours);
            const savings = awsTotal - spotTotal;
            const deployUrl = AffiliateService.getDeployUrl(provider, gpu);

            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Cluster Arbitrage for ${count}x ${gpu.toUpperCase()}: AWS On-Demand: $${awsTotal.toLocaleString()}/mo vs Dynep Spot: $${spotTotal.toLocaleString()}/mo ($${spotRate}/hr on ${provider}). Net Savings: $${savings.toLocaleString()}/mo (${Math.round((savings / awsTotal) * 100)}% off). Provision: ${deployUrl}`,
                  },
                ],
              },
            });
          }
        }

        return jsonResponse({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
      } catch (err: any) {
        return jsonResponse({ jsonrpc: '2.0', id: null, error: { code: -32603, message: err.message } }, 500);
      }
    }

    // 5. Spot Summary (Zero-auth benchmark with Edge Cache API)
    if (url.pathname === '/v1/spot/summary') {
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const cacheKey = new Request(url.toString(), request);
      const cached = cache ? await cache.match(cacheKey) : null;
      if (cached) {
        return cached;
      }

      const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT 200').all<any>();

      const gpuMap: Record<string, { model: string; lowestPrice: number; provider: string; awsRate: number }> = {
        h100: { model: 'NVIDIA H100 SXM5 (80GB)', lowestPrice: 1.99, provider: 'LeaderGPU', awsRate: 4.5 },
        h200: { model: 'NVIDIA H200 (141GB)', lowestPrice: 3.49, provider: 'Lambda Labs', awsRate: 5.8 },
        b200: { model: 'NVIDIA B200 Blackwell', lowestPrice: 4.85, provider: 'RunPod', awsRate: 7.2 },
        a100_80g: { model: 'NVIDIA A100 SXM4 (80GB)', lowestPrice: 0.68, provider: 'LeaderGPU', awsRate: 3.06 },
        rtx_4090: { model: 'NVIDIA RTX 4090 (24GB)', lowestPrice: 0.34, provider: 'Vast.ai', awsRate: 1.1 },
        l40s: { model: 'NVIDIA L40S (48GB)', lowestPrice: 0.85, provider: 'FluidStack', awsRate: 2.15 },
      };

      for (const row of results) {
        try {
          const item = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
          const title = (row.gpu_model || item.title || '').toString();
          const price = parseFloat(row.price_hourly || item.price || '0');
          const provider = (row.provider || item.provider || '').toString();

          if (price > 0.05) {
            if (/H100/i.test(title) && price < gpuMap.h100.lowestPrice) {
              gpuMap.h100.lowestPrice = price;
              gpuMap.h100.provider = provider;
            } else if (/4090/i.test(title) && price < gpuMap.rtx_4090.lowestPrice) {
              gpuMap.rtx_4090.lowestPrice = price;
              gpuMap.rtx_4090.provider = provider;
            } else if (/A100.*80/i.test(title) && price < gpuMap.a100_80g.lowestPrice) {
              gpuMap.a100_80g.lowestPrice = price;
              gpuMap.a100_80g.provider = provider;
            }
          }
        } catch {}
      }

      const benchmark = Object.values(gpuMap).map((item) => {
        const spread = Math.round(((item.awsRate - item.lowestPrice) / item.awsRate) * 100);
        return {
          gpu_model: item.model,
          spot_rate_hourly_usd: item.lowestPrice,
          best_provider: item.provider,
          aws_equivalent_rate_usd: item.awsRate,
          cost_savings_vs_aws_percent: `${spread}%`,
          deploy_url: AffiliateService.getDeployUrl(item.provider, item.model),
        };
      });

      const response = jsonResponse(
        {
          index: 'DYNEP DGX-31 Global AI Cloud GPU Spot Index',
          timestamp: new Date().toISOString(),
          monitored_providers_count: 31,
          benchmark_summary: benchmark,
          meta: {
            rate_limit: 'Unauthenticated Edge Snapshot (refreshed every 15m)',
            claim_evaluation_key: {
              description: 'Instant 100 req/mo API Key with sub-millisecond JSON & CSV feeds',
              claim_url: 'https://data.dynep.com',
              quick_claim_api: 'POST https://data.dynep.com/api/keys/free with {"email": "you@domain.com"}',
            },
            mcp_server: 'npx -y dynep-spot --mcp',
            github_badge_embed: 'https://data.dynep.com/badge/h100.svg',
          },
        },
        200,
        {
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
          'CDN-Cache-Control': 'max-age=60',
        }
      );

      if (cache) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    }

    // 6. Spot Instances for Frontend Table (with Edge Caching)
    if (url.pathname === '/v1/spot/instances') {
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const cacheKey = new Request(url.toString(), request);
      const cached = cache ? await cache.match(cacheKey) : null;
      if (cached) {
        return cached;
      }

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 250);
      const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT ?').bind(limit).all();
      const enriched = results.map(enrichRecord);
      const totalCount = await env.DB.prepare('SELECT COUNT(*) as c FROM records').first<{ c: number }>();

      const response = jsonResponse(
        {
          status: 'ok',
          count: enriched.length,
          total: totalCount?.c || 0,
          data: enriched,
        },
        200,
        {
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=180',
          'CDN-Cache-Control': 'max-age=60',
        }
      );

      if (cache) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    }

    // 7. Agent Arbitrage endpoint
    if (url.pathname === '/v1/agent/arbitrage') {
      const gpuParam = (url.searchParams.get('gpu') || 'H100').toLowerCase();
      const count = parseInt(url.searchParams.get('count') || '8', 10);
      const hours = parseInt(url.searchParams.get('hours') || '720', 10);

      const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT 200').all<any>();

      let lowest = 1.99;
      let bestProvider = 'LeaderGPU';
      let awsRate = 4.50;

      if (gpuParam.includes('4090')) {
        lowest = 0.34;
        bestProvider = 'Vast.ai';
        awsRate = 1.10;
      } else if (gpuParam.includes('a100')) {
        lowest = 0.68;
        bestProvider = 'LeaderGPU';
        awsRate = 3.06;
      } else if (gpuParam.includes('h200')) {
        lowest = 3.49;
        bestProvider = 'Lambda Labs';
        awsRate = 5.80;
      } else if (gpuParam.includes('b200')) {
        lowest = 4.85;
        bestProvider = 'RunPod';
        awsRate = 7.20;
      }

      for (const row of results) {
        try {
          const item = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
          const price = parseFloat(row.price_hourly || item.price);
          const title = (row.gpu_model || item.title || '').toLowerCase();
          if (price > 0.05 && title.includes(gpuParam) && price < lowest) {
            lowest = price;
            bestProvider = row.provider || item.provider || bestProvider;
          }
        } catch {}
      }

      const awsTotal = Math.round(awsRate * count * hours * 100) / 100;
      const spotTotal = Math.round(lowest * count * hours * 100) / 100;
      const netSavings = Math.round((awsTotal - spotTotal) * 100) / 100;
      const savingsPct = Math.round(((awsRate - lowest) / awsRate) * 100);

      return jsonResponse({
        decision: 'ARBITRAGE_RECOMMENDED',
        target_gpu: gpuParam.toUpperCase(),
        cluster_size: count,
        workload_duration_hours: hours,
        cost_comparison: {
          aws_on_demand_total_usd: awsTotal,
          best_spot_total_usd: spotTotal,
          net_savings_usd: netSavings,
          savings_percent: `${savingsPct}%`,
        },
        recommended_route: {
          provider: bestProvider,
          rate_per_gpu_hour_usd: lowest,
          deploy_url: AffiliateService.getDeployUrl(bestProvider, gpuParam),
        },
        attribution: 'DYNEP DGX-31 Real-Time GPU Spot Engine',
      });
    }

    // 8. Free & VIP API Key provisioning (with bot & disposable email protection)
    if (url.pathname === '/api/keys/free' && method === 'POST') {
      try {
        const body: any = await request.json();
        const email = (body?.email || '').trim().toLowerCase();
        const isReissue = Boolean(body?.reissue);
        const isVip = Boolean(body?.vip);
        const quota = isVip ? 1000 : 100;
        const rpm = isVip ? 60 : 15;
        const tier = isVip ? 'vip' : 'free';

        if (!email || !email.includes('@')) {
          return jsonResponse({ error: 'ValidationError', message: 'Valid corporate or developer email is required' }, 400);
        }

        const domain = email.split('@')[1];
        if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
          return jsonResponse({ error: 'DisposableEmailRejected', message: 'Disposable email providers are restricted. Please provide a standard developer or corporate domain.' }, 400);
        }

        const existing = await env.DB.prepare('SELECT * FROM subscribers WHERE email = ?').bind(email).first<any>();
        if (existing && !isReissue) {
          return jsonResponse({
            message: 'Existing subscriber located. Please use your previously issued key.',
            email: existing.email,
            tier: existing.tier,
            monthly_quota: existing.monthly_quota,
          });
        }

        const rawKey = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`;
        const keyHash = await sha256(rawKey);
        const keyPrefix = rawKey.substring(0, 15) + '...';

        if (existing && isReissue) {
          const finalQuota = Math.max(existing.monthly_quota || 0, quota);
          const finalRpm = Math.max(existing.rate_limit_rpm || 0, rpm);
          await env.DB.prepare(`
            UPDATE subscribers 
            SET api_key_hash = ?, api_key_prefix = ?, monthly_quota = ?, rate_limit_rpm = ?, is_active = 1, updated_at = datetime('now')
            WHERE email = ?
          `).bind(keyHash, keyPrefix, finalQuota, finalRpm, email).run();
        } else {
          const id = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO subscribers (id, customer_id, email, api_key_hash, api_key_prefix, tier, monthly_quota, current_usage, rate_limit_rpm, is_active)
            VALUES (?, NULL, ?, ?, ?, ?, ?, 0, ?, 1)
          `).bind(id, email, keyHash, keyPrefix, tier, quota, rpm).run();
        }

        // Send notifications
        ctx.waitUntil(sendNtfy(env.NTFY_TOPIC_DEV || 'dynep_dev', '👤 New Developer Lead', `Lead captured: ${email}\nTier: ${tier.toUpperCase()} (${quota} req/mo)`));
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #030712; color: #f8fafc; border-radius: 12px; border: 1px solid #1f2937;">
            <div style="border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
              <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; font-family: monospace; border: 1px solid rgba(16, 185, 129, 0.3);">DYNEP DGX-31 • SPOT INTELLIGENCE</span>
              <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 12px 0 0 0;">Your API Evaluation Key is Active</h1>
            </div>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
              Welcome to Dynep. Your edge API credentials have been provisioned with ${quota.toLocaleString()} complimentary requests across 31 GPU clouds.
            </p>
            <div style="background: #0b0f19; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 16px; margin: 16px 0;">
              <div style="font-size: 11px; color: #94a3b8; font-family: monospace; text-transform: uppercase;">Production API Key:</div>
              <div style="font-family: monospace; font-size: 14px; color: #10b981; font-weight: bold; margin-top: 6px; word-break: break-all;">${rawKey}</div>
            </div>
            <div style="background: #070a13; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #38bdf8; margin: 16px 0; overflow-x: auto;">
              # Quickstart check in 1 second:<br>
              curl -s -H "Authorization: Bearer ${rawKey}" "https://data.dynep.com/v1/spot/summary"
            </div>
            <div style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 14px; margin: 20px 0; border-radius: 4px;">
              <div style="color: #34d399; font-weight: bold; font-size: 13px;">Exclusive Developer Launch Discount (37% Off):</div>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">Use coupon code <strong style="color: #ffffff; font-family: monospace;">DYNEP37</strong> to unlock unlimited production feeds and webhook price drop alerts.</p>
              <a href="https://data.dynep.com/#pricing" style="display: inline-block; background: #10b981; color: #030712; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 12px; font-family: monospace; margin-top: 10px;">Upgrade Key (37% Off Pre-Applied) →</a>
            </div>
            <p style="font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 12px; font-family: monospace;">
              Dynep Global GPU Spot Intelligence Desk • <a href="https://data.dynep.com" style="color: #10b981; text-decoration: none;">data.dynep.com</a>
            </p>
          </div>
        `;

        ctx.waitUntil(
          sendResendEmail(
            env,
            email,
            '⚡ Your Dynep API Key — Real-Time Cloud GPU Intelligence',
            emailHtml
          )
        );

        return jsonResponse(
          {
            success: true,
            api_key: rawKey,
            email,
            tier: existing ? existing.tier : tier,
            monthly_quota: existing ? Math.max(existing.monthly_quota, quota) : quota,
            docs_url: 'https://data.dynep.com/#playground',
          },
          existing ? 200 : 201
        );
      } catch (err: any) {
        return jsonResponse({ error: 'ProvisioningError', message: err.message }, 500);
      }
    }

    // 9. Alert Subscribe
    if (url.pathname === '/api/alerts/subscribe' && method === 'POST') {
      try {
        const body: any = await request.json();
        const email = (body?.email || '').trim().toLowerCase();
        const gpuModel = (body?.gpu_model || '').trim();
        const targetPrice = parseFloat(body?.target_price_usd);
        const channel = body?.channel || 'email';
        const webhookUrl = body?.webhook_url || null;

        if (!email || !gpuModel || isNaN(targetPrice) || targetPrice <= 0) {
          return jsonResponse({ error: 'ValidationError', message: 'Valid email, gpu_model, and positive target price are required' }, 400);
        }

        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO alerts (id, email, gpu_model, target_price_usd, channel, webhook_url, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).bind(id, email, gpuModel, targetPrice, channel, webhookUrl).run();

        ctx.waitUntil(sendNtfy(env.NTFY_TOPIC_SPOT || 'dynep_spot', '🎯 New Spot Alert Subscribed', `${email} set alert for ${gpuModel} @ $${targetPrice}/hr`));

        return jsonResponse(
          {
            success: true,
            message: `Price drop alert activated for ${gpuModel} below $${targetPrice.toFixed(2)}/hr.`,
            alert: { id, email, gpu_model: gpuModel, target_price_usd: targetPrice, channel },
          },
          201
        );
      } catch (err: any) {
        return jsonResponse({ error: 'AlertError', message: err.message }, 500);
      }
    }

    // 10. Authenticated Data API: /v1/data (with Keyset Pagination & Rate Limit checking)
    if (url.pathname.startsWith('/v1/data')) {
      const apiKey = request.headers.get('x-api-key') || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!apiKey) {
        return jsonResponse({ error: 'Unauthorized', code: 'AUTH_HEADER_MISSING', message: 'Missing API Key. Include X-API-Key or Bearer token header.' }, 401);
      }

      const keyHash = await sha256(apiKey.trim());
      const sub = await env.DB.prepare('SELECT * FROM subscribers WHERE api_key_hash = ? AND is_active = 1').bind(keyHash).first<any>();

      if (!sub) {
        return jsonResponse({ error: 'Unauthorized', code: 'INVALID_API_KEY', message: 'Invalid or inactive API key.' }, 401);
      }

      if (sub.current_usage >= sub.monthly_quota) {
        return jsonResponse({ error: 'QuotaExceeded', message: `Monthly quota of ${sub.monthly_quota} requests reached. Upgrade at https://data.dynep.com/#pricing` }, 429);
      }

      // Increment usage in background
      ctx.waitUntil(env.DB.prepare('UPDATE subscribers SET current_usage = current_usage + 1, updated_at = datetime("now") WHERE id = ?').bind(sub.id).run());

      // Single item detail lookup
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length === 3 && pathParts[1] === 'data') {
        const entityId = pathParts[2];
        const row = await env.DB.prepare('SELECT * FROM records WHERE entity_id = ?').bind(entityId).first();
        if (!row) {
          return jsonResponse({ error: 'NotFound', message: `Record '${entityId}' not found.` }, 404);
        }
        return jsonResponse(enrichRecord(row));
      }

      // List lookup with cursor or page
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 250);
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const cursor = url.searchParams.get('cursor');

      let query = 'SELECT * FROM records';
      const bindings: any[] = [];

      if (search && cursor) {
        query += ' WHERE (LOWER(gpu_model) LIKE ? OR LOWER(provider) LIKE ?) AND updated_at < ? ORDER BY updated_at DESC LIMIT ?';
        bindings.push(`%${search}%`, `%${search}%`, cursor, limit);
      } else if (search) {
        query += ' WHERE (LOWER(gpu_model) LIKE ? OR LOWER(provider) LIKE ?) ORDER BY updated_at DESC LIMIT ?';
        bindings.push(`%${search}%`, `%${search}%`, limit);
      } else if (cursor) {
        query += ' WHERE updated_at < ? ORDER BY updated_at DESC LIMIT ?';
        bindings.push(cursor, limit);
      } else {
        query += ' ORDER BY updated_at DESC LIMIT ?';
        bindings.push(limit);
      }

      const { results } = await env.DB.prepare(query).bind(...bindings).all<any>();
      const enriched = results.map(enrichRecord);
      const nextCursor = enriched.length > 0 ? (results[results.length - 1] as any).updated_at : null;

      return jsonResponse({
        count: enriched.length,
        next_cursor: nextCursor,
        pagination: {
          count: enriched.length,
          total: enriched.length,
          cursor: nextCursor,
          limit,
        },
        data: enriched,
      });
    }

    // 11. Batch Feeds: /v1/feed.json and /v1/feed.csv
    if (url.pathname === '/v1/feed.json' || url.pathname === '/v1/feed.csv') {
      const apiKey = request.headers.get('x-api-key') || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!apiKey) {
        return jsonResponse({ error: 'Unauthorized', message: 'API key required for high-throughput batch feeds' }, 401);
      }

      const keyHash = await sha256(apiKey.trim());
      const sub = await env.DB.prepare('SELECT * FROM subscribers WHERE api_key_hash = ? AND is_active = 1').bind(keyHash).first<any>();
      if (!sub) {
        return jsonResponse({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
      }

      ctx.waitUntil(env.DB.prepare('UPDATE subscribers SET current_usage = current_usage + 5, updated_at = datetime("now") WHERE id = ?').bind(sub.id).run());

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 2000);
      const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT ?').bind(limit).all();
      const enriched = results.map(enrichRecord);

      if (url.pathname === '/v1/feed.json') {
        return jsonResponse({
          count: enriched.length,
          generated_at: new Date().toISOString(),
          feed: enriched,
        });
      }

      // RFC 4180 CSV export
      const headers = ['entity_id', 'title', 'provider', 'price', 'vram', 'category', 'status', 'deploy_url', 'updated_at'];
      const rows = [headers.join(',')];

      for (const item of enriched) {
        const d = item.data;
        const row = [
          JSON.stringify(item.entity_id),
          JSON.stringify(d.title || ''),
          JSON.stringify(d.provider || ''),
          JSON.stringify(d.price || 0),
          JSON.stringify(d.vram || ''),
          JSON.stringify(d.category || ''),
          JSON.stringify(d.status || ''),
          JSON.stringify(d.deploy_url || ''),
          JSON.stringify(item.updated_at || ''),
        ];
        rows.push(row.join(','));
      }

      return new Response(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dynep-spot-feed.csv"',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 12. Checkout initiation via Polar
    if (url.pathname === '/api/checkout/create' && method === 'POST') {
      try {
        const body: any = await request.json();
        const email = (body?.email || '').trim().toLowerCase();
        const tier = body?.tier || 'starter';

        if (!email || !email.includes('@')) {
          return jsonResponse({ error: 'ValidationError', message: 'Valid email address is required' }, 400);
        }

        const productIdMap: Record<string, string> = {
          starter: env.POLAR_PRODUCT_STARTER || '5ef8f816-2cc7-4986-bf08-d2ca27a0d5be',
          pro: env.POLAR_PRODUCT_PRO || '0c3b8529-67d6-4e7b-b4dc-bc28041cd0ab',
          enterprise: env.POLAR_PRODUCT_ENTERPRISE || '0e09696f-4a48-40be-8f63-66b3e1518e47',
        };

        const prodId = productIdMap[tier] || productIdMap.starter;

        if (env.POLAR_ACCESS_TOKEN) {
          const payload: any = {
            product_id: prodId,
            discount_id: 'a87e75bf-9fce-4960-b645-ef36efaa6eff', // DYNEP37 Pre-applied 37% discount
            success_url: 'https://data.dynep.com/?checkout=success',
          };

          if (email && email.includes('@')) {
            payload.customer_email = email;
          }

          let res = await fetch('https://api.polar.sh/v1/checkouts/custom/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Dynep-Intelligence/2.0',
            },
            body: JSON.stringify(payload),
          });

          // If email domain fails MX validation on Polar (e.g. fictional/test email 422), retry without pre-filling email
          if (res.status === 422 && payload.customer_email) {
            delete payload.customer_email;
            res = await fetch('https://api.polar.sh/v1/checkouts/custom/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Dynep-Intelligence/2.0',
              },
              body: JSON.stringify(payload),
            });
          }

          if (res.ok) {
            const checkoutData: any = await res.json();
            return jsonResponse({
              checkoutUrl: checkoutData.url,
              product: tier,
              price: tier === 'pro' ? 99 : tier === 'enterprise' ? 299 : 29,
            });
          } else {
            const errText = await res.text();
            console.error('Polar checkout creation error:', res.status, errText);
          }
        }

        // Direct product fallback
        return jsonResponse({
          checkoutUrl: `https://polar.sh/checkout/products/${prodId}`,
          product: tier,
          price: tier === 'pro' ? 99 : tier === 'enterprise' ? 299 : 29,
        });
      } catch (err: any) {
        return jsonResponse({ error: 'CheckoutError', message: err.message }, 500);
      }
    }

    // 13. Polar Webhook: /api/webhooks/polar (Automatic tier upgrading & new subscriber provisioning)
    if (url.pathname === '/api/webhooks/polar' && method === 'POST') {
      try {
        const bodyText = await request.text();
        const event = JSON.parse(bodyText);

        if (event.type === 'subscription.created' || event.type === 'order.created' || event.type === 'subscription.updated') {
          const data = event.data || {};
          const customerEmail = (
            data.customer?.email ||
            data.customer_email ||
            data.user?.email ||
            data.subscription?.customer?.email ||
            data.order?.customer?.email ||
            ''
          ).toLowerCase().trim();

          const productId = data.product_id || data.product?.id || data.subscription?.product_id;

          let tier = 'starter';
          let quota = 5000;
          let rpm = 60;

          if (productId === env.POLAR_PRODUCT_PRO) {
            tier = 'pro';
            quota = 50000;
            rpm = 300;
          } else if (productId === env.POLAR_PRODUCT_ENTERPRISE) {
            tier = 'enterprise';
            quota = 500000;
            rpm = 1200;
          }

          if (customerEmail && customerEmail.includes('@')) {
            const existing = await env.DB.prepare('SELECT * FROM subscribers WHERE email = ?').bind(customerEmail).first<any>();

            if (existing) {
              await env.DB.prepare(`
                UPDATE subscribers 
                SET tier = ?, monthly_quota = ?, rate_limit_rpm = ?, is_active = 1, updated_at = datetime('now')
                WHERE email = ?
              `).bind(tier, quota, rpm, customerEmail).run();

              const upgradeHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #030712; color: #f8fafc; border-radius: 12px; border: 1px solid #1f2937;">
                  <div style="border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
                    <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; font-family: monospace; border: 1px solid rgba(16, 185, 129, 0.3);">DYNEP DGX-31 • PAID SUBSCRIPTION</span>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 12px 0 0 0;">Your ${tier.toUpperCase()} Plan is Active</h1>
                  </div>
                  <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    Thank you for your purchase! Your Dynep API key has been upgraded to <strong>${tier.toUpperCase()}</strong>.
                  </p>
                  <div style="background: #0b0f19; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <div style="font-size: 12px; color: #94a3b8; font-family: monospace;">Account: <strong style="color: #ffffff;">${customerEmail}</strong></div>
                    <div style="font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px;">Tier: <strong style="color: #10b981;">${tier.toUpperCase()}</strong></div>
                    <div style="font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px;">Monthly Quota: <strong style="color: #38bdf8;">${quota.toLocaleString()} req/mo</strong></div>
                    <div style="font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px;">Rate Limit: <strong style="color: #38bdf8;">${rpm} RPM</strong></div>
                    <div style="font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px;">Active Key Prefix: <strong style="color: #10b981;">${existing.api_key_prefix}</strong></div>
                  </div>
                  <div style="background: #070a13; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #38bdf8; margin: 16px 0;">
                    # Test your upgraded access in 1 second:<br>
                    curl -s -H "Authorization: Bearer YOUR_API_KEY" "https://data.dynep.com/v1/data?limit=5"
                  </div>
                  <p style="font-size: 12px; color: #94a3b8; margin: 16px 0;">
                    Manage your billing and invoices anytime via the <a href="https://data.dynep.com/portal" style="color: #10b981;">Customer Billing Portal</a>.
                  </p>
                  <p style="font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 12px; font-family: monospace;">
                    Dynep Global GPU Spot Intelligence Desk • <a href="https://data.dynep.com" style="color: #10b981; text-decoration: none;">data.dynep.com</a>
                  </p>
                </div>
              `;

              ctx.waitUntil(
                sendResendEmail(
                  env,
                  customerEmail,
                  `⚡ Your Dynep ${tier.toUpperCase()} Subscription is Active`,
                  upgradeHtml
                )
              );
            } else {
              const rawKey = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`;
              const keyHash = await sha256(rawKey);
              const keyPrefix = rawKey.substring(0, 15) + '...';
              const id = crypto.randomUUID();
              const customerId = data.customer_id || data.customer?.id || `polar_${Date.now()}`;

              await env.DB.prepare(`
                INSERT INTO subscribers (id, customer_id, email, api_key_hash, api_key_prefix, tier, monthly_quota, current_usage, rate_limit_rpm, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, datetime('now'), datetime('now'))
              `).bind(id, customerId, customerEmail, keyHash, keyPrefix, tier, quota, rpm).run();

              const welcomePaidHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #030712; color: #f8fafc; border-radius: 12px; border: 1px solid #1f2937;">
                  <div style="border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
                    <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; font-family: monospace; border: 1px solid rgba(16, 185, 129, 0.3);">DYNEP DGX-31 • PAID SUBSCRIPTION</span>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 12px 0 0 0;">Welcome to Dynep ${tier.toUpperCase()}</h1>
                  </div>
                  <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    Thank you for subscribing! Your institutional API credentials have been provisioned on our global edge network.
                  </p>
                  <div style="background: #0b0f19; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <div style="font-size: 11px; color: #94a3b8; font-family: monospace; text-transform: uppercase;">Production API Key:</div>
                    <div style="font-family: monospace; font-size: 15px; color: #10b981; font-weight: bold; margin-top: 6px; word-break: break-all;">${rawKey}</div>
                    <div style="margin-top: 10px; font-size: 12px; color: #94a3b8; font-family: monospace;">
                      Plan: <strong style="color: #ffffff;">${tier.toUpperCase()}</strong> • Quota: <strong style="color: #38bdf8;">${quota.toLocaleString()} req/mo</strong> • Rate: <strong style="color: #38bdf8;">${rpm} RPM</strong>
                    </div>
                  </div>
                  <div style="background: #070a13; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #38bdf8; margin: 16px 0;">
                    # Quickstart check in 1 second:<br>
                    curl -s -H "Authorization: Bearer ${rawKey}" "https://data.dynep.com/v1/data?limit=5"<br><br>
                    # Model Context Protocol (MCP) for Claude Desktop / Cursor:<br>
                    npx -y dynep-spot --mcp
                  </div>
                  <p style="font-size: 12px; color: #94a3b8; margin: 16px 0;">
                    Manage your billing and invoices anytime via the <a href="https://data.dynep.com/portal" style="color: #10b981;">Customer Billing Portal</a>.
                  </p>
                  <p style="font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 12px; font-family: monospace;">
                    Dynep Global GPU Spot Intelligence Desk • <a href="https://data.dynep.com" style="color: #10b981; text-decoration: none;">data.dynep.com</a>
                  </p>
                </div>
              `;

              ctx.waitUntil(
                sendResendEmail(
                  env,
                  customerEmail,
                  `🚀 Welcome to Dynep ${tier.toUpperCase()} — Your Production API Credentials`,
                  welcomePaidHtml
                )
              );
            }

            ctx.waitUntil(
              sendNtfy(
                env.NTFY_TOPIC_REVENUE || 'dynep_revenue',
                `💰 Paid Subscription Activated (${tier.toUpperCase()})`,
                `${customerEmail} is now active on ${tier.toUpperCase()} (${quota.toLocaleString()} req/mo)`
              )
            );
          }
        }

        return jsonResponse({ received: true });
      } catch (err: any) {
        return jsonResponse({ error: 'WebhookError', message: err.message }, 500);
      }
    }

    // 14. Admin manual scrape trigger
    if (url.pathname === '/api/admin/scrape' && method === 'POST') {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_API_KEY || token !== env.ADMIN_API_KEY) {
        return jsonResponse({ error: 'Unauthorized', message: 'Admin key required' }, 401);
      }

      const result = await EdgeScraperEngine.runFullCrawl(env.DB);
      return jsonResponse({ success: true, ...result });
    }

    // 15. LLMs.txt & Robots & Sitemap
    if (url.pathname === '/llms.txt') {
      return textResponse(`DYNEP Institutional AI Cloud GPU Spot Intelligence & Arbitrage API
Live endpoint: https://data.dynep.com/v1/spot/summary
MCP server: npx dynep-spot --mcp
Documentation: https://data.dynep.com
Claim key: POST https://data.dynep.com/api/keys/free`);
    }

    if (url.pathname === '/robots.txt') {
      return textResponse(`User-agent: *\nAllow: /\nSitemap: https://data.dynep.com/sitemap.xml`);
    }

    // 16. Fallback to static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },

  // Scheduled Cron Event (Cloudflare Workers Cron Trigger)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running Cloudflare Edge Cron trigger at:', event.cron);
    try {
      const result = await EdgeScraperEngine.runFullCrawl(env.DB);
      console.log(`Edge Scraper completed: ${result.count} records updated in ${result.durationMs}ms`);
      ctx.waitUntil(
        sendNtfy(
          env.NTFY_TOPIC_SYSTEM || 'dynep_system',
          '⚡ Edge Cron Ingestion Complete',
          `Crawl finished: ${result.count} GPU instances updated in ${result.durationMs}ms`
        )
      );
    } catch (err) {
      console.error('Edge Scraper error:', err);
    }
  },
};
