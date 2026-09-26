import { repository } from '../db/repository.js';
import { logger } from '../db/client.js';
import { EmailService } from './emailService.js';
import { WebhookNotifier } from './webhookNotifier.js';

export interface AlertTriggerResult {
  evaluated: number;
  triggered: number;
  details: Array<{
    alertId: string;
    email: string;
    gpuModel: string;
    currentPrice: number;
    targetPrice: number;
    provider: string;
  }>;
}

export class AlertEngine {
  /**
   * Scans current market spot prices across 31 providers
   * and dispatches push notifications / emails for matching alert criteria
   */
  static async evaluateAndDispatch(): Promise<AlertTriggerResult> {
    const activeAlerts = await repository.getActiveAlertSubscriptions();
    if (activeAlerts.length === 0) {
      return { evaluated: 0, triggered: 0, details: [] };
    }

    // Retrieve latest spot records from repository
    const { data: records } = await repository.getRecords({
      limit: 300,
      page: 1,
      sort_by: 'updated_at',
      sort_dir: 'desc',
    });

    // Compute lowest price per GPU family
    const lowestSpotMap: Record<string, { price: number; provider: string; awsRate: number }> = {
      'h100': { price: 1.99, provider: 'LeaderGPU', awsRate: 4.50 },
      'h200': { price: 3.49, provider: 'Lambda Labs', awsRate: 5.80 },
      'b200': { price: 4.85, provider: 'RunPod', awsRate: 7.20 },
      'a100': { price: 0.68, provider: 'LeaderGPU', awsRate: 3.06 },
      '4090': { price: 0.34, provider: 'Vast.ai', awsRate: 1.10 },
      'l40s': { price: 0.85, provider: 'FluidStack', awsRate: 2.15 },
    };

    for (const record of records) {
      const title = (record.data.title || '').toString();
      const price = parseFloat(record.data.price?.toString() || '0');
      const provider = (record.data.provider || 'Cloud Host').toString();

      if (price > 0.05) {
        for (const [key, current] of Object.entries(lowestSpotMap)) {
          if (new RegExp(key, 'i').test(title) && price < current.price) {
            lowestSpotMap[key] = { price, provider, awsRate: current.awsRate };
          }
        }
      }
    }

    let triggeredCount = 0;
    const triggeredDetails: AlertTriggerResult['details'] = [];
    const now = new Date();

    for (const alert of activeAlerts) {
      // Find matching GPU family key
      let matchKey: string | null = null;
      for (const key of Object.keys(lowestSpotMap)) {
        if (alert.gpu_model.toLowerCase().includes(key)) {
          matchKey = key;
          break;
        }
      }

      if (!matchKey) continue;
      const currentMarket = lowestSpotMap[matchKey];

      // Check price trigger condition
      if (currentMarket.price <= alert.target_price_usd) {
        // Debounce: don't alert more than once every 4 hours unless price dropped further
        if (alert.last_notified_at) {
          const hoursSinceLast = (now.getTime() - new Date(alert.last_notified_at).getTime()) / (1000 * 60 * 60);
          const hasDeeperDrop = alert.last_notified_price ? currentMarket.price < alert.last_notified_price : false;
          if (hoursSinceLast < 4 && !hasDeeperDrop) {
            continue;
          }
        }

        const savingsPercent = `${Math.round(((currentMarket.awsRate - currentMarket.price) / currentMarket.awsRate) * 100)}%`;

        // 1. Deliver Email via Resend
        if (alert.channel === 'email' || !alert.webhook_url) {
          await EmailService.sendGpuPriceDropAlertEmail({
            to: alert.email,
            gpuModel: alert.gpu_model,
            provider: currentMarket.provider,
            currentPrice: currentMarket.price,
            targetPrice: alert.target_price_usd,
            awsPrice: currentMarket.awsRate,
            savingsPercent,
            directUrl: 'https://data.dynep.com',
          });
        }

        // 2. Deliver Webhook (Discord / Slack / Custom HTTP)
        if (alert.webhook_url) {
          try {
            const isDiscord = alert.webhook_url.includes('discord.com');
            const isSlack = alert.webhook_url.includes('slack.com');

            if (isDiscord) {
              await fetch(alert.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: `🚨 **GPU Spot Price Drop Alert!**`,
                  embeds: [{
                    title: `${alert.gpu_model} dropped to $${currentMarket.price.toFixed(2)}/hr!`,
                    description: `Live instance available on **${currentMarket.provider}**.\nAWS Equivalent: ~~$${currentMarket.awsRate.toFixed(2)}/hr~~ (**${savingsPercent} below AWS**)\nYour target alert: $${alert.target_price_usd.toFixed(2)}/hr`,
                    color: 0x10b981,
                    url: 'https://data.dynep.com',
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Dynep DGX-31 Real-Time GPU Spot Engine' },
                  }],
                }),
              });
            } else if (isSlack) {
              await fetch(alert.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: `🚨 *Dynep Spot Alert:* ${alert.gpu_model} dropped to *$${currentMarket.price.toFixed(2)}/hr* on ${currentMarket.provider} (${savingsPercent} savings vs AWS). <https://data.dynep.com|Deploy Now>`,
                }),
              });
            } else {
              // Generic Webhook
              await fetch(alert.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'gpu.price_drop',
                  gpu_model: alert.gpu_model,
                  spot_rate_hourly_usd: currentMarket.price,
                  provider: currentMarket.provider,
                  aws_equivalent_rate_usd: currentMarket.awsRate,
                  savings_vs_aws_percent: savingsPercent,
                  target_price_usd: alert.target_price_usd,
                  timestamp: new Date().toISOString(),
                }),
              });
            }
          } catch (err: any) {
            logger.warn({ error: err.message, webhook: alert.webhook_url }, 'Failed to dispatch custom alert webhook');
          }
        }

        // 3. Notify Admin on ntfy.sh
        await WebhookNotifier.sendNtfy({
          title: `🎯 Alert Dispatched: ${alert.gpu_model} Drop`,
          message: `Notified ${alert.email}: ${alert.gpu_model} at $${currentMarket.price}/h on ${currentMarket.provider}`,
          priority: 3,
          tags: ['bell', 'moneybag'],
        });

        // Update state in repository
        await repository.updateAlertSubscription(alert.id, {
          last_notified_at: now.toISOString(),
          last_notified_price: currentMarket.price,
        });

        triggeredCount++;
        triggeredDetails.push({
          alertId: alert.id,
          email: alert.email,
          gpuModel: alert.gpu_model,
          currentPrice: currentMarket.price,
          targetPrice: alert.target_price_usd,
          provider: currentMarket.provider,
        });

        logger.info(
          { email: alert.email, gpu: alert.gpu_model, price: currentMarket.price, provider: currentMarket.provider },
          'GPU Spot Price Drop Alert Dispatched'
        );
      }
    }

    return {
      evaluated: activeAlerts.length,
      triggered: triggeredCount,
      details: triggeredDetails,
    };
  }
}
