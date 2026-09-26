import { FastifyPluginAsync } from 'fastify';
import { repository } from '../../db/repository.js';
import { getSupabaseClient } from '../../db/client.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const processStart = Date.now();

  /**
   * GET /health
   * Public liveness and dependency status probe
   */
  fastify.get('/health', async () => {
    const supabaseClient = getSupabaseClient();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - processStart) / 1000),
      database: supabaseClient ? 'supabase_connected' : 'in_memory_active',
      version: '1.0.0',
    };
  });

  /**
   * GET /v1/metrics
   * Aggregated system statistics & crawler metrics
   */
  fastify.get('/v1/metrics', async () => {
    const summary = await repository.getMetricsSummary();
    return {
      timestamp: new Date().toISOString(),
      metrics: summary,
    };
  });
};
