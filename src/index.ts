import app from './bot';
import { config } from './config';
import { logger } from './logger';

// Start the app
(async () => {
  try {
    await app.start(config.port);
    logger.info(`⚡️ PAV Slack Bot is running on port ${config.port}!`);
  } catch (error) {
    logger.error('Failed to start bot', error as Error);
    process.exit(1);
  }
})();
