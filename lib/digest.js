// Weekly digest: reads the metadata on Pavey's answers in its DMs (and DM threads)
// over the last 7 days and sends admins a summary. Needs im:read and im:history.
import { slackApi, adminIds, askMiniMax } from './bot-core.js';
import { EVENT_TYPE } from './feedback.js';

const DAYS = 7;

async function listDmChannels() {
  const ids = [];
  let cursor;
  do {
    const data = await slackApi('users.conversations', { types: 'im', limit: 200, cursor, exclude_archived: true });
    ids.push(...(data.channels || []).map((c) => c.id));
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);
  return ids;
}

async function answersIn(channel, oldest) {
  const found = [];
  const keep = (m) => m.metadata?.event_type === EVENT_TYPE && found.push({ ts: m.ts, ...m.metadata.event_payload });
  const hist = await slackApi('conversations.history', { channel, oldest, limit: 200, include_all_metadata: true });
  for (const m of hist.messages || []) {
    keep(m);
    // Agent chats and threaded replies live under a parent message.
    if (m.reply_count && Number(m.latest_reply || 0) >= Number(oldest)) {
      const rep = await slackApi('conversations.replies', { channel, ts: m.ts, oldest, limit: 200, include_all_metadata: true });
      for (const r of rep.messages || []) if (r.ts !== m.ts) keep(r);
    }
  }
  return found;
}

export async function collectWeek() {
  const oldest = String(Math.floor(Date.now() / 1000) - DAYS * 86400);
  const answers = [];
  for (const channel of await listDmChannels()) {
    try {
      answers.push(...(await answersIn(channel, oldest)));
    } catch (err) {
      console.warn(`[bot] Digest skipped ${channel}:`, err.message);
    }
  }
  const admins = new Set(adminIds());
  return answers.filter((a) => !admins.has(a.user)); // don't count the team's own testing
}

async function themes(questions) {
  if (questions.length < 3) return '';
  try {
    const { text } = await askMiniMax(
      `For the PAV team only: group these founder questions from the past week into the top 3 themes, one short bullet each with a count. No intro.\n\n${questions.map((q) => `- ${q}`).join('\n')}`,
    );
    return text;
  } catch {
    return '';
  }
}

export async function buildDigest() {
  const a = await collectWeek();
  const people = new Set(a.map((x) => x.user)).size;
  const up = a.filter((x) => x.rating === 'up').length;
  const down = a.filter((x) => x.rating === 'down');
  const unanswered = a.filter((x) => x.answered === false);
  const list = (items) => items.slice(0, 10).map((x) => `• <@${x.user}>: _${x.q}_`).join('\n');

  const lines = [
    '📊 *Pavey weekly digest* (last 7 days, PAV team excluded)',
    '',
    `• *${a.length}* question${a.length === 1 ? '' : 's'} from *${people}* founder${people === 1 ? '' : 's'}`,
    `• 👍 *${up}*  ·  👎 *${down.length}*  ·  no rating *${a.length - up - down.length}*`,
    `• ❓ *${unanswered.length}* question${unanswered.length === 1 ? '' : 's'} Pavey couldn’t answer from the program info`,
  ];
  if (down.length) lines.push('', '*👎 Flagged answers*', list(down));
  if (unanswered.length) lines.push('', '*❓ Couldn’t answer (content to add)*', list(unanswered));
  const t = await themes(a.map((x) => x.q).filter(Boolean));
  if (t) lines.push('', '*🧭 What founders asked about most*', t);
  if (!a.length) lines.push('', 'Quiet week. No founder questions yet.');
  lines.push('', '_Reply `!digest` any time for a fresh one, or `!eval` to run the test questions._');
  return lines.join('\n');
}

export async function sendDigest({ to, threadTs } = {}) {
  try {
    const text = await buildDigest();
    if (to) {
      await slackApi('chat.postMessage', { channel: to, thread_ts: threadTs, text });
    } else {
      for (const admin of adminIds()) {
        const { channel } = await slackApi('conversations.open', { users: admin });
        await slackApi('chat.postMessage', { channel: channel.id, text });
      }
    }
    console.log('[bot] Digest sent');
  } catch (err) {
    console.error('[bot] Digest failed:', err.message);
    if (to) await slackApi('chat.postMessage', { channel: to, thread_ts: threadTs, text: `Digest failed: ${err.message}` }).catch(() => {});
  }
}
