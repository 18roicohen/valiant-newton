import { FastifyPluginAsync } from 'fastify';
import { PolarService } from '../billing/polar.js';
import { ApiKeyProvisioner } from '../billing/keyProvisioner.js';
import { SubscriberTier } from '../../db/schema.js';
import { logger } from '../../db/client.js';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/checkout/create
   * Initiates a Polar.sh checkout session
   */
  fastify.post('/api/checkout/create', async (request, reply) => {
    const body = (request.body as { email: string; tier: SubscriberTier; discountCode?: string }) || {};

    if (!body.email || !body.email.includes('@')) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Valid email address is required' });
    }

    const tier = (body.tier && ['free', 'starter', 'pro', 'enterprise'].includes(body.tier))
      ? body.tier
      : 'starter';

    const session = await PolarService.createCheckoutSession({
      email: body.email,
      tier,
      discountCode: body.discountCode || 'DYNEP37',
    });

    return reply.status(200).send(session);
  });

  /**
   * GET /api/checkout/simulate
   * Instant interactive checkout flow (simulates Polar payment confirmation and returns live API key)
   */
  fastify.get('/api/checkout/simulate', async (request, reply) => {
    const query = request.query as { email?: string; tier?: SubscriberTier };
    const email = query.email || `customer-${Date.now()}@domain.com`;
    const tier = (query.tier && ['free', 'starter', 'pro', 'enterprise'].includes(query.tier))
      ? query.tier
      : 'starter';

    const provisionResult = await ApiKeyProvisioner.provisionSubscriber({
      email,
      customerId: `polar_${Date.now()}`,
      tier,
    });

    // Return friendly HTML success screen or JSON
    const acceptsHtml = request.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Polar.sh Payment Confirmed — API Key Provisioned</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-6 font-sans">
          <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
            <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ✓
            </div>
            <h1 class="text-2xl font-bold text-white mb-2">Payment Confirmed by Polar!</h1>
            <p class="text-slate-400 text-sm mb-6">Your Micro-DaaS API subscription is now active.</p>

            <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left mb-6">
              <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Your Personal API Key:</div>
              <div class="font-mono text-emerald-400 text-sm break-all font-semibold select-all bg-slate-900 p-2 rounded border border-emerald-500/30">${provisionResult.plaintextApiKey}</div>
              <div class="mt-3 flex justify-between text-xs text-slate-400">
                <span>Tier: <strong class="text-white capitalize">${provisionResult.subscriber.tier}</strong></span>
                <span>Monthly Quota: <strong class="text-white">${provisionResult.subscriber.monthly_quota.toLocaleString()} reqs</strong></span>
              </div>
            </div>

            <a href="/" class="block w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition">
              Open Live API Playground →
            </a>
          </div>
        </body>
        </html>
      `);
    }

    return reply.status(200).send({
      success: true,
      subscriber_id: provisionResult.subscriber.id,
      email: provisionResult.subscriber.email,
      tier: provisionResult.subscriber.tier,
      quota: provisionResult.subscriber.monthly_quota,
      api_key: provisionResult.plaintextApiKey,
    });
  });

  /**
   * POST /api/webhooks/polar
   * Dedicated Polar.sh Webhook receiver
   */
  fastify.post('/api/webhooks/polar', async (request, reply) => {
    const payload = request.body as Record<string, any>;
    const signature = request.headers['polar-signature'] as string | undefined;

    try {
      const result = await PolarService.handleWebhook(payload, signature);
      if (result) {
        return reply.status(200).send({
          received: true,
          action: result.action || 'processed',
          provisioned: result.action === 'provisioned',
          subscriber_id: result.subscriber.id,
          email: result.subscriber.email,
          tier: result.subscriber.tier,
          api_key: result.plaintextApiKey,
        });
      }
      return reply.status(200).send({ received: true, provisioned: false, action: 'ignored' });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Polar webhook processing failed');
      return reply.status(400).send({ error: 'Webhook Error', message: err.message });
    }
  });

  /**
   * POST /api/webhooks/billing
   * Unified webhook receiver
   */
  fastify.post('/api/webhooks/billing', async (request, reply) => {
    const payload = request.body as Record<string, any>;
    const result = await PolarService.handleWebhook(payload);
    return reply.status(200).send({
      received: true,
      action: result?.action || 'ignored',
      provisioned: Boolean(result),
      subscriber_id: result?.subscriber.id,
      email: result?.subscriber.email,
      tier: result?.subscriber.tier,
      api_key: result?.plaintextApiKey,
    });
  });
};
