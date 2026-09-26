import cron, { ScheduledTask } from 'node-cron';
import { repository } from '../db/repository.js';
import { ScrapingEngine } from '../scraper/engine.js';
import { logger } from '../db/client.js';

export class SchedulerService {
  private static scheduledTasks: Map<string, ScheduledTask> = new Map();
  private static syncInterval: NodeJS.Timeout | null = null;

  /**
   * Starts the cron scheduler and syncs active sources
   */
  static async start(): Promise<void> {
    logger.info('Starting Autonomous Cron Scheduler');
    await this.refreshTasks();

    // Re-check sources every 5 minutes to pick up newly added or modified sources
    this.syncInterval = setInterval(() => {
      this.refreshTasks().catch((err) => logger.error({ err }, 'Failed to refresh cron tasks'));
    }, 5 * 60 * 1000);
  }

  /**
   * Refreshes active scheduled tasks from the database
   */
  static async refreshTasks(): Promise<void> {
    const activeSources = await repository.getActiveSources();
    const currentSourceIds = new Set(activeSources.map((s) => s.id));

    // Cancel removed or deactivated tasks
    for (const [id, task] of this.scheduledTasks.entries()) {
      if (!currentSourceIds.has(id)) {
        logger.info({ sourceId: id }, 'Stopping cron task for deactivated source');
        task.stop();
        this.scheduledTasks.delete(id);
      }
    }

    // Register or update active tasks
    for (const source of activeSources) {
      if (this.scheduledTasks.has(source.id)) {
        continue;
      }

      const cronExpr = source.schedule_cron || '0 * * * *';
      if (!cron.validate(cronExpr)) {
        logger.warn({ sourceId: source.id, cronExpr }, 'Invalid cron expression, skipping');
        continue;
      }

      logger.info({ sourceId: source.id, name: source.name, cronExpr }, 'Scheduling extraction cron job');

      const task = cron.schedule(cronExpr, async () => {
        logger.info({ sourceId: source.id, name: source.name }, 'Cron trigger fired for source');
        try {
          await ScrapingEngine.scrapeSource(source.id);
        } catch (err: any) {
          logger.error({ sourceId: source.id, error: err.message }, 'Cron execution failed');
        }
      });

      this.scheduledTasks.set(source.id, task);
    }
  }

  /**
   * Stops all running cron tasks
   */
  static stop(): void {
    logger.info('Stopping Cron Scheduler Service');
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    for (const task of this.scheduledTasks.values()) {
      task.stop();
    }
    this.scheduledTasks.clear();
  }
}
