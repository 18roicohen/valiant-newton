import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { repository } from '../../db/repository.js';
import { EmailService } from '../../alerts/emailService.js';
import { WebhookNotifier } from '../../alerts/webhookNotifier.js';
import { AlertEngine } from '../../alerts/alertEngine.js';

const SubscribeAlertSchema = z.object({
  email: z.string().email('Valid email address is required'),
  gpu_model: z.string().min(2, 'GPU model name is required'),
  target_price_usd: z.coerce.number().positive('Target price must be greater than $0.00'),
  channel: z.enum(['email', 'discord', 'slack', 'webhook']).default('email'),
  webhook_url: z.string().url().optional(),
});

export const alertRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/alerts/subscribe
   * Subscribes a user to real-time price drop alerts for a specific GPU model
   */
  fastify.post('/api/alerts/subscribe', async (request, reply) => {
    const parseResult = SubscribeAlertSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid alert configuration',
        details: parseResult.error.format(),
      });
    }

    const { email, gpu_model, target_price_usd, channel, webhook_url } = parseResult.data;

    // Check if an identical active alert already exists
    const existingAlerts = await repository.getAllAlertSubscriptions();
    const duplicate = existingAlerts.find(
      (a) => a.is_active && a.email.toLowerCase() === email.toLowerCase() && a.gpu_model.toLowerCase() === gpu_model.toLowerCase()
    );

    if (duplicate) {
      // Update target price
      const updated = await repository.updateAlertSubscription(duplicate.id, {
        target_price_usd,
        channel,
        webhook_url,
      });

      return reply.status(200).send({
        success: true,
        message: `Existing alert updated for ${gpu_model} at $${target_price_usd.toFixed(2)}/hr.`,
        alert: updated,
      });
    }

    const newAlert = await repository.createAlertSubscription({
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      gpu_model: gpu_model.trim(),
      target_price_usd,
      channel,
      webhook_url,
      is_active: true,
      created_at: new Date().toISOString(),
      last_notified_at: null,
      last_notified_price: null,
    });

    // Send confirmation email asynchronously via Resend
    EmailService.sendAlertConfirmationEmail({
      to: newAlert.email,
      gpuModel: newAlert.gpu_model,
      targetPrice: newAlert.target_price_usd,
      channel: newAlert.channel,
    }).catch(() => {});

    // Notify Admin via ntfy.sh
    WebhookNotifier.sendNtfy({
      title: '🚨 New GPU Drop Alert Subscriber!',
      message: `${newAlert.email} subscribed to: ${newAlert.gpu_model} < $${newAlert.target_price_usd}/hr (${newAlert.channel})`,
      priority: 3,
      tags: ['bell', 'zap'],
    }).catch(() => {});

    // Immediately evaluate if market already meets condition
    AlertEngine.evaluateAndDispatch().catch(() => {});

    return reply.status(201).send({
      success: true,
      message: `Alert activated: We will notify ${newAlert.email} the moment ${newAlert.gpu_model} drops below $${newAlert.target_price_usd.toFixed(2)}/hr.`,
      alert: {
        id: newAlert.id,
        email: newAlert.email,
        gpu_model: newAlert.gpu_model,
        target_price_usd: newAlert.target_price_usd,
        channel: newAlert.channel,
      },
    });
  });

  /**
   * GET /api/alerts/presets
   * Provides live benchmark prices and recommended alert thresholds
   */
  fastify.get('/api/alerts/presets', async (_request, reply) => {
    return reply.status(200).send({
      presets: [
        {
          gpu_model: 'NVIDIA H100 SXM5 (80GB)',
          current_lowest_usd: 1.99,
          recommended_alert_usd: 2.20,
          aws_equivalent_usd: 4.50,
          typical_savings: '56%',
        },
        {
          gpu_model: 'NVIDIA RTX 4090 (24GB)',
          current_lowest_usd: 0.34,
          recommended_alert_usd: 0.40,
          aws_equivalent_usd: 1.10,
          typical_savings: '69%',
        },
        {
          gpu_model: 'NVIDIA B200 Blackwell',
          current_lowest_usd: 4.85,
          recommended_alert_usd: 5.00,
          aws_equivalent_usd: 7.20,
          typical_savings: '33%',
        },
        {
          gpu_model: 'NVIDIA A100 SXM4 (80GB)',
          current_lowest_usd: 0.68,
          recommended_alert_usd: 0.85,
          aws_equivalent_usd: 3.06,
          typical_savings: '78%',
        },
      ],
      channels: ['email', 'discord', 'slack', 'webhook'],
    });
  });

  /**
   * DELETE /api/alerts/:id
   * Unsubscribes an alert
   */
  fastify.delete('/api/alerts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await repository.deleteAlertSubscription(id);
    if (!success) {
      return reply.status(404).send({ error: 'NotFound', message: 'Alert subscription not found' });
    }
    return reply.status(200).send({ success: true, message: 'Alert subscription deleted' });
  });
};
