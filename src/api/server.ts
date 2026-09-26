import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { healthRoutes } from './routes/health.js';
import { dataRoutes } from './routes/data.js';
import { feedRoutes } from './routes/feeds.js';
import { webhookRoutes } from './routes/webhooks.js';
import { sourceRoutes } from './routes/sources.js';
import { logger } from '../db/client.js';

export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Pino is handled via custom db/client logger
  });

  // Enable CORS
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Serve static UI frontend
  const publicPath = path.resolve(process.cwd(), 'public');
  await fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  // Request logger hook
  fastify.addHook('onRequest', async (req) => {
    logger.debug({ method: req.method, url: req.url }, 'Incoming API Request');
  });

  // Global Error Handler
  fastify.setErrorHandler((error: any, request, reply) => {
    logger.error({ url: request.url, err: error.message }, 'API Error Encountered');
    
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
      statusCode,
    });
  });

  // Register all routes
  await fastify.register(healthRoutes);
  await fastify.register(dataRoutes, { prefix: '/v1' });
  await fastify.register(feedRoutes, { prefix: '/v1' });
  await fastify.register(webhookRoutes);
  await fastify.register(sourceRoutes, { prefix: '/v1' });

  return fastify;
}
