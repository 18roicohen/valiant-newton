import { describe, it, expect } from 'vitest';
import { AffiliateService, AFFILIATE_PARTNERS } from '../src/affiliates/affiliateService.js';

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
    const { buildServer } = await import('../src/api/server.js');
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/spot/summary',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.benchmark_summary).toBeDefined();
    expect(json.benchmark_summary.length).toBeGreaterThan(0);

    for (const item of json.benchmark_summary) {
      expect(item.deploy_url).toBeDefined();
      expect(item.deploy_url).toContain('dynep');
    }
  });

  it('GET /v1/spot/instances returns public live instance table with zero auth and deploy links', async () => {
    const { buildServer } = await import('../src/api/server.js');
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/spot/instances',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('ok');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].data.deploy_url).toBeDefined();
  });
});


