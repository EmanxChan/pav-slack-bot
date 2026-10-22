import { config } from '../../src/config';
import { logger } from '../../src/logger';

/**
 * Vercel serverless function for Slack slash commands
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.formData();
    const command = body.get('command') as string;
    const text = body.get('text') as string;
    const userId = body.get('user_id') as string;
    const channelId = body.get('channel_id') as string;

    logger.logSlackEvent('slash_command', userId, { command, text, channelId });

    // Handle different commands
    let responseText = '';

    switch (command) {
      case '/admin-help':
        responseText = `*Admin Commands:*

/admin-update <json> - Update entire program info with JSON
/add-resource <type> <url> <description> - Add a new resource (type: deck, document, spreadsheet)
/update-zoom <mina|mona> <link> - Update advisor zoom link
/admin-help - Show this help message

*Example:*
/add-resource deck https://docs.google.com/presentation/d/xyz "2026 Workshop 1 Deck"`;
        break;

      default:
        responseText = `Unknown command: ${command}. Use /admin-help for available commands.`;
    }

    return new Response(JSON.stringify({ text: responseText }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Error processing slash command', error as Error);
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
