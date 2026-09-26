import { describe, it, expect } from 'vitest';
import { ApiKeyProvisioner } from '../src/api/billing/keyProvisioner.js';

describe('ApiKeyProvisioner', () => {
  it('generates secure keys with sk_live_ prefix and SHA-256 hash', async () => {
    const res = await ApiKeyProvisioner.provisionSubscriber({
      email: 'tester@example.com',
      tier: 'starter',
    });

    expect(res.plaintextApiKey).toMatch(/^sk_live_[a-f0-9]{48}$/);
    expect(res.subscriber.api_key_hash).toHaveLength(64);
    expect(res.subscriber.monthly_quota).toBe(1000);
    expect(res.subscriber.rate_limit_rpm).toBe(60);
    expect(res.subscriber.is_active).toBe(true);
  });

  it('assigns proper quotas and RPM limits according to subscriber tiers', async () => {
    const pro = await ApiKeyProvisioner.provisionSubscriber({
      email: 'pro@example.com',
      tier: 'pro',
    });
    expect(pro.subscriber.monthly_quota).toBe(10000);
    expect(pro.subscriber.rate_limit_rpm).toBe(300);

    const enterprise = await ApiKeyProvisioner.provisionSubscriber({
      email: 'enterprise@example.com',
      tier: 'enterprise',
    });
    expect(enterprise.subscriber.monthly_quota).toBe(100000);
    expect(enterprise.subscriber.rate_limit_rpm).toBe(1200);
  });
});
