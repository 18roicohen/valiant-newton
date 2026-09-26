import crypto from 'crypto';
import { repository } from '../../db/repository.js';
import { ApiSubscriber, SubscriberTier } from '../../db/schema.js';
import { logger } from '../../db/client.js';
import { EmailService } from '../../alerts/emailService.js';

export interface ProvisionResult {
  subscriber: ApiSubscriber;
  plaintextApiKey: string; // ONLY returned once upon generation
}

export class ApiKeyProvisioner {
  /**
   * Hashes an API key with SHA-256 for secure storage and constant-time indexing
   */
  static hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey.trim()).digest('hex');
  }

  /**
   * Generates a cryptographically random API key with standard prefix
   * Example: sk_live_7f8a9b...
   */
  static generateRawKey(): string {
    const randomHex = crypto.randomBytes(24).toString('hex');
    return `sk_live_${randomHex}`;
  }

  /**
   * Provisions a new subscriber account and issues an API key
   */
  static async provisionSubscriber(params: {
    email: string;
    customerId?: string;
    tier?: SubscriberTier;
    monthlyQuota?: number;
    rateLimitRpm?: number;
  }): Promise<ProvisionResult> {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 15) + '...';

    const tier = params.tier || 'starter';
    const quotaMap: Record<SubscriberTier, { quota: number; rpm: number }> = {
      free: { quota: 100, rpm: 15 },
      starter: { quota: 1000, rpm: 60 },
      pro: { quota: 10000, rpm: 300 },
      enterprise: { quota: 100000, rpm: 1200 },
    };

    const config = quotaMap[tier] || quotaMap.starter;

    const subscriber: ApiSubscriber = {
      id: crypto.randomUUID(),
      customer_id: params.customerId || null,
      email: params.email.toLowerCase().trim(),
      api_key_hash: keyHash,
      api_key_prefix: keyPrefix,
      tier,
      monthly_quota: params.monthlyQuota || config.quota,
      current_usage: 0,
      rate_limit_rpm: params.rateLimitRpm || config.rpm,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const savedSubscriber = await repository.createSubscriber(subscriber);
    logger.info({ subscriberId: savedSubscriber.id, email: savedSubscriber.email, tier }, 'Provisioned API Subscriber');

    // Trigger transactional welcome email asynchronously
    EmailService.sendWelcomeApiKeyEmail({
      to: savedSubscriber.email,
      apiKey: rawKey,
      tier: savedSubscriber.tier,
      monthlyQuota: savedSubscriber.monthly_quota,
    }).catch((err) => {
      logger.error({ error: err.message, to: savedSubscriber.email }, 'Failed to dispatch welcome API key email');
    });

    return {
      subscriber: savedSubscriber,
      plaintextApiKey: rawKey,
    };
  }
}
