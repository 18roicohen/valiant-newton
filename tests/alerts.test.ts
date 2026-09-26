import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { repository } from '../src/db/repository.js';
import { AlertEngine } from '../src/alerts/alertEngine.js';
import { FastifyInstance } from 'fastify';

describe('GPU Spot Drop Alerts Product & Lifecycle', () => {
  let app: FastifyInstance;
  let createdAlertId: string;

  beforeAll(async () => {
    app = await buildServer();
  });

  it('GET /api/alerts/presets returns valid market benchmarks and trigger recommendations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/alerts/presets',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.presets).toBeDefined();
    expect(json.presets.length).toBeGreaterThan(0);
    expect(json.channels).toContain('email');
    expect(json.channels).toContain('discord');
  });

  it('POST /api/alerts/subscribe successfully creates a GPU spot drop alert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/alerts/subscribe',
      payload: {
        email: 'dev-alert-test@startup.ai',
        gpu_model: 'NVIDIA H100 SXM5 (80GB)',
        target_price_usd: 2.20,
        channel: 'email',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.alert).toBeDefined();
    expect(json.alert.email).toBe('dev-alert-test@startup.ai');
    expect(json.alert.gpu_model).toBe('NVIDIA H100 SXM5 (80GB)');
    expect(json.alert.target_price_usd).toBe(2.20);
    createdAlertId = json.alert.id;
  });

  it('POST /api/alerts/subscribe updates target price when same user re-subscribes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/alerts/subscribe',
      payload: {
        email: 'dev-alert-test@startup.ai',
        gpu_model: 'NVIDIA H100 SXM5 (80GB)',
        target_price_usd: 2.10,
        channel: 'discord',
        webhook_url: 'https://discord.com/api/webhooks/mock/test',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.alert.target_price_usd).toBe(2.10);
    expect(json.alert.channel).toBe('discord');
  });

  it('AlertEngine.evaluateAndDispatch evaluates alerts against current market rates', async () => {
    const result = await AlertEngine.evaluateAndDispatch();
    expect(result.evaluated).toBeGreaterThanOrEqual(1);
    expect(typeof result.triggered).toBe('number');
  });

  it('DELETE /api/alerts/:id unsubscribes the alert', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/alerts/${createdAlertId}`,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
  });
});
