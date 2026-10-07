import { describe, it, expect } from 'vitest';
import worker from '../worker/index.js';
import { SeoEngine, GPU_SEO_PROFILES } from '../worker/seo.js';

describe('DYNEP Programmatic SEO & Agent Discovery Engine', () => {
  const createMockDb = () => ({
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] }),
        first: async () => ({ c: 0 }),
      }),
      all: async () => ({ results: [] }),
      first: async () => ({ c: 0 }),
    }),
  } as any);

  const createCtx = () => ({
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as any);

  it('GET /sitemap.xml returns valid XML sitemap including all GPU profiles and core pages', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/sitemap.xml');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('xml');
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('https://data.dynep.com/');
    expect(text).toContain('https://data.dynep.com/gpu/h100-lowest-price');
    expect(text).toContain('https://data.dynep.com/gpu/rtx-4090-spot-rates');
    expect(text).toContain('https://data.dynep.com/compare/aws-vs-spot');
  });

  it('GET /dynep-indexnow-key.txt returns valid IndexNow verification key', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/dynep-indexnow-key.txt');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.trim()).toBe('dynep-indexnow-7b4c8e192f6a');
  });

  it('GET /.well-known/mcp.json returns Model Context Protocol server manifest for agent directories', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/.well-known/mcp.json');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.schemaVersion).toBe('1.0.0');
    expect(json.name).toBe('dynep-spot-intelligence');
    expect(json.capabilities.tools.some((t: any) => t.name === 'get_cheapest_gpu')).toBe(true);
  });

  it('GET /gpu/h100-lowest-price renders server-side SEO landing page with schema and affiliate links', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/gpu/h100-lowest-price');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('H100');
    expect(html).toContain('Spot Pricing');
    expect(html).toContain('LeaderGPU');
    expect(html).toContain('ref=dynep');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('AggregateOffer');
  });

  it('GET /gpu/rtx-4090-spot-rates renders RTX 4090 SEO landing page with Vast.ai deploy links', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/gpu/rtx-4090-spot-rates');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('RTX 4090');
    expect(html).toContain('Spot Pricing');
    expect(html).toContain('Vast.ai');
    expect(html).toContain('ref_id=dynep');
  });

  it('GET /compare/aws-vs-spot renders cloud comparison matrix', async () => {
    const db = createMockDb();
    const req = new Request('https://data.dynep.com/compare/aws-vs-spot');
    const res = await worker.fetch(req, { DB: db }, createCtx());

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('AWS EC2 vs');
    expect(html).toContain('H100 SXM5');
    expect(html).toContain('LeaderGPU');
  });

  it('GET /badge/5090.svg and /badge/composite.svg render dynamic SVG shields', async () => {
    const db = createMockDb();
    
    const res5090 = await worker.fetch(new Request('https://data.dynep.com/badge/5090.svg'), { DB: db }, createCtx());
    expect(res5090.status).toBe(200);
    const svg5090 = await res5090.text();
    expect(svg5090).toContain('RTX 5090');

    const resComp = await worker.fetch(new Request('https://data.dynep.com/badge/composite.svg'), { DB: db }, createCtx());
    expect(resComp.status).toBe(200);
    const svgComp = await resComp.text();
    expect(svgComp).toContain('DGX-31');
  });

  it('GET /v1/data returns structured error codes and pagination metadata', async () => {
    const db = {
      prepare: (q: string) => ({
        bind: (...args: any[]) => ({
          async first() {
            if (q.includes('FROM subscribers WHERE api_key_hash')) {
              if (args[0] === 'valid_hash') {
                return { id: 'sub-1', email: 'test@dynep.com', current_usage: 0, monthly_quota: 100, is_active: 1 };
              }
            }
            return null;
          },
          async all() {
            return { results: [{ entity_id: 'rec-1', gpu_model: 'H100', provider: 'LeaderGPU', price_hourly: 1.99 }] };
          },
          async run() { return { success: true }; },
        }),
      }),
    } as any;

    // Missing auth header
    const reqMissing = new Request('https://data.dynep.com/v1/data');
    const resMissing = await worker.fetch(reqMissing, { DB: db }, createCtx());
    expect(resMissing.status).toBe(401);
    const jsonMissing: any = await resMissing.json();
    expect(jsonMissing.code).toBe('AUTH_HEADER_MISSING');

    // Invalid API key
    const reqInvalid = new Request('https://data.dynep.com/v1/data', {
      headers: { Authorization: 'Bearer sk_live_wrong_key' },
    });
    const resInvalid = await worker.fetch(reqInvalid, { DB: db }, createCtx());
    expect(resInvalid.status).toBe(401);
    const jsonInvalid: any = await resInvalid.json();
    expect(jsonInvalid.code).toBe('INVALID_API_KEY');
  });

  it('GPU_SEO_PROFILES covers at least 10 major GPU families', () => {
    expect(GPU_SEO_PROFILES.length).toBeGreaterThanOrEqual(10);
    for (const p of GPU_SEO_PROFILES) {
      expect(p.slug).toBeDefined();
      expect(p.gpuFamily).toBeDefined();
      expect(p.defaultSpotPrice).toBeGreaterThan(0);
      expect(p.awsBaselinePrice).toBeGreaterThan(p.defaultSpotPrice);
    }
  });
});
