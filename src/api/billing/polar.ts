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
  discountCode?: string;
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
  static async createCheckoutSession(options: PolarCheckoutOptions): Promise<{ checkoutUrl: string; product: string; price: number }> {
    const productInfo = this.TIER_PRODUCTS[options.tier] || this.TIER_PRODUCTS.starter;

    const productIdMap: Record<SubscriberTier, string | undefined> = {
      free: undefined,
      starter: env.POLAR_PRODUCT_STARTER || '5ef8f816-2cc7-4986-bf08-d2ca27a0d5be',
      pro: env.POLAR_PRODUCT_PRO || '0c3b8529-67d6-4e7b-b4dc-bc28041cd0ab',
      enterprise: env.POLAR_PRODUCT_ENTERPRISE || '0e09696f-4a48-40be-8f63-66b3e1518e47',
    };

    const productId = productIdMap[options.tier];

    if (env.POLAR_ACCESS_TOKEN && productId) {
      try {
        const payload: Record<string, any> = {
          products: [productId],
          customer_email: options.email,
          success_url: options.successUrl || 'https://data.dynep.com/?checkout=success',
        };

        // Auto-apply DYNEP37 37% off coupon
        if (options.discountCode?.trim().toUpperCase() === 'DYNEP37') {
          payload.discount_id = 'a87e75bf-9fce-4960-b645-ef36efaa6eff';
        }

        const response = await fetch('https://api.polar.sh/v1/checkouts/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = (await response.json()) as { url?: string };
          if (data.url) {
            return {
              checkoutUrl: data.url,
              product: productInfo.name,
              price: productInfo.priceUsd,
            };
          }
        } else {
          const errText = await response.text();
          logger.warn({ status: response.status, err: errText }, 'Polar API error creating checkout session');
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'Failed to create Polar checkout session via API');
      }
    }

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
  /**
   * Processes a Polar or Stripe webhook payload and handles full subscription lifecycles:
   * order.created / subscription.created -> provision or reactivate
   * subscription.updated -> upgrade/downgrade tier & quota & RPM
   * subscription.canceled / subscription.revoked -> set inactive and revoke access
   * order.refunded -> revoke API key access and record audit log
   */
  static async handleWebhook(
    payload: Record<string, any>,
    signatureHeader?: string
  ): Promise<(ProvisionResult & { action?: string }) | null> {
    const event = String(payload.type || payload.event || '').toLowerCase();
    logger.info({ eventType: event }, 'Processing billing webhook event');

    // If signature verification is enabled
    if (env.POLAR_WEBHOOK_SECRET && signatureHeader) {
      const isValid = this.verifyWebhookSignature(JSON.stringify(payload), signatureHeader, env.POLAR_WEBHOOK_SECRET);
      if (!isValid) {
        throw new Error('Invalid Polar webhook cryptographic signature');
      }
    }

    const { repository } = await import('../../db/repository.js');
    const { WebhookNotifier } = await import('../../alerts/webhookNotifier.js');

    let email = '';
    let customerId = '';
    let tier: SubscriberTier = 'starter';

    // Ignore checkout initialization events (only fulfill completed orders/subscriptions)
    if (event === 'checkout.created' || event === 'checkout.session.created') {
      logger.info({ customerId: payload.data?.id }, 'Checkout session opened, awaiting payment completion');
      return null;
    }

    // 1. Stripe Checkout / Subscription events
    if (event === 'checkout.session.completed') {
      const session = payload.data?.object || {};
      email = session.customer_details?.email || session.customer_email || '';
      customerId = session.customer || session.id || '';
      const metaTier = session.metadata?.tier?.toLowerCase();
      if (metaTier && ['free', 'starter', 'pro', 'enterprise'].includes(metaTier)) {
        tier = metaTier as SubscriberTier;
      }
    } else if (event === 'customer.subscription.created' || event === 'customer.subscription.updated') {
      const sub = payload.data?.object || {};
      email = sub.customer_email || '';
      customerId = sub.customer || '';
      const metaTier = sub.metadata?.tier?.toLowerCase();
      if (metaTier && ['free', 'starter', 'pro', 'enterprise'].includes(metaTier)) {
        tier = metaTier as SubscriberTier;
      }
    }
    // 2. Polar.sh events
    else if (
      event === 'order.created' ||
      event === 'subscription.created' ||
      event === 'subscription.updated' ||
      event === 'subscription.canceled' ||
      event === 'subscription.revoked' ||
      event === 'order.refunded'
    ) {
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

    if (!email || !email.includes('@')) {
      logger.warn({ event, customerId }, 'No valid customer email identified in billing payload, skipping key provisioning');
      return null;
    }

    // Locate existing subscriber by customerId or email
    let existingSub = customerId ? await repository.getSubscriberByCustomerId(customerId) : null;
    if (!existingSub && email) {
      existingSub = await repository.getSubscriberByEmail(email);
    }

    // A. Handle Cancellation & Revocation
    if (event.includes('canceled') || event.includes('revoked')) {
      if (existingSub) {
        const updated = await repository.updateSubscriber(existingSub.id, {
          is_active: false,
        });
        logger.warn({ subscriberId: existingSub.id, email: existingSub.email }, 'Subscription canceled - API key access disabled');
        await WebhookNotifier.sendAlert({
          title: 'Subscription Canceled / Revoked',
          status: 'WARNING',
          message: `Subscriber ${existingSub.email} (${existingSub.tier}) has canceled subscription. Key deactivated.`,
        });
        return {
          subscriber: updated || existingSub,
          plaintextApiKey: '',
          action: 'canceled',
        };
      }
      return null;
    }

    // B. Handle Order Refund
    if (event.includes('refunded')) {
      if (existingSub) {
        const updated = await repository.updateSubscriber(existingSub.id, {
          is_active: false,
        });
        logger.warn({ subscriberId: existingSub.id, email: existingSub.email }, 'Order refunded - API key revoked');
        await repository.createLog({
          source_id: '00000000-0000-0000-0000-000000000000',
          status: 'SUCCESS',
          records_count: 0,
          duration_ms: 0,
          tokens_used: 0,
          drift_detected: false,
          error_message: null,
          metadata: { audit_event: 'ORDER_REFUNDED', email: existingSub.email, customer_id: customerId },
        });
        await WebhookNotifier.sendAlert({
          title: 'Order Refunded — Key Revoked',
          status: 'WARNING',
          message: `Order refunded for subscriber ${existingSub.email}. Access disabled immediately.`,
        });
        return {
          subscriber: updated || existingSub,
          plaintextApiKey: '',
          action: 'refunded',
        };
      }
      return null;
    }

    // C. Handle Subscription Update (Upgrade/Downgrade)
    if (event.includes('updated') && existingSub) {
      const productInfo = this.TIER_PRODUCTS[tier] || this.TIER_PRODUCTS.starter;
      const updated = await repository.updateSubscriber(existingSub.id, {
        tier,
        monthly_quota: productInfo.quota,
        rate_limit_rpm: productInfo.rpm,
        is_active: true,
      });
      logger.info({ subscriberId: existingSub.id, email: existingSub.email, newTier: tier }, 'Subscription tier and quota updated');
      await WebhookNotifier.sendAlert({
        title: 'Subscription Tier Updated',
        status: 'SUCCESS',
        message: `Subscriber ${existingSub.email} updated to tier: ${tier} (Quota: ${productInfo.quota.toLocaleString()} reqs/mo, RPM: ${productInfo.rpm})`,
      });
      return {
        subscriber: updated || existingSub,
        plaintextApiKey: '',
        action: 'updated',
      };
    }

    // D. If existing subscriber purchases again, reactivate / upgrade
    if (existingSub) {
      const productInfo = this.TIER_PRODUCTS[tier] || this.TIER_PRODUCTS.starter;
      const updated = await repository.updateSubscriber(existingSub.id, {
        tier,
        monthly_quota: productInfo.quota,
        rate_limit_rpm: productInfo.rpm,
        is_active: true,
      });
      return {
        subscriber: updated || existingSub,
        plaintextApiKey: '',
        action: 'reactivated',
      };
    }

    // E. Provision new subscriber account (order.created / subscription.created / checkout.session.completed)
    const provisionResult = await ApiKeyProvisioner.provisionSubscriber({
      email,
      customerId,
      tier,
    });

    return {
      ...provisionResult,
      action: 'provisioned',
    };
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
