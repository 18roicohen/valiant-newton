import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { repository } from '../src/db/repository.js';
import { FastifyInstance } from 'fastify';

describe('Billing Webhook Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  it('processes Stripe checkout.session.completed and issues an active API key', async () => {
    const email = `stripe-customer-${Date.now()}@domain.com`;
    const stripePayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_a1b2c3d4e5',
          customer: 'cus_99887766',
          customer_details: { email },
          metadata: { tier: 'pro' },
        },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/billing',
      payload: stripePayload,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.provisioned).toBe(true);
    expect(json.tier).toBe('pro');
    expect(json.api_key).toMatch(/^sk_live_/);

    const subscriber = await repository.getSubscriberByEmail(email);
    expect(subscriber).toBeDefined();
    expect(subscriber?.tier).toBe('pro');
    expect(subscriber?.monthly_quota).toBe(10000);
  });

  it('processes Polar.sh order.created and provisions enterprise subscriber', async () => {
    const email = `polar-customer-${Date.now()}@domain.com`;
    const polarPayload = {
      event: 'order.created',
      data: {
        id: 'ord_polar_123',
        customer_id: 'usr_polar_999',
        customer: { email },
        product: { name: 'Enterprise Micro-DaaS Access' },
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/billing',
      payload: polarPayload,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.provisioned).toBe(true);
    expect(json.tier).toBe('enterprise');
    expect(json.api_key).toMatch(/^sk_live_/);

    const subscriber = await repository.getSubscriberByEmail(email);
    expect(subscriber).toBeDefined();
    expect(subscriber?.tier).toBe('enterprise');
    expect(subscriber?.monthly_quota).toBe(100000);
  });
});
