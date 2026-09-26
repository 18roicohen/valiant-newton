import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { FastifyInstance } from 'fastify';

describe('OpenAPI 3.1 & Documentation Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  it('serves valid OpenAPI 3.1 schema at GET /openapi.json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/openapi.json',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');

    const json = res.json();
    expect(json.openapi).toBe('3.1.0');
    expect(json.info.title).toContain('Dynep');
    expect(json.paths['/health']).toBeDefined();
    expect(json.paths['/v1/data']).toBeDefined();
    expect(json.paths['/v1/feed.json']).toBeDefined();
    expect(json.paths['/v1/feed.csv']).toBeDefined();
    expect(json.paths['/v1/metrics']).toBeDefined();
    expect(json.components.securitySchemes.BearerAuth).toBeDefined();
  });

  it('serves interactive Scalar documentation UI at GET /docs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('@scalar/api-reference');
    expect(res.body).toContain('/openapi.json');
  });
});
