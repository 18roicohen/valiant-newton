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

  it('POST /v1/agent/mcp handles initialize, tools/list, and tools/call JSON-RPC 2.0', async () => {
    // 1. initialize
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/agent/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      },
    });
    expect(initRes.statusCode).toBe(200);
    const initJson = JSON.parse(initRes.body);
    expect(initJson.result.serverInfo.name).toBe('dynep-gpu-spot-engine');

    // 2. tools/list
    const listRes = await app.inject({
      method: 'POST',
      url: '/v1/agent/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      },
    });
    expect(listRes.statusCode).toBe(200);
    const listJson = JSON.parse(listRes.body);
    expect(listJson.result.tools.length).toBeGreaterThanOrEqual(2);

    // 3. tools/call get_cheapest_gpu
    const callRes = await app.inject({
      method: 'POST',
      url: '/v1/agent/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_cheapest_gpu',
          arguments: { gpu: 'H100' },
        },
      },
    });
    expect(callRes.statusCode).toBe(200);
    const callJson = JSON.parse(callRes.body);
    expect(callJson.result.content[0].type).toBe('text');
    expect(callJson.result.content[0].text).toContain('LeaderGPU');
  });

  it('GET /v1/metrics/funnel returns conversion and visitor metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/metrics/funnel',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.funnel_overview).toBeDefined();
    expect(json.funnel_overview.total_accounts_registered).toBeGreaterThan(0);
    expect(json.conversion_rates).toBeDefined();
    expect(json.tier_distribution).toBeDefined();
  });
});
