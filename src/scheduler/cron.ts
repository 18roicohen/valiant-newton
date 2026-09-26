import cron, { ScheduledTask } from 'node-cron';
import { repository } from '../db/repository.js';
import { ScrapingEngine } from '../scraper/engine.js';
import { logger } from '../db/client.js';

export class SchedulerService {
  private static scheduledTasks: Map<string, ScheduledTask> = new Map();
  private static systemTasks: ScheduledTask[] = [];
  private static syncInterval: NodeJS.Timeout | null = null;

  /**
   * Starts the cron scheduler, system maintenance jobs, and syncs active sources
   */
  static async start(): Promise<void> {
    logger.info('Starting Autonomous Cron Scheduler');

    // 1. Schedule hourly rotating database snapshots ('0 * * * *')
    const backupTask = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Executing scheduled database snapshot backup');
        const snapshot = await repository.createBackupSnapshot();
        logger.info({ filename: snapshot.filename, bytes: snapshot.sizeBytes }, 'Scheduled backup completed');
      } catch (err: any) {
        logger.error({ err: err.message }, 'Scheduled backup snapshot failed');
      }
    });
    this.systemTasks.push(backupTask);

    // 2. Schedule monthly quota reset at midnight on the 1st of each month ('0 0 1 * *')
    const quotaResetTask = cron.schedule('0 0 1 * *', async () => {
      try {
        logger.info('Executing automated 1st-of-month subscriber quota reset');
        const count = await repository.resetMonthlyQuotas();
        logger.info({ count }, 'Monthly quotas reset to 0');
      } catch (err: any) {
        logger.error({ err: err.message }, 'Monthly quota reset scheduler failed');
      }
    });
    this.systemTasks.push(quotaResetTask);

    // 3. Schedule autonomous IndexNow search engine ping every 2 hours ('0 */2 * * *')
    const indexNowTask = cron.schedule('0 */2 * * *', async () => {
      try {
        logger.info('Executing automated IndexNow search engine ping');
        const { pingSearchEngines } = await import('../../scripts/ping-search-engines.js');
        await pingSearchEngines();
      } catch (err: any) {
        logger.error({ err: err.message }, 'Scheduled IndexNow ping failed');
      }
    });
    this.systemTasks.push(indexNowTask);

    // 4. Schedule automated lead conversion scan via Resend every 6 hours ('0 */6 * * *')
    const nurtureTask = cron.schedule('0 */6 * * *', async () => {
      try {
        logger.info('Executing automated lead nurture quota scan');
        const { UserGrowthEngine } = await import('../../scripts/user-growth-engine.js');
        await UserGrowthEngine.dispatchNurtureEmails();
      } catch (err: any) {
        logger.error({ err: err.message }, 'Scheduled lead nurture scan failed');
      }
    });
    this.systemTasks.push(nurtureTask);

    // 5. Sync and start source scrapers
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

    for (const task of this.systemTasks) {
      task.stop();
    }
    this.systemTasks = [];
  }
}
