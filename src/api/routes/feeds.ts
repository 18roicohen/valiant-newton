import { FastifyPluginAsync } from 'fastify';
import { repository } from '../../db/repository.js';
import { stringify } from 'csv-stringify/sync';
import { authenticateApiKey } from '../middleware/auth.js';
import { rateLimitHook } from '../middleware/rateLimiter.js';
import { AffiliateService } from '../../affiliates/affiliateService.js';
import { z } from 'zod';

const FeedQuerySchema = z.object({
  source_id: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

export const feedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticateApiKey);
  fastify.addHook('preHandler', rateLimitHook);

  /**
   * GET /v1/feed.json
   * High-throughput JSON stream/feed for batch ingestion with tracked affiliate deploy links
   */
  fastify.get('/feed.json', async (request, reply) => {
    const query = FeedQuerySchema.parse(request.query);
    let records = await repository.getAllRecordsForFeed(query.source_id, query.since);

    if (query.limit && records.length > query.limit) {
      records = records.slice(0, query.limit);
    }

    const enriched = records.map((r) => AffiliateService.enrichRecord(r));

    return {
      count: enriched.length,
      generated_at: new Date().toISOString(),
      feed: enriched,
    };
  });

  /**
   * GET /v1/feed.csv
   * RFC 4180 compliant CSV export with dynamic column flattening and direct deploy URLs
   */
  fastify.get('/feed.csv', async (request, reply) => {
    const query = FeedQuerySchema.parse(request.query);
    let records = await repository.getAllRecordsForFeed(query.source_id, query.since);

    if (query.limit && records.length > query.limit) {
      records = records.slice(0, query.limit);
    }

    if (records.length === 0) {
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="daas_feed_empty.csv"');
      return 'entity_id,source_id,natural_key,deploy_url,hash,version,first_seen_at,updated_at\n';
    }

    const enriched = records.map((r) => AffiliateService.enrichRecord(r));

    // Collect all unique data keys for uniform CSV columns
    const dynamicKeys = new Set<string>();
    for (const rec of enriched) {
      if (rec.data && typeof rec.data === 'object') {
        for (const k of Object.keys(rec.data)) {
          dynamicKeys.add(k);
        }
      }
    }

    const dynamicKeysList = Array.from(dynamicKeys).sort();

    // Map records to flat rows
    const rows = enriched.map((rec) => {
      const deployUrl = rec.data?.deploy_url || AffiliateService.getDeployUrl(rec.data?.provider, rec.data?.title);
      const row: Record<string, any> = {
        entity_id: rec.entity_id,
        source_id: rec.source_id,
        natural_key: rec.natural_key,
        deploy_url: deployUrl,
        version: rec.version,
        first_seen_at: rec.first_seen_at,
        updated_at: rec.updated_at,
      };

      for (const k of dynamicKeysList) {
        if (k === 'deploy_url') continue; // Already set at top level of row
        const val = rec.data?.[k];
        row[k] = val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
      }

      return row;
    });

    const csvData = stringify(rows, {
      header: true,
      quoted: true,
      quoted_empty: false,
    });

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="daas_feed_${Date.now()}.csv"`);
    return reply.send(csvData);
  });
};
