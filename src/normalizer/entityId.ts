import crypto from 'crypto';

/**
 * Generates a deterministic SHA-256 entity_id from the source ID and the natural key.
 * Enforces idempotency across multiple scraping runs.
 */
export function generateEntityId(sourceId: string, naturalKey: string): string {
  if (!sourceId || !naturalKey) {
    throw new Error('sourceId and naturalKey are required to generate deterministic entity_id');
  }
  const rawKey = `${sourceId.trim()}::${String(naturalKey).trim()}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}
