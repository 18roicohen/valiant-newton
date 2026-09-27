import { FastifyPluginAsync } from 'fastify';
import { repository } from '../../db/repository.js';
import { DataQueryFilterSchema } from '../../db/schema.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { rateLimitHook } from '../middleware/rateLimiter.js';
import { AffiliateService } from '../../affiliates/affiliateService.js';

export const dataRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth and rate limiting to all data endpoints
  fastify.addHook('preHandler', authenticateApiKey);
  fastify.addHook('preHandler', rateLimitHook);

  /**
   * GET /v1/data
   * Filterable, paginated high-value structured data feed with tracked affiliate deployment links
   */
  fastify.get('/data', async (request, reply) => {
    const parseResult = DataQueryFilterSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.format(),
      });
    }

    const filter = parseResult.data;
    const { data, total } = await repository.getRecords(filter);
    const totalPages = Math.ceil(total / filter.limit);
    const enrichedData = data.map((record) => AffiliateService.enrichRecord(record));

    return {
      data: enrichedData,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total_records: total,
        total_pages: totalPages,
        has_more: filter.page < totalPages,
      },
    };
  });

  /**
   * GET /v1/data/:id
   * Single entity detail lookup by SHA-256 entity_id with affiliate deployment link
   */
  fastify.get('/data/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || id.trim().length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Entity ID is required' });
    }

    const record = await repository.getRecordById(id.trim());
    if (!record) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Record with entity_id '${id}' was not found.`,
      });
    }

    return { data: AffiliateService.enrichRecord(record) };
  });
};
