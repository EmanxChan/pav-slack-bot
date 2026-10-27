import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const env = (k, d = '') => (process.env[k] || d).trim();

// AGENT_MODE=off restores the classic DM experience (welcome message instead of suggested prompts).
export const agentMode = () => env('AGENT_MODE', 'on').toLowerCase() !== 'off';

// ---------- Program info (whole file is small, so send all of it as context) ----------
// Parsed program data, for the Home tab.
export function loadProgramData() {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'program-info.json'), 'utf8'));
}

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

const SYSTEM_PROMPT = `You are Pavey, the Slack assistant for the Path Ahead Ventures (PAV) Strategic Planning Intensive. You help founders in the program find what they need: dates, sessions, zoom links, deliverables, resources and expectations. Answer only from the program information provided.

## Voice
Write in the PAV voice: human, clear, grounded, founder-centered.
- Talk to founders as capable partners. Respect their experience, judgment and time. Never patronize or treat them as needing rescue.
- Write like a thoughtful person on the PAV team, not an institution. Warm but not overly casual.
- Be encouraging, specific and honest. No hype ("game-changing", "incredible", "next level") and no corporate filler ("leverage", "circle back", "move the needle").
- Use plain language. Explain acronyms the first time.
- Use active voice and concrete verbs. Keep sentences short.
- Never use em dashes.

## Structure: Pyramid Principle (always)
1. Lead with the answer in the first line. The direct answer to what they asked, in one sentence, bolded when it is a key fact (date, time, link).
2. Then the supporting details, grouped logically, as short bullets.
3. End with the next step when there is one: what to do, by when, and where (link). Skip it if there is no real next step.
No preamble ("Great question!", "Sure, I can help"). No recap at the end. Short questions get short answers: a single line is fine.

## Formatting for Slack (Slack mrkdwn, not Markdown)
- Bold with single asterisks: *like this*. Never use **double asterisks** or # headings.
- Bullets with "• " at the start of a line. Keep each bullet to one line where possible.
- Links: write <https://example.com|Short label>. Never paste long raw URLs when a label works.
- Use a blank line between the lead, the details and the next step so it is easy to scan.
- Emojis: use 1 to 3 per reply where they help scanning, as markers at the start of a line, not sprinkled mid-sentence. Good ones: 📅 dates, ⏰ times, 🔗 links, 📝 deliverables/homework, 👥 advisors, 📍 next step, ✅ done/confirmed, 📚 resources. Skip emojis for sensitive topics or one-line answers.
- Avoid stacking exclamation points. At most one per reply.

## Conversation
- Earlier messages in this conversation are included. Use them to understand follow-ups like "what else?" or "tell me more about the second one", and do not repeat what you already said unless asked.

## Dates and timing
- Use today's date (given below) for every answer about schedules, deadlines and "what's next".
- For key dates or schedule questions, list only what is still ahead, starting with the next item. Leave out anything already past unless they ask about it, and if you mention a past item, mark it as done.
- Say "today", "tomorrow" or "this Friday" when it helps, for example "Workshop 1 is tomorrow at 10:00 AM PT".
- Everyone you talk to has already been accepted into the Intensive. Never mention applying, application deadlines or selection.
- If the Intensive is over, say so warmly and point to the follow-ups (dashboard template, survey, advisor check-in).

## Accuracy
- Never invent dates, times, links, names, eligibility rules, outcomes or promises (funding, acceptance, partnerships, REI support).
- If the answer is not in the program information, say so plainly and point them to the PAV team. Use a placeholder like [link] rather than guessing.
- You cannot book or move coaching slots, review or grade plans, give business advice, or grant deadline exceptions. Say so kindly and point them to the right person.
- Route people using the contacts in the program information: plan feedback, coaching questions and workshop content questions go to Mina & Mona (mention them as <@U05SPV4SQ1E> for Mina and <@U05BCQL6PEG> for Mona; if the founder has a core advisor, point to that one). Logistics, links, Slack access and submissions go to Eman (mention him as <@U0C6J5X39NU>). If unsure, point them to Eman.
- Do not discuss internal PAV matters such as budgets, costs to PAV, recruiting or marketing plans, internal success metrics or staffing. If asked, say that is handled by the PAV team.
- If two pieces of program information conflict, mention both and suggest confirming with the PAV team.

## Example (format only. Always fill in real facts from the program information, never these placeholders)
Question: when's the next workshop?
Answer:
📅 *The next workshop is Wednesday, October 28 at [time].*

• Topic: [workshop topic]
• Led by: [lead]
• 🔗 <https://zoom.us/...|Join on Zoom>

📍 *Before then:* finish your pre-work so you can get the most out of the session.`;

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
export async function slackApi(method, body) {
  const token = env('SLACK_BOT_TOKEN');
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set');
  // Form-encoded works for every Slack method; JSON bodies are rejected by read methods
  // like conversations.members (invalid_arguments).
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null && v !== '') form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
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
export async function isChannelMember(userId, channelId) {
  let cursor;
  do {
    const data = await slackApi('conversations.members', { channel: channelId, limit: 1000, cursor });
    if (data.members?.includes(userId)) return true;
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);
  return false;
}

// Optional comma-separated list of user IDs that can always DM the bot (e.g. admins).
// The single access rule for every entry point: allowlisted users, or members of the
// program channel. If SLACK_CHANNEL_ID is missing, nobody else gets in (fail closed).
export async function hasAccess(userId, { channel, isMention } = {}) {
  if (isAllowlisted(userId)) return true;
  const programChannel = env('SLACK_CHANNEL_ID');
  if (!programChannel) {
    console.error('[bot] SLACK_CHANNEL_ID is not set; denying access to everyone except ALLOWED_USER_IDS');
    return false;
  }
  if (isMention && channel === programChannel) return true; // they're posting in the channel itself
  return isChannelMember(userId, programChannel);
}

export function isAllowlisted(userId) {
  return env('ALLOWED_USER_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

// ---------- Conversation memory ----------
// Pulls the recent back-and-forth from Slack itself, so no database is needed.
// DMs use conversations.history (needs im:history); channel threads use
// conversations.replies (needs groups:history / channels:history).
const HISTORY_MESSAGES = 12; // last ~6 exchanges
const HISTORY_MAX_AGE_SEC = 6 * 60 * 60; // ignore anything older than 6 hours
const HISTORY_MAX_CHARS = 2000; // per message, keeps the prompt small

async function getHistory({ isDm, channel, ts, threadTs }) {
  let messages = [];
  try {
    if (threadTs && threadTs !== ts) {
      // Agent chats and channel threads: memory is scoped to the thread.
      const data = await slackApi('conversations.replies', { channel, ts: threadTs, limit: 50 });
      messages = (data.messages || []).slice(-HISTORY_MESSAGES - 1);
    } else if (isDm && !threadTs) {
      const data = await slackApi('conversations.history', { channel, latest: ts, limit: HISTORY_MESSAGES });
      messages = (data.messages || []).reverse(); // API returns newest first
    }
  } catch (err) {
    // Memory is a nice-to-have: answer without it rather than failing.
    console.warn('[bot] Could not load conversation history:', err.message);
    return [];
  }

  const cutoff = Number(ts) - HISTORY_MAX_AGE_SEC;
  return messages
    .filter((m) => m.ts !== ts && Number(m.ts) >= cutoff && m.text && (!m.subtype || m.subtype === 'bot_message'))
    .map((m) => ({
      role: m.bot_id ? 'assistant' : 'user',
      content: m.text.replace(/<@[A-Z0-9]+>/g, '').trim().slice(0, HISTORY_MAX_CHARS),
    }))
    .filter((m) => m.content);
}

// ---------- MiniMax ----------
// Today's date in Pacific Time, so answers move forward with the calendar.
function todayLine() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(now);
  return `Today is ${date}, ${time} Pacific Time. Program dates without a year are in ${env('PROGRAM_YEAR', '2026')}.`;
}

// Who is asking, so answers can be personal ("your advisor is Mona"). Needs users:read.
const nameCache = new Map();
async function getAskerName(userId) {
  if (nameCache.has(userId)) return nameCache.get(userId);
  let name = '';
  try {
    const { user } = await slackApi('users.info', { user: userId });
    name = user?.profile?.real_name || user?.real_name || user?.profile?.display_name || '';
  } catch (err) {
    console.warn('[bot] Could not look up user name:', err.message);
  }
  nameCache.set(userId, name);
  return name;
}

async function askMiniMax(question, history = [], askerName = '') {
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
      // M3.x always reasons first, and reasoning shares this budget. Keep reasoning light
      // (it's a lookup task) and leave plenty of room for the actual answer.
      reasoning_effort: env('MINIMAX_REASONING_EFFORT', 'low'),
      max_completion_tokens: 8000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `Program information (JSON):\n${getProgramInfo()}` },
        { role: 'system', content: todayLine() },
        ...(askerName
          ? [{
              role: 'system',
              content: `The founder you are talking to is ${askerName} (Slack name). If they match someone in the cohort list, use their company and paired advisor to personalize answers (for example, "your advisor is Mona"). If you are not sure they are in the cohort, answer generally and do not guess.`,
            }]
          : []),
        ...history,
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
  const choice = data.choices?.[0];
  console.log(`[bot] MiniMax finish=${choice?.finish_reason} usage=${JSON.stringify(data.usage || {})}`);
  let content = choice?.message?.content;
  if (choice?.finish_reason === 'length') {
    console.warn('[bot] MiniMax reply hit the token limit and was cut off');
  }
  if (!content) throw new Error(`MiniMax response had no content: ${text.slice(0, 500)}`);
  // Reasoning models wrap their thinking in <think> tags; don't send that to Slack.
  content = toSlackFormat(content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim());
  return content || "Sorry, I couldn't come up with an answer to that.";
}

// Safety net: convert common Markdown the model might emit into Slack mrkdwn.
export function toSlackFormat(text) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<$2|$1>') // [label](url) -> <url|label>
    .replace(/\*\*(.+?)\*\*/g, '*$1*') // **bold** -> *bold*
    .replace(/__(.+?)__/g, '*$1*') // __bold__ -> *bold*
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*') // # Heading -> *Heading*
    .replace(/^(\s*)[-*]\s+/gm, '$1• ') // - item / * item -> • item
    .replace(/\s*—\s*/g, ', ') // no em dashes
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- Introductions ----------
const INTRO_MESSAGE = [
  "👋 *Hi, I'm Pavey, the Strategic Planning Intensive assistant from Path Ahead Ventures.*",
  '',
  'I can help with program details, any time:',
  '• 📅 Dates, sessions and deadlines',
  '• 🔗 Zoom links and advisor coaching sign-ups',
  '• 📝 Homework and deliverables',
  '• 📚 Decks and resources',
  '',
  "📍 *To ask me something:* @mention me here, or DM me directly. I'll reply in a thread so the conversation stays tidy.",
].join('\n');

let botUserId = null;
async function getBotUserId() {
  if (!botUserId) botUserId = (await slackApi('auth.test', {})).user_id;
  return botUserId;
}

// When the bot is added to a channel or group DM, introduce itself once.
async function handleMemberJoined(event) {
  try {
    if (event.user !== (await getBotUserId())) return;
    console.log(`[bot] Added to ${event.channel}; posting introduction`);
    await slackApi('chat.postMessage', { channel: event.channel, text: INTRO_MESSAGE });
  } catch (err) {
    console.error('[bot] Could not post introduction:', err.message);
  }
}

// ---------- Event handling ----------
export async function handleEvent(event, ctx = {}) {
  if (event.type === 'member_joined_channel') return handleMemberJoined(event);
  if (event.type === 'assistant_thread_started') {
    const { startAgentChat } = await import('./agent.js');
    return startAgentChat(event.assistant_thread || {});
  }
  if (event.type === 'assistant_thread_context_changed') return; // nothing to do
  if (event.type === 'app_home_opened') {
    const { publishHome, maybeWelcome } = await import('./home.js');
    // With the agent experience on, new chats get suggested prompts instead of the welcome.
    if (event.tab === 'messages') return agentMode() ? undefined : maybeWelcome(event.user, event.channel);
    if (event.tab === 'home') return publishHome(event.user, ctx);
    return;
  }

  // Ignore bot messages, edits, joins, etc.
  if (event.bot_id || event.subtype) return;

  const isDm = event.type === 'message' && event.channel_type === 'im';
  const isMention = event.type === 'app_mention';
  if (!isDm && !isMention) return;

  const userId = event.user;
  const channel = event.channel;
  const question = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  const threadTs = isMention ? event.thread_ts || event.ts : event.thread_ts; // DMs: reply in the agent chat thread, if any
  console.log(`[bot] ${isDm ? 'DM' : 'mention'} from ${userId}: ${question}`);

  const reply = (text) => slackApi('chat.postMessage', { channel, text, thread_ts: threadTs });

  try {
    if (!question) {
      await reply('👋 *Hi, I\'m Pavey, your Strategic Planning Intensive assistant.*\n\nAsk me about:\n• 📅 Dates and sessions\n• 🔗 Zoom links\n• 📝 Deliverables and homework\n• 📚 Resources and decks');
      return;
    }

    // Access control: only members of the program channel (or allowlisted users).
    let member = false;
    try {
      member = await hasAccess(userId, { channel, isMention });
    } catch (err) {
      console.error('[bot] Membership check failed:', err.message);
      await reply('*I couldn\'t verify your access right now.*\n\n📍 Please reach out to the PAV team so we can get you sorted.');
      return;
    }
    // @mentions only get answered where non-members can't read along: the program channel or a group DM.
    if (member && isMention && channel !== env('SLACK_CHANNEL_ID')) {
      let isGroupDm = false;
      try {
        isGroupDm = Boolean((await slackApi('conversations.info', { channel })).channel?.is_mpim);
      } catch (err) {
        console.warn('[bot] Could not check conversation type:', err.message);
      }
      if (!isGroupDm) {
        console.log(`[bot] Mention in ${channel} is outside the program channel; redirecting`);
        await reply('*I only answer in the Strategic Planning Intensive channel or in a direct message.*\n\n📍 DM me and I’ll help you there.');
        return;
      }
    }
    if (!member) {
      console.log(`[bot] ${userId} does not have access; declining`);
      await reply('*This assistant is for founders in the Strategic Planning Intensive.*\n\n📍 If you\'re in the program and seeing this, reach out to the PAV team and we\'ll get you access.');
      return;
    }

    const isAgentChat = isDm && Boolean(event.thread_ts);
    if (isAgentChat) {
      const { setThinking } = await import('./agent.js');
      await setThinking(channel, event.thread_ts);
    }
    const history = await getHistory({ isDm, channel, ts: event.ts, threadTs: event.thread_ts });
    if (isAgentChat && !history.some((m) => m.role === 'user')) {
      const { setChatTitle } = await import('./agent.js');
      await setChatTitle(channel, event.thread_ts, question);
    }
    if (history.length) console.log(`[bot] Using ${history.length} earlier messages as context`);
    const answer = await askMiniMax(question, history, await getAskerName(userId));
    await reply(answer);
    console.log(`[bot] Replied to ${userId} (${answer.length} chars)`);
  } catch (err) {
    console.error('[bot] Error handling message:', err.message);
    try {
      await reply('*Something went wrong on my end.*\n\n📍 Please try again in a minute. If it keeps happening, let the PAV team know.');
    } catch (err2) {
      console.error('[bot] Could not even send the error reply:', err2.message);
    }
  }
}
