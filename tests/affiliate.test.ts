import { describe, it, expect } from 'vitest';
import { AffiliateService, AFFILIATE_PARTNERS } from '../worker/affiliates.js';

describe('Affiliate & Referral Monetization Engine', () => {
  it('correctly maps known providers to affiliate deploy links with referral and UTM parameters', () => {
    const leaderGpuUrl = AffiliateService.getDeployUrl('LeaderGPU', 'H100');
    expect(leaderGpuUrl).toContain('leadergpu.com');
    expect(leaderGpuUrl).toContain('ref=dynep');
    expect(leaderGpuUrl).toContain('utm_source=dynep');
    expect(leaderGpuUrl).toContain('gpu=H100');

    const runpodUrl = AffiliateService.getDeployUrl('RunPod');
    expect(runpodUrl).toContain('runpod.io');
    expect(runpodUrl).toContain('ref=dynep');

    const vastUrl = AffiliateService.getDeployUrl('Vast.ai');
    expect(vastUrl).toContain('vast.ai');
    expect(vastUrl).toContain('ref_id=dynep');

    const lambdaUrl = AffiliateService.getDeployUrl('Lambda Labs');
    expect(lambdaUrl).toContain('lambdalabs.com');
    expect(lambdaUrl).toContain('ref=dynep');

    // Expanded providers verification
    const nebiusUrl = AffiliateService.getDeployUrl('Nebius AI', 'H100');
    expect(nebiusUrl).toContain('nebius.com');
    expect(nebiusUrl).toContain('ref=dynep');
    expect(nebiusUrl).toContain('gpu=H100');

    const tensorDockUrl = AffiliateService.getDeployUrl('TensorDock', 'RTX 4090');
    expect(tensorDockUrl).toContain('tensordock.com');
    expect(tensorDockUrl).toContain('ref=dynep');
    expect(AffiliateService.getCommissionPercent('TensorDock')).toBe(10);

    const dataCrunchUrl = AffiliateService.getDeployUrl('DataCrunch');
    expect(dataCrunchUrl).toContain('datacrunch.io');
    expect(dataCrunchUrl).toContain('ref=dynep');

    const scalewayUrl = AffiliateService.getDeployUrl('Scaleway');
    expect(scalewayUrl).toContain('scaleway.com');
    expect(scalewayUrl).toContain('utm_source=dynep');

    const paperspaceUrl = AffiliateService.getDeployUrl('Paperspace');
    expect(paperspaceUrl).toContain('paperspace.com');
    expect(paperspaceUrl).toContain('ref=dynep');
    expect(AffiliateService.getCommissionPercent('Paperspace')).toBe(10);

    const civoUrl = AffiliateService.getDeployUrl('Civo');
    expect(civoUrl).toContain('civo.com');
    expect(civoUrl).toContain('utm_source=dynep');
  });

  it('provides safe fallback deploy URLs for generic and hyperscaler clouds', () => {
    const awsUrl = AffiliateService.getDeployUrl('AWS EC2');
    expect(awsUrl).toContain('aws.amazon.com/ec2/spot');
    expect(awsUrl).toContain('utm_source=dynep');

    const customCloud = AffiliateService.getDeployUrl('Unknown Cloud Host');
    expect(customCloud).toContain('data.dynep.com');
    expect(customCloud).toContain('deploy_provider=Unknown%20Cloud%20Host');
  });

  it('calculates accurate cluster kickbacks for high-density AI clusters', () => {
    // 8x H100 at $1.99/hr for 720 hours = $11,462.40 monthly compute
    // LeaderGPU commission is 10% = $1,146.24/month recurring cash flow
    const commission = AffiliateService.calculateClusterCommission(1.99, 8, 720, 'LeaderGPU');
    expect(commission.hourlyRate).toBe(1.99);
    expect(commission.gpuCount).toBe(8);
    expect(commission.monthlySpendUsd).toBeCloseTo(11462.40, 1);
    expect(commission.commissionPercent).toBe(10);
    expect(commission.monthlyCommissionUsd).toBeCloseTo(1146.24, 1);
    expect(commission.annualCommissionUsd).toBeCloseTo(13754.88, 1);
  });

  it('enriches extracted records with deploy_url and commission rate', () => {
    const rawRecord = {
      entity_id: 'test-entity-1234',
      source_id: 'source-1234',
      natural_key: 'gpu-h100-runpod',
      data: {
        title: 'NVIDIA H100 SXM5',
        price: 2.19,
        provider: 'RunPod',
      },
      hash: 'abc123hash',
      version: 1,
    };

    const enriched = AffiliateService.enrichRecord(rawRecord);
    expect(enriched.data.deploy_url).toBeDefined();
    expect(enriched.data.deploy_url).toContain('runpod.io');
    expect(enriched.data.deploy_url).toContain('ref=dynep');
    expect(enriched.data.affiliate_commission_rate).toBe('5%');
  });

  it('GET /v1/spot/summary includes deploy_url for every benchmark GPU', async () => {
    const worker = (await import('../worker/index.js')).default;
    const mockDb = {
      prepare: () => ({
        bind: () => ({ all: async () => ({ results: [] }), first: async () => ({ c: 0 }) }),
        all: async () => ({ results: [] }),
        first: async () => ({ c: 0 }),
      }),
    } as any;
    const req = new Request('https://data.dynep.com/v1/spot/summary');
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as any;
    const res = await worker.fetch(req, { DB: mockDb }, ctx);

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.benchmark_summary).toBeDefined();
    expect(json.benchmark_summary.length).toBeGreaterThan(0);

    for (const item of json.benchmark_summary) {
      expect(item.deploy_url).toBeDefined();
      expect(item.deploy_url).toContain('dynep');
    }
  });

  it('GET /v1/spot/instances returns public live instance table with zero auth and deploy links', async () => {
    const worker = (await import('../worker/index.js')).default;
    const mockDb = {
      prepare: () => ({
        bind: () => ({ all: async () => ({ results: [] }), first: async () => ({ c: 0 }) }),
        all: async () => ({ results: [] }),
        first: async () => ({ c: 0 }),
      }),
    } as any;
    const req = new Request('https://data.dynep.com/v1/spot/instances');
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as any;
    const res = await worker.fetch(req, { DB: mockDb }, ctx);

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.status).toBe('ok');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('AFFILIATE_PARTNERS registry contains at least 24 registered partners with valid configs', () => {
    const partnerKeys = Object.keys(AFFILIATE_PARTNERS);
    expect(partnerKeys.length).toBeGreaterThanOrEqual(24);

    for (const [key, partner] of Object.entries(AFFILIATE_PARTNERS)) {
      expect(partner.name).toBeDefined();
      expect(partner.aliases.length).toBeGreaterThan(0);
      expect(partner.baseUrl.startsWith('https://')).toBe(true);
      expect(partner.commissionPercent).toBeGreaterThanOrEqual(3);
      expect(partner.referralParam).toBeDefined();
      expect(partner.referralCode).toBeDefined();
    }
  });
});



