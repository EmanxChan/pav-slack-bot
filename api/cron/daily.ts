import app from '../../src/bot';
import { logger } from '../../src/logger';
import { getScheduledReminders, shouldSendReminder } from '../../src/reminders';

/**
 * Vercel cron job endpoint for daily reminders
 * This runs once per day and checks if any reminders should be sent
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== cronSecret) {
      logger.warn('Unauthorized cron access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info('Cron job started');

    // Get all scheduled reminders
    const reminders = getScheduledReminders();
    const today = new Date().toISOString().split('T')[0];

    // Filter reminders that should be sent today
    const remindersToSend = reminders.filter((reminder) =>
      shouldSendReminder(reminder.type, reminder.date)
    );

    logger.info('Reminders to send', { count: remindersToSend.length, date: today });

    // Send each reminder
    for (const reminder of remindersToSend) {
      try {
        if (reminder.targetChannel) {
          await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: reminder.targetChannel,
            text: reminder.message,
          });

          logger.logReminderSent(reminder.type, reminder.targetChannel);
        }
      } catch (error) {
        logger.error('Error sending reminder', error as Error, { type: reminder.type });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent: remindersToSend.length,
        date: today,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Cron job error', error as Error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Also support POST for manual testing
export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
