import { waitUntil } from '@vercel/functions';
import { verifySlackSignature, handleEvent, slackApi } from '../../lib/bot-core.js';
import { handleFeedbackAction, handleFeedbackComment } from '../../lib/feedback.js';

export const maxDuration = 60;

// Handles button taps from the Home tab.
// Slack app setting: Interactivity & Shortcuts -> Request URL = https://<your-app>/api/slack/interactions
export async function POST(request) {
  const rawBody = await request.text();
  if (!verifySlackSignature(rawBody, request.headers)) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(new URLSearchParams(rawBody).get('payload'));
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (payload?.type === 'block_actions') {
    const action = payload.actions?.[0];
    const userId = payload.user?.id;
    // "Ask me a question" is a link button; Slack opens Messages on its own.
    if (action?.action_id?.startsWith('ask_') && action.value && userId) {
      waitUntil(answerInMessages(userId, action.value));
    }
    if (action?.action_id === 'fb_up' || action?.action_id === 'fb_down') {
      // views.open needs the trigger_id within 3 seconds, so start right away.
      waitUntil(handleFeedbackAction(payload, action));
    }
  }

  if (payload?.type === 'view_submission' && payload.view?.callback_id === 'fb_comment') {
    waitUntil(handleFeedbackComment(payload));
  }

  // Slack needs an empty 200 within 3 seconds.
  return new Response('', { status: 200 });
}

async function answerInMessages(userId, question) {
  try {
    const { channel } = await slackApi('conversations.open', { users: userId });
    await slackApi('chat.postMessage', { channel: channel.id, text: `💬 _You asked:_ *${question}*` });
    // Reuse the normal DM flow: same access check, memory and voice.
    await handleEvent({
      type: 'message',
      channel_type: 'im',
      user: userId,
      channel: channel.id,
      text: question,
      ts: (Date.now() / 1000).toFixed(6),
    });
  } catch (err) {
    console.error('[bot] Quick answer failed:', err.message);
  }
}
