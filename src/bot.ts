import { App } from '@slack/bolt';
import MiniMaxClient from './minimax-client';
import RAGSystem from './rag-system';
import { config } from './config';
import { logger } from './logger';
import { getWelcomeMessage } from './reminders';
require('dotenv').config();

// Initialize clients
const minimax = new MiniMaxClient(config.minimax);
const rag = new RAGSystem();

// Initialize Slack app
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  socketMode: false, // Use HTTP mode for Vercel
});

// System prompt for MiniMax
const SYSTEM_PROMPT = `You are a helpful assistant for the Path Ahead Ventures Strategic Planning Sprint program. You have access to detailed program information and your role is to answer questions about the program accurately and helpfully.

Guidelines:
- When asked about dates, times, or schedules, provide specific details from the program information
- When asked for zoom links, provide the appropriate link for the session or advisor
- Be concise but thorough in your responses
- If you don't know something based on the provided context, say so rather than making it up
- Use a friendly, professional tone
- When providing links, format them clearly
- If someone asks about eligibility or criteria, provide the student criteria information
- For application questions, provide the deadline and form link

You are speaking to founders and participants in the program, so be encouraging and supportive while being informative.`;

/**
 * Check if user is a member of the closed channel
 */
async function isUserInChannel(userId: string, channelId: string): Promise<boolean> {
  try {
    const result = await app.client.conversations.members({
      token: config.slack.botToken,
      channel: channelId,
    });
    return result.members?.includes(userId) || false;
  } catch (error) {
    logger.error('Error checking channel membership', error as Error, { userId, channelId });
    return false;
  }
}

/**
 * Process user message with MiniMax
 */
async function processMessage(question: string, userId: string): Promise<string> {
  try {
    // Get relevant context from RAG system
    const context = rag.getRelevantContext(question);

    // Get response from MiniMax
    const response = await minimax.chatCompletion(SYSTEM_PROMPT, question, context, 0.7);

    return response;
  } catch (error) {
    logger.error('Error processing message', error as Error, { userId });
    return 'Sorry, I encountered an error processing your request. Please try again later.';
  }
}

/**
 * Handle app mentions in the channel
 */
app.event('app_mention', async ({ event, say }) => {
  const userId = (event as any).user;
  const channelId = (event as any).channel;
  const question = ((event as any).text || '').replace(/<@\w+>/g, '').trim(); // Remove bot mention

  logger.logSlackEvent('app_mention', userId, { channelId, question });

  try {
    // Verify user is in the channel
    const isMember = await isUserInChannel(userId, channelId);
    if (!isMember) {
      await say({
        text: "Sorry, I can only respond to members of this channel.",
        channel: channelId,
      });
      return;
    }

    // Process and respond
    const response = await processMessage(question, userId);

    await say({
      text: response,
      channel: channelId,
    });
  } catch (error) {
    logger.error('Error handling app_mention', error as Error, { userId, channelId });
    await say({
      text: 'Sorry, something went wrong. Please try again.',
      channel: channelId,
    });
  }
});

/**
 * Handle direct messages
 */
app.message(async ({ message, say }) => {
  // Only process DMs (not channel messages)
  if ((message as any).channel_type !== 'im') {
    return;
  }

  const userId = (message as any).user;
  const question = (message as any).text as string;
  const channelId = (message as any).channel;

  logger.logSlackEvent('direct_message', userId, { question });

  try {
    // Verify user is a member of the closed channel
    const targetChannelId = config.slack.channelId;
    const isMember = await isUserInChannel(userId, targetChannelId);

    if (!isMember) {
      await say({
        text: "Sorry, I can only respond to members of the Strategic Planning Sprint channel. If you should have access, please contact the program administrator.",
        channel: channelId,
      });
      return;
    }

    // Process and respond
    const response = await processMessage(question, userId);

    await say({
      text: response,
      channel: channelId,
    });
  } catch (error) {
    logger.error('Error handling DM', error as Error, { userId });
    await say({
      text: 'Sorry, something went wrong. Please try again.',
      channel: channelId,
    });
  }
});

/**
 * Handle team join events (new member welcome)
 */
app.event('team_join', async ({ event }) => {
  const userId = (event as any).user.id;

  logger.logSlackEvent('team_join', userId);

  try {
    // Send welcome message via DM
    await app.client.chat.postMessage({
      token: config.slack.botToken,
      channel: userId,
      text: getWelcomeMessage(),
    });

    logger.info('Welcome message sent', { userId });
  } catch (error) {
    logger.error('Error sending welcome message', error as Error, { userId });
  }
});

/**
 * Admin command: Update program info
 */
app.command('/admin-update', async ({ command, ack, respond }) => {
  await ack();

  try {
    const jsonData = command.text;
    const newInfo = JSON.parse(jsonData);

    // Update the program-info.json file
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data', 'program-info.json');

    fs.writeFileSync(filePath, JSON.stringify(newInfo, null, 2));

    // Reload the data
    rag.reloadData();

    await respond({
      text: '✅ Program information updated successfully!',
    });

    logger.info('Program info updated via admin command');
  } catch (error) {
    logger.error('Error updating program info', error as Error);
    await respond({
      text: `❌ Error updating program info: ${(error as Error).message}. Please check your JSON format.`,
    });
  }
});

/**
 * Admin command: Add a resource
 */
app.command('/add-resource', async ({ command, ack, respond }) => {
  await ack();

  try {
    const parts = command.text.trim().split(/\s+/);
    if (parts.length < 3) {
      await respond({
        text: 'Usage: /add-resource <type> <url> <description>\nTypes: deck, document, spreadsheet',
      });
      return;
    }

    const [type, url, ...descriptionParts] = parts;
    const description = descriptionParts.join(' ');

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data', 'program-info.json');

    const programInfo = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (type === 'deck') {
      programInfo.resources.decks[description] = url;
    } else if (type === 'document') {
      programInfo.resources.documents[description] = url;
    } else if (type === 'spreadsheet') {
      programInfo.resources.spreadsheets[description] = url;
    } else {
      await respond({
        text: 'Invalid type. Use: deck, document, or spreadsheet',
      });
      return;
    }

    fs.writeFileSync(filePath, JSON.stringify(programInfo, null, 2));
    rag.reloadData();

    await respond({
      text: `✅ Added ${type}: ${description} -> ${url}`,
    });

    logger.info('Resource added via admin command', { type, description });
  } catch (error) {
    logger.error('Error adding resource', error as Error);
    await respond({
      text: `❌ Error adding resource: ${(error as Error).message}`,
    });
  }
});

/**
 * Admin command: Update zoom link
 */
app.command('/update-zoom', async ({ command, ack, respond }) => {
  await ack();

  try {
    const parts = command.text.trim().split(/\s+/);
    if (parts.length < 2) {
      await respond({
        text: 'Usage: /update-zoom <mina|mona> <link>',
      });
      return;
    }

    const [advisor, link] = parts;

    if (advisor !== 'mina' && advisor !== 'mona') {
      await respond({
        text: 'Advisor must be either "mina" or "mona"',
      });
      return;
    }

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data', 'program-info.json');

    const programInfo = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    programInfo.zoomLinks[advisor] = link;
    programInfo.workshopLeads[advisor].zoom = link;

    fs.writeFileSync(filePath, JSON.stringify(programInfo, null, 2));
    rag.reloadData();

    await respond({
      text: `✅ Updated ${advisor}'s zoom link to: ${link}`,
    });

    logger.info('Zoom link updated via admin command', { advisor });
  } catch (error) {
    logger.error('Error updating zoom link', error as Error);
    await respond({
      text: `❌ Error updating zoom link: ${(error as Error).message}`,
    });
  }
});

/**
 * Admin command: Get help
 */
app.command('/admin-help', async ({ command, ack, respond }) => {
  await ack();

  const helpText = `*Admin Commands:*

/admin-update <json> - Update entire program info with JSON
/add-resource <type> <url> <description> - Add a new resource (type: deck, document, spreadsheet)
/update-zoom <mina|mona> <link> - Update advisor zoom link
/admin-help - Show this help message

*User Commands:*

/feedback <your feedback> - Submit feedback about the program or workshop

*Example:*
/add-resource deck https://docs.google.com/presentation/d/xyz "2026 Workshop 1 Deck"
/feedback The workshop was great, but I'd like more time for group discussions`;

  await respond({
    text: helpText,
  });
});

/**
 * User command: Submit feedback
 */
app.command('/feedback', async ({ command, ack, respond }) => {
  await ack();

  const feedback = command.text.trim();

  if (!feedback) {
    await respond({
      text: 'Please provide your feedback. Usage: /feedback <your feedback>',
    });
    return;
  }

  logger.info('Feedback received', { userId: command.user_id, feedback });

  // In production, you might want to:
  // - Store feedback in a database
  // - Send it to a Google Sheet
  // - Email it to the program administrators
  // - Post it to a private feedback channel

  await respond({
    text: `✅ Thank you for your feedback! We've received: "${feedback}"\n\nYour input helps us improve the program for everyone.`,
  });
});

export default app;
