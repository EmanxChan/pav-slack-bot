import app from '../src/bot';
import { logger } from '../src/logger';

/**
 * Vercel serverless function entry point
 * This handles all incoming requests and routes them appropriately
 */
export async function GET(request: Request): Promise<Response> {
  return new Response(JSON.stringify({ status: 'ok', message: 'PAV Slack Bot is running' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  logger.info('Incoming request', { method: request.method, path });

  // Route to appropriate handler
  if (path.startsWith('/api/slack/events')) {
    const { POST: handleEvents } = await import('./slack/events');
    return handleEvents(request);
  }

  if (path.startsWith('/api/slack/commands')) {
    const { POST: handleCommands } = await import('./slack/commands');
    return handleCommands(request);
  }

  if (path.startsWith('/api/cron/daily')) {
    const { GET: handleCron, POST: handleCronPost } = await import('./cron/daily');
    return request.method === 'POST' ? handleCronPost(request) : handleCron(request);
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
