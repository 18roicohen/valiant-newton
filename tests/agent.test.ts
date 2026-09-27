import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { FastifyInstance } from 'fastify';

describe('Autonomous AI Agent Discovery & Monetization Gateway', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  it('GET /v1/agent/arbitrage returns machine-readable decision matrix with positive ROI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/arbitrage?gpu=H100&count=8&hours=720',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.agent_decision_matrix).toBeDefined();
    expect(json.agent_decision_matrix.status).toBe('IMMEDIATE_ACTION_RECOMMENDED');
    expect(json.agent_decision_matrix.economics.net_monthly_capital_saved_usd).toBeGreaterThan(10000);
    expect(json.agent_decision_matrix.economics.dynep_api_monthly_subscription_usd).toBe(29);
    expect(json.agent_decision_matrix.actionable_next_steps.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /v1/agent/mcp returns Model Context Protocol tools manifest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/mcp',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.schema_version).toBe('2024-11-05');
    expect(json.tools).toBeDefined();
    expect(json.tools.length).toBeGreaterThanOrEqual(2);
    const toolNames = json.tools.map((t: any) => t.name);
    expect(toolNames).toContain('get_cheapest_gpu');
    expect(toolNames).toContain('evaluate_cluster_arbitrage');
  });

  it('GET /llms.txt returns standard LLM markdown documentation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('Dynep Micro-DaaS: Autonomous Cloud GPU Spot Intelligence');
    expect(res.body).toContain('Agent Decision Rule');
    expect(res.body).toContain('pip install dynep');
    expect(res.body).toContain('DYNEP37');
  });
});
