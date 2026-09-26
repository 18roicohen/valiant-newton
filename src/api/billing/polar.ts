import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../db/client.js';
import { ApiKeyProvisioner, ProvisionResult } from './keyProvisioner.js';
import { SubscriberTier } from '../../db/schema.js';

export interface PolarCheckoutOptions {
  email: string;
  tier: SubscriberTier;
  successUrl?: string;
  cancelUrl?: string;
}

export class PolarService {
  /**
   * Product / Tier Price mappings for Polar.sh
   */
  static readonly TIER_PRODUCTS: Record<SubscriberTier, { name: string; priceUsd: number; quota: number; rpm: number }> = {
    free: { name: 'Free Trial Feed', priceUsd: 0, quota: 100, rpm: 15 },
    starter: { name: 'Starter Micro-DaaS Access', priceUsd: 29, quota: 1000, rpm: 60 },
    pro: { name: 'Pro Micro-DaaS API + CSV', priceUsd: 99, quota: 10000, rpm: 300 },
    enterprise: { name: 'Enterprise Real-Time DaaS', priceUsd: 299, quota: 100000, rpm: 1200 },
  };

  /**
   * Creates a Polar checkout session or instant development checkout URL
   */
  static createCheckoutSession(options: PolarCheckoutOptions): { checkoutUrl: string; product: string; price: number } {
    const productInfo = this.TIER_PRODUCTS[options.tier] || this.TIER_PRODUCTS.starter;
    const checkoutUrl = `/api/checkout/simulate?tier=${options.tier}&email=${encodeURIComponent(options.email)}`;

    return {
      checkoutUrl,
      product: productInfo.name,
      price: productInfo.priceUsd,
    };
  }

  /**
   * Processes a Polar or Stripe webhook payload and provisions the subscriber account
   */
  static async handleWebhook(payload: Record<string, any>, signatureHeader?: string): Promise<ProvisionResult | null> {
    const event = payload.type || payload.event;
    logger.info({ eventType: event }, 'Processing billing webhook event');

    // If signature verification is enabled
    if (env.POLAR_WEBHOOK_SECRET && signatureHeader) {
      const isValid = this.verifyWebhookSignature(JSON.stringify(payload), signatureHeader, env.POLAR_WEBHOOK_SECRET);
      if (!isValid) {
        throw new Error('Invalid Polar webhook cryptographic signature');
      }
    }

    let email = '';
    let customerId = '';
    let tier: SubscriberTier = 'starter';

    // 1. Stripe Checkout / Subscription events
    if (event === 'checkout.session.completed') {
      const session = payload.data?.object || {};
      email = session.customer_details?.email || session.customer_email || '';
      customerId = session.customer || session.id || '';
      const metaTier = session.metadata?.tier?.toLowerCase();
      if (metaTier && ['free', 'starter', 'pro', 'enterprise'].includes(metaTier)) {
        tier = metaTier as SubscriberTier;
      }
    } else if (event === 'customer.subscription.created') {
      const sub = payload.data?.object || {};
      email = sub.customer_email || '';
      customerId = sub.customer || '';
      const metaTier = sub.metadata?.tier?.toLowerCase();
      if (metaTier && ['free', 'starter', 'pro', 'enterprise'].includes(metaTier)) {
        tier = metaTier as SubscriberTier;
      }
    }
    // 2. Polar.sh events
    else if (event === 'order.created' || event === 'subscription.created' || event === 'checkout.created') {
      const data = payload.data || payload;
      email = data.customer?.email || data.user?.email || data.email || '';
      customerId = data.customer_id || data.user_id || data.id || `polar_${Date.now()}`;

      const productName = String(data.product?.name || data.tier || '').toLowerCase();
      if (productName.includes('enterprise')) tier = 'enterprise';
      else if (productName.includes('pro')) tier = 'pro';
      else if (productName.includes('free')) tier = 'free';
      else tier = 'starter';
    }
    // 3. Direct / simulated payload
    else if (payload.email) {
      email = payload.email;
      customerId = payload.customerId || `cust_${Date.now()}`;
      if (payload.tier && ['free', 'starter', 'pro', 'enterprise'].includes(payload.tier)) {
        tier = payload.tier;
      }
    }

    if (!email) {
      logger.warn('No customer email identified in billing payload');
      return null;
    }

    return await ApiKeyProvisioner.provisionSubscriber({
      email,
      customerId,
      tier,
    });
  }

  /**
   * Verifies standard HMAC-SHA256 signature for Polar webhooks
   */
  private static verifyWebhookSignature(payloadString: string, signatureHeader: string, secret: string): boolean {
    try {
      const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }
}
