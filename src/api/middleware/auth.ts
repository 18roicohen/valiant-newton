import { FastifyRequest, FastifyReply } from 'fastify';
import { repository } from '../../db/repository.js';
import { ApiKeyProvisioner } from '../billing/keyProvisioner.js';
import { ApiSubscriber } from '../../db/schema.js';
import { env } from '../../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    subscriber?: ApiSubscriber;
    isAdmin?: boolean;
  }
}

/**
 * Public Data API Authentication Middleware
 * Enforces API Key validation, account active state, and monthly quota limits.
 */
export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <API_KEY>',
      code: 'AUTH_HEADER_MISSING',
    });
  }

  const rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!rawKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Empty API key provided',
      code: 'AUTH_KEY_EMPTY',
    });
  }

  // Check if it's the master admin key
  if (rawKey === env.ADMIN_API_KEY) {
    request.isAdmin = true;
    reply.header('X-Quota-Limit', 'unlimited');
    reply.header('X-Quota-Remaining', 'unlimited');
    return;
  }

  // Hash key to look up subscriber
  const keyHash = ApiKeyProvisioner.hashApiKey(rawKey);
  const subscriber = await repository.getSubscriberByApiKeyHash(keyHash);

  if (!subscriber) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key provided',
      code: 'INVALID_API_KEY',
    });
  }

  if (!subscriber.is_active) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Subscriber account is inactive or suspended',
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  // Check Quota Limit
  if (subscriber.current_usage >= subscriber.monthly_quota) {
    reply.header('X-Quota-Limit', subscriber.monthly_quota);
    reply.header('X-Quota-Remaining', 0);
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: `Monthly quota of ${subscriber.monthly_quota} requests exceeded. Upgrade to continue receiving live spot rates.`,
      code: 'QUOTA_EXCEEDED',
      current_usage: subscriber.current_usage,
      monthly_quota: subscriber.monthly_quota,
      tier: subscriber.tier,
      upgrade_url: 'https://data.dynep.com/#pricing',
      checkout_url: 'https://data.dynep.com/#pricing',
      coupon_code: 'DYNEP37',
      discount: '37% OFF first 3 months',
    });
  }

  // Atomically increment subscriber usage
  await repository.incrementSubscriberUsage(subscriber.id, 1);
  subscriber.current_usage += 1;

  const remainingQuota = Math.max(0, subscriber.monthly_quota - subscriber.current_usage);

  reply.header('X-Quota-Limit', subscriber.monthly_quota);
  reply.header('X-Quota-Remaining', remainingQuota);
  reply.header('X-Subscriber-Tier', subscriber.tier);

  request.subscriber = subscriber;
}

/**
 * Admin API Key Middleware
 */
export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

  if (rawKey !== env.ADMIN_API_KEY) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Admin authorization required',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }

  request.isAdmin = true;
}
