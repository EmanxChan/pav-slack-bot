// 👍 / 👎 feedback on Pavey's answers.
// Slack itself is the record: each answer carries message metadata (asker, question,
// answered?, rating), which the weekly digest reads back. No database needed.
import { slackApi, adminIds, loadProgramData } from './bot-core.js';

const EVENT_TYPE = 'pavey_answer';
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Slack section blocks hold up to 3000 characters; split long answers on paragraph breaks.
function textSections(text) {
  const parts = [];
  let current = '';
  for (const para of text.split('\n\n')) {
    const next = current ? `${current}\n\n${para}` : para;
    if (next.length > 2900 && current) {
      parts.push(current);
      current = para.slice(0, 2900);
    } else {
      current = next.slice(0, 2900);
    }
  }
  if (current) parts.push(current);
  return parts.map((t) => ({ type: 'section', text: { type: 'mrkdwn', text: t } }));
}

function feedbackRow() {
  return {
    type: 'actions',
    block_id: 'pavey_feedback',
    elements: [
      { type: 'button', action_id: 'fb_up', text: { type: 'plain_text', text: '👍 Helpful', emoji: true }, value: 'up' },
      { type: 'button', action_id: 'fb_down', text: { type: 'plain_text', text: '👎 Not quite', emoji: true }, value: 'down' },
    ],
  };
}

function metadata({ userId, question, answered, rating }) {
  return {
    event_type: EVENT_TYPE,
    event_payload: { user: userId, q: clip(question, 400), answered: Boolean(answered), rating: rating || '' },
  };
}

// A "📹 Join" button for each program Teams link mentioned in the answer (up to 3).
export function joinButtons(answer) {
  let sessions = [];
  try {
    sessions = (loadProgramData().curriculum || []).filter((c) => c.joinLink);
  } catch {
    return null;
  }
  const meetingId = (url) => (url.match(/\/meet\/(\d+)/) || [])[1];
  const ids = new Set([...answer.matchAll(/teams\.microsoft\.com\/meet\/(\d+)/g)].map((m) => m[1]));
  const matches = sessions.filter((c) => ids.has(meetingId(c.joinLink))).slice(0, 3);
  if (!matches.length) return null;
  return {
    type: 'actions',
    block_id: 'pavey_join',
    elements: matches.map((c, i) => ({
      type: 'button',
      action_id: `join_${i}`,
      style: 'primary',
      text: { type: 'plain_text', text: clip(`📹 Join ${c.activity.split(':')[0].trim()}`, 75), emoji: true },
      url: c.joinLink,
    })),
  };
}

// The message Pavey posts for an answer: the text, any join buttons, then the feedback buttons.
export function answerMessage({ answer, question, userId, answered }) {
  const join = joinButtons(answer);
  return {
    text: answer, // fallback for notifications and conversation memory
    blocks: JSON.stringify([...textSections(answer), ...(join ? [join] : []), feedbackRow()]),
    metadata: JSON.stringify(metadata({ userId, question, answered })),
  };
}

// Swap the buttons for a thank-you and record the rating on the message.
async function markRated(payload, rating, note) {
  const msg = payload.message || {};
  const blocks = (msg.blocks || []).filter((b) => b.block_id !== 'pavey_feedback');
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: note }] });
  const prev = msg.metadata?.event_payload || {};
  await slackApi('chat.update', {
    channel: payload.channel?.id || payload.container?.channel_id,
    ts: msg.ts || payload.container?.message_ts,
    text: msg.text || ' ',
    blocks: JSON.stringify(blocks),
    metadata: JSON.stringify(metadata({ userId: prev.user, question: prev.q || '', answered: prev.answered, rating })),
  });
}

async function dmAdmins(text, extra = {}) {
  const results = [];
  for (const admin of adminIds()) {
    const { channel } = await slackApi('conversations.open', { users: admin });
    results.push(await slackApi('chat.postMessage', { channel: channel.id, text, ...extra }));
  }
  return results;
}

export async function handleFeedbackAction(payload, action) {
  const userId = payload.user?.id;
  const meta = payload.message?.metadata?.event_payload || {};
  try {
    if (action.action_id === 'fb_up') {
      await markRated(payload, 'up', '👍 Thanks, glad that helped.');
      console.log(`[bot] Feedback 👍 from ${userId}`);
      return;
    }

    // 👎: open the optional comment box first (Slack's trigger expires after ~3 seconds),
    // then mark the message and tell the admins.
    await slackApi('views.open', {
      trigger_id: payload.trigger_id,
      view: JSON.stringify({
        type: 'modal',
        callback_id: 'fb_comment',
        private_metadata: JSON.stringify({ user: userId, q: clip(meta.q || '', 300) }),
        title: { type: 'plain_text', text: 'Help us improve Pavey' },
        submit: { type: 'plain_text', text: 'Send' },
        close: { type: 'plain_text', text: 'Skip' },
        blocks: [
          {
            type: 'input',
            block_id: 'comment',
            optional: true,
            label: { type: 'plain_text', text: 'What was missing or off? (optional)' },
            element: { type: 'plain_text_input', action_id: 'text', multiline: true, max_length: 1000 },
          },
        ],
      }),
    }).catch((err) => console.warn('[bot] Could not open feedback box:', err.message));

    await markRated(payload, 'down', '👎 Thanks for flagging that. The PAV team will take a look.');
    const answer = clip(payload.message?.text || '', 1500);
    await dmAdmins(
      `👎 *Pavey feedback from <@${userId}>*\n\n*They asked:*\n> ${clip(meta.q || '(unknown)', 400).replace(/\n/g, '\n> ')}\n\n*Pavey answered:*\n> ${answer.replace(/\n/g, '\n> ')}`,
    );
    console.log(`[bot] Feedback 👎 from ${userId}`);
  } catch (err) {
    console.error('[bot] Feedback handling failed:', err.message);
  }
}

// The optional comment from the 👎 box, added under the admin report.
export async function handleFeedbackComment(payload) {
  try {
    const comment = payload.view?.state?.values?.comment?.text?.value?.trim();
    if (!comment) return;
    const { user, q } = JSON.parse(payload.view.private_metadata || '{}');
    await dmAdmins(`💬 *<@${user}> added a comment* on “${q || 'their question'}”:\n> ${comment.replace(/\n/g, '\n> ')}`);
  } catch (err) {
    console.error('[bot] Could not record feedback comment:', err.message);
  }
}

export { EVENT_TYPE };
