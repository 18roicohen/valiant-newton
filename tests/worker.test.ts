import { describe, it, expect } from 'vitest';
import worker from '../worker/index.js';

describe('DYNEP Edge Worker API Integration', () => {
  const createMockDb = () => {
    const memory = {
      subscribers: [] as any[],
      records: [
        {
          entity_id: 'rec-1',
          source_id: 'src-1',
          natural_key: 'h100-leadergpu',
          gpu_model: 'NVIDIA H100 SXM5 (80GB)',
          provider: 'LeaderGPU',
          price_hourly: 1.99,
          vram_gb: 80,
          region: 'US-East-1',
          deploy_url: 'https://www.leadergpu.com/?ref=dynep',
          data: JSON.stringify({
            title: 'NVIDIA H100 SXM5 (80GB)',
            price: 1.99,
            provider: 'LeaderGPU',
          }),
          updated_at: '2026-10-02T12:00:00Z',
        },
      ],
      alerts: [] as any[],
    };

    return {
      prepare(query: string) {
        return {
          bind(...args: any[]) {
            return {
              async first() {
                if (query.includes('COUNT(*) as c FROM records')) return { c: memory.records.length };
                if (query.includes('COUNT(*) as c FROM subscribers')) return { c: memory.subscribers.length };
                if (query.includes('COUNT(*) as c FROM sources')) return { c: 2 };
                if (query.includes('COUNT(*) as c FROM alerts')) return { c: 1 };
                if (query.includes('FROM subscribers WHERE email = ?')) {
                  return memory.subscribers.find((s) => s.email === args[0]) || null;
                }
                if (query.includes('FROM subscribers WHERE api_key_hash = ?')) {
                  return memory.subscribers.find((s) => s.api_key_hash === args[0]) || null;
                }
                return null;
              },
              async all() {
                if (query.includes('FROM records')) {
                  return { results: memory.records };
                }
                return { results: [] };
              },
              async run() {
                if (query.includes('INSERT INTO subscribers')) {
                  const isPolar = query.includes('datetime');
                  memory.subscribers.push({
                    id: args[0],
                    customer_id: isPolar ? args[1] : null,
                    email: isPolar ? args[2] : args[1],
                    api_key_hash: isPolar ? args[3] : args[2],
                    api_key_prefix: isPolar ? args[4] : args[3],
                    tier: isPolar ? args[5] : (args[4] || 'free'),
                    monthly_quota: isPolar ? args[6] : (args[5] || 100),
                    current_usage: 0,
                    rate_limit_rpm: isPolar ? args[7] : (args[6] || 15),
                    is_active: 1,
                  });
                }
                if (query.includes('UPDATE subscribers') && query.includes('tier = ?')) {
                  const sub = memory.subscribers.find((s) => s.email === args[3]);
                  if (sub) {
                    sub.tier = args[0];
                    sub.monthly_quota = args[1];
                    sub.rate_limit_rpm = args[2];
                  }
                }
                if (query.includes('UPDATE subscribers') && query.includes('api_key_hash = ?')) {
                  const sub = memory.subscribers.find((s) => s.email === args[4]);
                  if (sub) {
                    sub.api_key_hash = args[0];
                    sub.api_key_prefix = args[1];
                    sub.monthly_quota = args[2];
                    sub.rate_limit_rpm = args[3];
                  }
                }
                return { success: true, meta: {} };
              },
            };
          },
          async first() {
            return { c: 1 };
          },
          async all() {
            return { results: memory.records };
          },
          async run() {
            return { success: true, meta: {} };
          },
        };
      },
    } as any;
  };

  const createCtx = () => ({
    waitUntil: () => {},
    passThroughOnException: () => {},
  }) as any;

  it('GET /health returns 200 with active edge state', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/health');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.status).toBe('ok');
    expect(json.database).toBe('cloudflare_d1_active');
  });

  it('GET /v1/metrics and /v1/metrics/funnel return healthy telemetry', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/v1/metrics/funnel');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.metrics.status).toBe('EDGE_HEALTHY');
    expect(json.metrics.total_records).toBeGreaterThanOrEqual(1);
  });

  it('GET /v1/spot/summary returns benchmark items with affiliate tracking', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/v1/spot/summary');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.benchmark_summary).toBeDefined();
    expect(json.benchmark_summary.length).toBeGreaterThan(0);
    expect(json.meta.mcp_server).toBe('npx -y dynep-spot --mcp');
  });

  it('GET /badge/h100.svg returns valid SVG shield', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/badge/h100.svg');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    const svg = await res.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('H100 SPOT');
  });

  it('POST /api/keys/free rejects disposable emails', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/api/keys/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'spammer@tempmail.com' }),
    });
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.error).toBe('DisposableEmailRejected');
  });

  it('POST /api/keys/free issues a valid API key for legitimate developers', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/api/keys/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'developer@tensor-corp.ai' }),
    });
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(201);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.api_key).toMatch(/^sk_live_[a-f0-9]{32}$/);
    expect(json.monthly_quota).toBe(100);
  });

  it('POST /v1/agent/mcp handles Model Context Protocol JSON-RPC initialize and tools/list', async () => {
    const db = createMockDb();
    
    // Test initialize
    const initReq = new Request('https://data.dynep.com/v1/agent/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    const initRes = await worker.fetch(initReq, { DB: db }, createCtx());
    expect(initRes.status).toBe(200);
    const initJson: any = await initRes.json();
    expect(initJson.result.serverInfo.name).toBe('dynep-spot-intelligence');

    // Test tools/list
    const toolsReq = new Request('https://data.dynep.com/v1/agent/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    const toolsRes = await worker.fetch(toolsReq, { DB: db }, createCtx());
    expect(toolsRes.status).toBe(200);
    const toolsJson: any = await toolsRes.json();
    expect(toolsJson.result.tools.some((t: any) => t.name === 'get_cheapest_gpu')).toBe(true);

    // Test tools/call
    const callReq = new Request('https://data.dynep.com/v1/agent/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_cheapest_gpu', arguments: { gpu_model: 'H100' } },
      }),
    });
    const callRes = await worker.fetch(callReq, { DB: db }, createCtx());
    expect(callRes.status).toBe(200);
    const callJson: any = await callRes.json();
    expect(callJson.result.content[0].text).toContain('LeaderGPU');
  });

  it('POST /api/webhooks/polar automatically upgrades paid subscribers', async () => {
    const db = createMockDb();
    
    // First provision a free user
    const freeReq = new Request('https://data.dynep.com/api/keys/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'subscriber@quantfund.com' }),
    });
    await worker.fetch(freeReq, { DB: db }, createCtx());

    // Send polar webhook
    const polarReq = new Request('https://data.dynep.com/api/webhooks/polar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subscription.created',
        data: {
          customer: { email: 'subscriber@quantfund.com' },
          product_id: '0c3b8529-67d6-4e7b-b4dc-bc28041cd0ab', // Pro Product ID
        },
      }),
    });
    const res = await worker.fetch(polarReq, { DB: db, POLAR_PRODUCT_PRO: '0c3b8529-67d6-4e7b-b4dc-bc28041cd0ab' }, createCtx());
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.received).toBe(true);

    // Verify DB state was upgraded
    const sub = await db.prepare('SELECT * FROM subscribers WHERE email = ?').bind('subscriber@quantfund.com').first();
    expect(sub.tier).toBe('pro');
    expect(sub.monthly_quota).toBe(50000);
    expect(sub.rate_limit_rpm).toBe(300);
  });

  it('POST /api/webhooks/polar provisions brand new paying customer who never had a free key', async () => {
    const db = createMockDb();

    const polarReq = new Request('https://data.dynep.com/api/webhooks/polar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subscription.created',
        data: {
          customer: { email: 'direct_buyer@enterprise-ai.com' },
          product_id: '0c3b8529-67d6-4e7b-b4dc-bc28041cd0ab', // Pro Product ID
        },
      }),
    });
    const res = await worker.fetch(polarReq, { DB: db, POLAR_PRODUCT_PRO: '0c3b8529-67d6-4e7b-b4dc-bc28041cd0ab' }, createCtx());
    expect(res.status).toBe(200);

    const sub = await db.prepare('SELECT * FROM subscribers WHERE email = ?').bind('direct_buyer@enterprise-ai.com').first();
    expect(sub).toBeDefined();
    expect(sub.tier).toBe('pro');
    expect(sub.monthly_quota).toBe(50000);
    expect(sub.api_key_prefix).toMatch(/^sk_live_/);
    expect(sub.is_active).toBe(1);
  });

  it('POST /api/keys/free with reissue: true refreshes and re-issues an active key for existing users', async () => {
    const db = createMockDb();

    // 1. First claim
    const req1 = new Request('https://data.dynep.com/api/keys/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'developer@reissue-test.ai' }),
    });
    const res1 = await worker.fetch(req1, { DB: db }, createCtx());
    const json1: any = await res1.json();
    expect(json1.api_key).toBeDefined();

    // 2. Re-issue
    const req2 = new Request('https://data.dynep.com/api/keys/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'developer@reissue-test.ai', reissue: true, vip: true }),
    });
    const res2 = await worker.fetch(req2, { DB: db }, createCtx());
    expect(res2.status).toBe(200);
    const json2: any = await res2.json();
    expect(json2.api_key).toBeDefined();
    expect(json2.monthly_quota).toBe(1000);
  });
});
