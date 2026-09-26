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

export interface NtfyOptions {
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  clickUrl?: string;
  topic?: string;
}

export class WebhookNotifier {
  /**
   * Dispatches push notification directly to ntfy.sh topic
   */
  static async sendNtfy(options: NtfyOptions): Promise<boolean> {
    const topic = options.topic || env.NTFY_TOPIC || 'dynep_alerts';
    const baseUrl = env.NTFY_URL || 'https://ntfy.sh';
    const url = `${baseUrl.replace(/\/+$/, '')}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          title: options.title,
          message: options.message,
          priority: options.priority || 3,
          tags: options.tags || ['robot'],
          click: options.clickUrl || 'https://data.dynep.com',
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status, topic }, 'ntfy.sh delivery returned non-200');
        return false;
      }
      return true;
    } catch (err: any) {
      logger.error({ error: err.message, topic }, 'Failed to dispatch notification to ntfy.sh');
      return false;
    }
  }

  /**
   * Sends structured notifications to both ntfy.sh and configured webhook endpoint
   */
  static async sendAlert(payload: AlertPayload): Promise<void> {
    const priorityMap: Record<AlertPayload['status'], 1 | 2 | 3 | 4 | 5> = {
      SUCCESS: 3,
      DRIFT_REPAIRED: 4,
      WARNING: 4,
      FAILED: 5,
    };

    const tagsMap: Record<AlertPayload['status'], string[]> = {
      SUCCESS: ['white_check_mark', 'robot'],
      DRIFT_REPAIRED: ['wrench', 'sparkles', 'zap'],
      WARNING: ['warning', 'chart_with_upwards_trend'],
      FAILED: ['rotating_light', 'x', 'fire'],
    };

    // 1. Send push notification to ntfy.sh
    if (env.NTFY_TOPIC) {
      let detailSummary = '';
      if (payload.details && Object.keys(payload.details).length > 0) {
        detailSummary = '\n' + Object.entries(payload.details).map(([k, v]) => `• ${k}: ${v}`).join('\n');
      }

      await this.sendNtfy({
        topic: env.NTFY_TOPIC,
        title: `[dynep.com] ${payload.title}`,
        message: `${payload.message}${payload.sourceName ? `\nSource: ${payload.sourceName}` : ''}${detailSummary}`,
        priority: priorityMap[payload.status] || 3,
        tags: tagsMap[payload.status] || ['robot'],
        clickUrl: 'https://data.dynep.com',
      });
    }

    // 2. Dispatch to Discord / Slack webhook if ALERT_WEBHOOK_URL is set
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

      const body = {
        embeds: [
          {
            title: `[Micro-DaaS - dynep.com] ${payload.title}`,
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

