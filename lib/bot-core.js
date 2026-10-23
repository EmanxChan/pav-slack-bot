import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const env = (k, d = '') => (process.env[k] || d).trim();

// ---------- Program info (whole file is small, so send all of it as context) ----------
let programInfoText = null;
function getProgramInfo() {
  if (programInfoText === null) {
    try {
      const raw = readFileSync(path.join(process.cwd(), 'data', 'program-info.json'), 'utf8');
      programInfoText = JSON.stringify(JSON.parse(raw));
    } catch (err) {
      console.error('[bot] Could not load data/program-info.json:', err.message);
      programInfoText = '';
    }
  }
  return programInfoText;
}

const SYSTEM_PROMPT = `You are the assistant for the Path Ahead Ventures Strategic Planning Sprint program. Answer questions from founders and participants using only the program information provided.

Guidelines:
- Give specific dates, times, zoom links and resource links when asked.
- Be concise, friendly and encouraging.
- If the answer is not in the program information, say so and suggest contacting the PAV team. Do not make things up.
- Format for Slack: use *bold* (single asterisks), plain bullet lines, and paste links as-is.`;

// ---------- Slack signature verification ----------
export function verifySlackSignature(rawBody, headers) {
  const secret = env('SLACK_SIGNING_SECRET');
  if (!secret) {
    console.error('[bot] SLACK_SIGNING_SECRET is not set; rejecting request');
    return false;
  }
  const ts = headers.get('x-slack-request-timestamp');
  const sig = headers.get('x-slack-signature');
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) {
    console.warn('[bot] Slack request timestamp too old');
    return false;
  }
  const expected =
    'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Slack Web API ----------
async function slackApi(method, body) {
  const token = env('SLACK_BOT_TOKEN');
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set');
  // Form-encoded works for every Slack method; JSON bodies are rejected by read methods
  // like conversations.members (invalid_arguments).
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await res.json();
  if (!data.ok) {
    const extra = data.needed ? ` (needed scope: ${data.needed})` : '';
    throw new Error(`Slack ${method} failed: ${data.error}${extra}`);
  }
  return data;
}

// Paginated membership check. Needs groups:read (private channel) or channels:read (public).
async function isChannelMember(userId, channelId) {
  let cursor;
  do {
    const data = await slackApi('conversations.members', { channel: channelId, limit: 1000, cursor });
    if (data.members?.includes(userId)) return true;
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);
  return false;
}

// Optional comma-separated list of user IDs that can always DM the bot (e.g. admins).
function isAllowlisted(userId) {
  return env('ALLOWED_USER_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

// ---------- MiniMax ----------
async function askMiniMax(question) {
  const apiKey = env('MINIMAX_API_KEY');
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not set');
  const baseUrl = env('MINIMAX_API_URL', 'https://api.minimax.io/v1').replace(/\/+$/, '');
  const model = env('MINIMAX_MODEL', 'MiniMax-M3.1-Flash');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_completion_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `Program information (JSON):\n${getProgramInfo()}` },
        { role: 'user', content: question },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`MiniMax returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok || data.base_resp?.status_code) {
    throw new Error(`MiniMax error (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`MiniMax response had no content: ${text.slice(0, 500)}`);
  // Reasoning models wrap their thinking in <think> tags; don't send that to Slack.
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return content || "Sorry, I couldn't come up with an answer to that.";
}

// ---------- Event handling ----------
export async function handleEvent(event) {
  // Ignore bot messages, edits, joins, etc.
  if (event.bot_id || event.subtype) return;

  const isDm = event.type === 'message' && event.channel_type === 'im';
  const isMention = event.type === 'app_mention';
  if (!isDm && !isMention) return;

  const userId = event.user;
  const channel = event.channel;
  const question = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  const threadTs = isMention ? event.thread_ts || event.ts : undefined;
  console.log(`[bot] ${isDm ? 'DM' : 'mention'} from ${userId}: ${question}`);

  const reply = (text) => slackApi('chat.postMessage', { channel, text, thread_ts: threadTs });

  try {
    if (!question) {
      await reply('Hi! Ask me anything about the Strategic Planning Sprint: dates, zoom links, deliverables, resources.');
      return;
    }

    // Access control: only members of the program channel (or allowlisted users).
    const programChannel = env('SLACK_CHANNEL_ID');
    if (programChannel && !isAllowlisted(userId)) {
      let member = false;
      try {
        member = isMention && channel === programChannel ? true : await isChannelMember(userId, programChannel);
      } catch (err) {
        console.error('[bot] Membership check failed:', err.message);
        await reply("I couldn't verify your access right now. Please let the program admin know.");
        return;
      }
      if (!member) {
        console.log(`[bot] ${userId} is not in ${programChannel}; declining`);
        await reply('Sorry, I can only help members of the Strategic Planning Sprint channel. If you should have access, please contact the program admin.');
        return;
      }
    }

    const answer = await askMiniMax(question);
    await reply(answer);
    console.log(`[bot] Replied to ${userId} (${answer.length} chars)`);
  } catch (err) {
    console.error('[bot] Error handling message:', err.message);
    try {
      await reply('Sorry, something went wrong on my end. Please try again in a minute.');
    } catch (err2) {
      console.error('[bot] Could not even send the error reply:', err2.message);
    }
  }
}
