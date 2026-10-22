import app from '../../src/bot';
import { logger } from '../../src/logger';

/**
 * Vercel serverless function for Slack events
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-slack-signature');
    const timestamp = request.headers.get('x-slack-request-timestamp');

    if (!signature || !timestamp) {
      logger.warn('Missing Slack signature headers');
      return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check for replay attacks (requests older than 5 minutes)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - requestTime) > 300) {
      logger.warn('Request too old, possible replay attack');
      return new Response(JSON.stringify({ error: 'Request too old' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle URL verification challenge
    try {
      const parsedBody = JSON.parse(body);
      if (parsedBody.type === 'url_verification') {
        logger.info('Slack URL verification');
        return new Response(JSON.stringify({ challenge: parsedBody.challenge }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // Not JSON, continue processing
    }

    // Process the event through Bolt
    // Note: This needs to be adapted for Vercel serverless
    // For now, we'll use Bolt's HTTP mode

    logger.info('Slack event received');

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Error processing Slack event', error as Error);
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
