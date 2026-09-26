import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { repository } from '../src/db/repository.js';
import { ApiKeyProvisioner } from '../src/api/billing/keyProvisioner.js';
import { FastifyInstance } from 'fastify';

describe('Public API Gateway & Metering Endpoints', () => {
  let app: FastifyInstance;
  let testApiKey: string;
  let limitedApiKey: string;
  let testEntityId: string;

  beforeAll(async () => {
    app = await buildServer();

    // Provision test subscriber with ample quota
    const provisionResult = await ApiKeyProvisioner.provisionSubscriber({
      email: 'api-tester@domain.com',
      tier: 'pro',
      monthlyQuota: 5000,
    });
    testApiKey = provisionResult.plaintextApiKey;

    // Provision test subscriber with 1 request quota
    const limitedResult = await ApiKeyProvisioner.provisionSubscriber({
      email: 'limited-tester@domain.com',
      tier: 'free',
      monthlyQuota: 1,
    });
    limitedApiKey = limitedResult.plaintextApiKey;

    // Insert sample record
    const source = await repository.createSource({
      name: 'API Test Source',
      url: 'https://example.com',
      selector_map: { container: '.item', fields: { title: 'h1' } },
    });

    const now = new Date().toISOString();
    testEntityId = 'e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';
    await repository.upsertRecords([
      {
        entity_id: testEntityId,
        source_id: source.id,
        natural_key: 'item-test-01',
        data: {
          title: 'Enterprise High-Yield Dataset',
          price: 999.0,
          category: 'Finance',
          status: 'ACTIVE',
        },
        hash: 'hash1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        version: 1,
      },
    ]);
  });

  it('GET /health returns liveness status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.version).toBe('1.0.0');
  });

  it('GET /v1/data returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/data' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('AUTH_HEADER_MISSING');
  });

  it('GET /v1/data returns 200 and paginated data when authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/data?page=1&limit=10',
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data).toBeDefined();
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.total_records).toBeGreaterThanOrEqual(1);
    expect(res.headers['x-quota-limit']).toBeDefined();
    expect(res.headers['x-quota-remaining']).toBeDefined();
  });

  it('GET /v1/data/:id returns single record', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/data/${testEntityId}`,
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.entity_id).toBe(testEntityId);
    expect(json.data.data.title).toBe('Enterprise High-Yield Dataset');
  });

  it('GET /v1/feed.json returns batch JSON feed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed.json',
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.feed).toBeDefined();
    expect(json.count).toBeGreaterThanOrEqual(1);
  });

  it('GET /v1/feed.csv returns RFC-4180 CSV export', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed.csv',
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('entity_id');
    expect(res.body).toContain('Enterprise High-Yield Dataset');
  });

  it('enforces monthly quota and returns 429 when quota is exhausted', async () => {
    // 1st request consumes the single quota credit
    const res1 = await app.inject({
      method: 'GET',
      url: '/v1/data',
      headers: { Authorization: `Bearer ${limitedApiKey}` },
    });
    expect(res1.statusCode).toBe(200);

    // 2nd request should exceed quota
    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/data',
      headers: { Authorization: `Bearer ${limitedApiKey}` },
    });
    expect(res2.statusCode).toBe(429);
    expect(res2.json().code).toBe('QUOTA_EXCEEDED');
  });
});
