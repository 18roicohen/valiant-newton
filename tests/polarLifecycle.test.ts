import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { repository } from '../src/db/repository.js';
import { ApiKeyProvisioner } from '../src/api/billing/keyProvisioner.js';
import { FastifyInstance } from 'fastify';

describe('Polar.sh Subscription Lifecycle Webhooks & Quota Management', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  it('handles subscription.updated and upgrades quota & rate limits', async () => {
    const email = `upgrade-${Date.now()}@domain.com`;
    const customerId = `cust_up_${Date.now()}`;

    // Provision starter subscriber first
    await ApiKeyProvisioner.provisionSubscriber({
      email,
      customerId,
      tier: 'starter',
    });

    const subBefore = await repository.getSubscriberByEmail(email);
    expect(subBefore?.tier).toBe('starter');
    expect(subBefore?.monthly_quota).toBe(1000);

    // Send Polar subscription.updated webhook upgrading to enterprise
    const webhookPayload = {
      event: 'subscription.updated',
      data: {
        customer_id: customerId,
        customer: { email },
        product: { name: 'Enterprise Real-Time DaaS' },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/polar',
      payload: webhookPayload,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.action).toBe('updated');
    expect(json.tier).toBe('enterprise');

    const subAfter = await repository.getSubscriberByEmail(email);
    expect(subAfter?.tier).toBe('enterprise');
    expect(subAfter?.monthly_quota).toBe(100000);
    expect(subAfter?.rate_limit_rpm).toBe(1200);
    expect(subAfter?.is_active).toBe(true);
  });

  it('handles subscription.canceled and immediately revokes API access', async () => {
    const email = `cancel-${Date.now()}@domain.com`;
    const customerId = `cust_cancel_${Date.now()}`;

    const { plaintextApiKey } = await ApiKeyProvisioner.provisionSubscriber({
      email,
      customerId,
      tier: 'pro',
    });

    // Verify key works initially
    const preCheck = await app.inject({
      method: 'GET',
      url: '/v1/data?limit=1',
      headers: { Authorization: `Bearer ${plaintextApiKey}` },
    });
    expect(preCheck.statusCode).toBe(200);

    // Send Polar subscription.canceled webhook
    const cancelPayload = {
      event: 'subscription.canceled',
      data: {
        customer_id: customerId,
        customer: { email },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/polar',
      payload: cancelPayload,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.action).toBe('canceled');

    // Verify key is now rejected with 403 Forbidden
    const postCheck = await app.inject({
      method: 'GET',
      url: '/v1/data?limit=1',
      headers: { Authorization: `Bearer ${plaintextApiKey}` },
    });
    expect(postCheck.statusCode).toBe(403);
    expect(postCheck.json().code).toBe('ACCOUNT_SUSPENDED');
  });

  it('handles order.refunded and disables subscriber', async () => {
    const email = `refund-${Date.now()}@domain.com`;
    const customerId = `cust_refund_${Date.now()}`;

    await ApiKeyProvisioner.provisionSubscriber({
      email,
      customerId,
      tier: 'starter',
    });

    const refundPayload = {
      event: 'order.refunded',
      data: {
        customer_id: customerId,
        customer: { email },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/polar',
      payload: refundPayload,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.action).toBe('refunded');

    const sub = await repository.getSubscriberByEmail(email);
    expect(sub?.is_active).toBe(false);
  });

  it('executes monthly quota reset resetting current_usage to 0', async () => {
    const email = `quota-reset-${Date.now()}@domain.com`;
    const { subscriber } = await ApiKeyProvisioner.provisionSubscriber({
      email,
      tier: 'starter',
    });

    // Simulate usage
    await repository.incrementSubscriberUsage(subscriber.id, 45);
    const subWithUsage = await repository.getSubscriberByEmail(email);
    expect(subWithUsage?.current_usage).toBe(45);

    // Reset quotas
    const resetCount = await repository.resetMonthlyQuotas();
    expect(resetCount).toBeGreaterThan(0);

    const subAfterReset = await repository.getSubscriberByEmail(email);
    expect(subAfterReset?.current_usage).toBe(0);
  });
});
