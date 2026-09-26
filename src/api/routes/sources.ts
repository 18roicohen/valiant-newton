import { FastifyPluginAsync } from 'fastify';
import { repository } from '../../db/repository.js';
import { ScrapingEngine } from '../../scraper/engine.js';
import { ApiKeyProvisioner } from '../billing/keyProvisioner.js';
import { SourceSchema, ApiSubscriberSchema } from '../../db/schema.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';

const CreateSourceInputSchema = SourceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  last_run_at: true,
}).extend({
  id: z.string().uuid().optional(),
});

export const sourceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticateAdmin);

  /**
   * GET /v1/admin/sources
   * Lists all configured targets
   */
  fastify.get('/admin/sources', async () => {
    const sources = await repository.getActiveSources();
    return { count: sources.length, sources };
  });

  /**
   * POST /v1/admin/sources
   * Creates or updates a source target
   */
  fastify.post('/admin/sources', async (request, reply) => {
    const parsed = CreateSourceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        details: parsed.error.format(),
      });
    }

    const created = await repository.createSource(parsed.data);
    return reply.status(201).send({ source: created });
  });

  /**
   * POST /v1/admin/sources/:id/scrape
   * Triggers an immediate scrape execution for a specific source
   */
  fastify.post('/admin/sources/:id/scrape', async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await repository.getSourceById(id);

    if (!source) {
      return reply.status(404).send({ error: 'Not Found', message: `Source ${id} not found` });
    }

    const body = (request.body as { html_override?: string }) || {};
    const result = await ScrapingEngine.scrapeSource(source, body.html_override);

    return { result };
  });

  /**
   * GET /v1/admin/logs
   * Fetches extraction audit logs
   */
  fastify.get('/admin/logs', async (request) => {
    const query = (request.query as { limit?: string; source_id?: string }) || {};
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const logs = await repository.getRecentLogs(limit, query.source_id);
    return { count: logs.length, logs };
  });

  /**
   * POST /v1/admin/subscribers
   * Manually issue an API key to a subscriber
   */
  fastify.post('/admin/subscribers', async (request, reply) => {
    const body = request.body as { email: string; tier?: any; customerId?: string; monthlyQuota?: number };
    if (!body.email) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email is required' });
    }

    const provisionResult = await ApiKeyProvisioner.provisionSubscriber({
      email: body.email,
      customerId: body.customerId,
      tier: body.tier,
      monthlyQuota: body.monthlyQuota,
    });

    return reply.status(201).send({
      subscriber: provisionResult.subscriber,
      api_key: provisionResult.plaintextApiKey,
    });
  });
};
