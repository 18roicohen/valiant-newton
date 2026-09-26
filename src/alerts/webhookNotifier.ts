import { env } from '../config/env.js';
import { logger } from '../db/client.js';

export interface AlertPayload {
  title: string;
  sourceName?: string;
  sourceId?: string;
  status: 'SUCCESS' | 'DRIFT_REPAIRED' | 'FAILED' | 'WARNING';
  details?: Record<string, any>;
  message: string;
}

export class WebhookNotifier {
  /**
   * Sends a structured webhook notification if ALERT_WEBHOOK_URL is configured
   */
  static async sendAlert(payload: AlertPayload): Promise<void> {
    const webhookUrl = env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      const colorMap = {
        SUCCESS: 0x22c55e, // Green
        DRIFT_REPAIRED: 0xeab308, // Yellow/Amber
        WARNING: 0xf97316, // Orange
        FAILED: 0xef4444, // Red
      };

      // Discord / Slack compatible webhook body
      const body = {
        embeds: [
          {
            title: `[Micro-DaaS] ${payload.title}`,
            description: payload.message,
            color: colorMap[payload.status] || 0x3b82f6,
            fields: [
              ...(payload.sourceName ? [{ name: 'Source', value: payload.sourceName, inline: true }] : []),
              { name: 'Status', value: payload.status, inline: true },
              ...(payload.details
                ? Object.entries(payload.details).map(([k, v]) => ({
                    name: k,
                    value: typeof v === 'object' ? JSON.stringify(v) : String(v),
                    inline: true,
                  }))
                : []),
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Webhook alert delivery returned non-200 status');
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to dispatch webhook alert');
    }
  }
}
