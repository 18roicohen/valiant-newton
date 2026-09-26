import { FastifyRequest, FastifyReply } from 'fastify';

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const buckets: Map<string, RateBucket> = new Map();

/**
 * Token Bucket Rate Limiter per Subscriber Key
 */
export async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
  if (request.isAdmin) return;

  const subscriber = request.subscriber;
  if (!subscriber) return;

  const key = subscriber.id;
  const maxRpm = subscriber.rate_limit_rpm || 60;
  const refillRatePerMs = maxRpm / 60000;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxRpm, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsedMs = now - bucket.lastRefill;
  bucket.tokens = Math.min(maxRpm, bucket.tokens + elapsedMs * refillRatePerMs);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    const resetTimeSec = Math.ceil((1 - bucket.tokens) / (refillRatePerMs * 1000));
    reply.header('Retry-After', resetTimeSec);
    reply.header('X-RateLimit-Limit', maxRpm);
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', resetTimeSec);

    return reply.status(429).send({
      error: 'Too Many Requests',
      message: `Rate limit of ${maxRpm} requests per minute exceeded.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retry_after_seconds: resetTimeSec,
    });
  }

  bucket.tokens -= 1;

  reply.header('X-RateLimit-Limit', maxRpm);
  reply.header('X-RateLimit-Remaining', Math.floor(bucket.tokens));
}
