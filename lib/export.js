// Admin-only `!export`: sends the admin a text file of every message in the program
// channel (oldest first, thread replies indented under their parent).
// Needs groups:history (private channel) and users:read. The file upload needs files:write;
// without it, the export comes back as plain messages instead.
import { slackApi } from './bot-core.js';

const env = (k, d = '') => (process.env[k] || d).trim();
const TZ = 'America/Los_Angeles';

const stamp = (ts) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(Number(ts) * 1000)) + ' PT';

async function allPages(method, params, key) {
  const out = [];
  let cursor;
  do {
    const data = await slackApi(method, { ...params, limit: 200, cursor });
    out.push(...(data[key] || []));
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);
  return out;
}

export async function buildChannelExport(channel) {
  const names = new Map();
  const nameOf = async (m) => {
    if (m.user_profile?.real_name) return m.user_profile.real_name;
    if (!m.user) return m.username || m.bot_profile?.name || 'App';
    if (!names.has(m.user)) {
      try {
        const u = (await slackApi('users.info', { user: m.user })).user;
        names.set(m.user, u.real_name || u.profile?.real_name || u.name);
      } catch {
        names.set(m.user, m.user);
      }
    }
    return names.get(m.user);
  };
  // Replace <@U123> mentions with names so the file reads cleanly.
  const clean = async (text = '') => {
    let out = text;
    for (const id of new Set([...text.matchAll(/<@([A-Z0-9]+)>/g)].map((x) => x[1]))) {
      out = out.split(`<@${id}>`).join(`@${await nameOf({ user: id })}`);
    }
    return out.replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2 ($1)').replace(/<(https?:[^>]+)>/g, '$1');
  };
  const files = (m) => (m.files || []).map((f) => `[file: ${f.name || f.title}]`).join(' ');

  const info = await slackApi('conversations.info', { channel });
  const top = (await allPages('conversations.history', { channel }, 'messages')).reverse();
  const lines = [`#${info.channel?.name || channel}: channel export, ${top.length} messages, exported ${stamp(Date.now() / 1000)}`, ''];

  for (const m of top) {
    if (m.subtype === 'channel_join' || m.subtype === 'channel_leave') continue;
    lines.push(`[${stamp(m.ts)}] ${await nameOf(m)}: ${await clean(m.text)} ${files(m)}`.trim());
    if (m.reply_count) {
      const replies = await allPages('conversations.replies', { channel, ts: m.ts }, 'messages');
      for (const r of replies.slice(1)) {
        lines.push(`    ↳ [${stamp(r.ts)}] ${await nameOf(r)}: ${await clean(r.text)} ${files(r)}`.trimEnd());
      }
    }
    lines.push('');
  }
  return { name: info.channel?.name || 'channel', text: lines.join('\n') };
}

async function uploadFile(to, threadTs, filename, content) {
  const bytes = Buffer.from(content, 'utf8');
  const { upload_url, file_id } = await slackApi('files.getUploadURLExternal', { filename, length: bytes.length });
  const res = await fetch(upload_url, { method: 'POST', body: bytes });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  await slackApi('files.completeUploadExternal', {
    files: [{ id: file_id, title: filename }],
    channel_id: to,
    thread_ts: threadTs,
    initial_comment: '📦 Here’s the full channel export. Attach this file wherever you need it.',
  });
}

export async function exportCommand({ to, threadTs }) {
  const say = (text) => slackApi('chat.postMessage', { channel: to, thread_ts: threadTs, text });
  const channel = env('SLACK_CHANNEL_ID');
  if (!channel) return say('SLACK_CHANNEL_ID is not set, so there is no channel to export.');
  await say('📦 Exporting the program channel. This can take a minute…');
  let exp;
  try {
    exp = await buildChannelExport(channel);
  } catch (err) {
    console.error('[bot] Export failed:', err.message);
    return say(`Export failed: ${err.message}\nIf it names a missing scope, add it under OAuth & Permissions in the Slack app settings, reinstall the app, and try again.`);
  }
  const filename = `${exp.name}-export-${new Date().toISOString().slice(0, 10)}.txt`;
  try {
    await uploadFile(to, threadTs, filename, exp.text);
    console.log(`[bot] Export uploaded (${exp.text.length} chars)`);
  } catch (err) {
    // No files:write: send it as messages instead (Slack caps a message at about 40K characters).
    console.error('[bot] Export upload failed, sending as messages:', err.message);
    const chunks = [];
    let cur = '';
    for (const line of exp.text.split('\n')) {
      if (cur.length + line.length + 1 > 3500) { chunks.push(cur); cur = ''; }
      cur += `${line}\n`;
    }
    if (cur) chunks.push(cur);
    await say(`Couldn’t attach a file (${err.message}), so here’s the export in ${chunks.length} messages. To get a file next time, add the files:write scope and reinstall the app.`);
    for (const c of chunks) await say('```' + c + '```');
  }
}
