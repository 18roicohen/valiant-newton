import { buildServer } from './api/server.js';
import { SchedulerService } from './scheduler/cron.js';
import { env } from './config/env.js';
import { logger } from './db/client.js';

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'all';

  logger.info({ mode, env: env.NODE_ENV }, '🚀 Initializing Autonomous Micro-DaaS Engine');

  let server: any = null;

  // 1. Start Fastify API Gateway
  if (mode === 'all' || mode === 'api') {
    server = await buildServer();
    try {
      await server.listen({ port: env.PORT, host: env.HOST });
      logger.info(`⚡ API Gateway running at http://${env.HOST}:${env.PORT}`);
    } catch (err) {
      logger.fatal({ err }, 'Failed to start Fastify server');
      process.exit(1);
    }
  }

  // 2. Start Cron Scheduler Worker
  if ((mode === 'all' || mode === 'worker') && env.ENABLE_CRON_SCHEDULER) {
    await SchedulerService.start();
    logger.info('⏰ Scheduler worker active and listening for cron triggers');
  }

  // Graceful Shutdown Handling
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    if (server) {
      await server.close();
    }
    SchedulerService.stop();
    logger.info('System shutdown cleanly');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error on boot');
  process.exit(1);
});
