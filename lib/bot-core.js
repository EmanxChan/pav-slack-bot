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

## Screenshots
- If the founder shares a screenshot, read it and help with what it shows, using the program information. If it is unrelated to the Intensive, say what you see briefly and steer back to how you can help.

## Join details
- Put meeting IDs and passcodes in inline code so they are easy to copy, for example: Meeting ID: \`261 891 046 965 347\` · Passcode: \`xk2iv9Et\`.
- Include the Teams link as a labeled link. A "Join" button is added below your answer automatically.

## Language
- Reply in the language the founder writes in. Keep names, links, IDs and passcodes exactly as they are.

## Workshop recaps
- When someone asks what was covered, missed a session, or asks about a concept (mission, altitude, defining choices, initiatives, priorities), answer from the workshop recap in the program information.
- Never share what an individual founder said about their own business, numbers or plans in a session. Talk about concepts, examples like Lumi, and next steps only.
- Share a session's recording link when they ask for it or missed the session. If a recording link is not available yet, say it is coming soon.

## Unanswered questions
- If the program information does not contain what they asked for, say so as usual, and end your reply with the tag [[NO_INFO]] on its own line. The tag is removed before they see it. Do not add it when you did answer.

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
• 🔗 <https://teams.microsoft.com/meet/...|Join on Teams>

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

// Admins get feedback reports, the weekly digest and the ! commands.
export function adminIds() {
  const ids = [env('HOME_CONTACT_USER_ID', 'U0C6J5X39NU'), ...env('ADMIN_USER_IDS').split(',')];
  return [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
}
export const isAdmin = (userId) => adminIds().includes(userId);

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
    .filter((m) => m.ts !== ts && Number(m.ts) >= cutoff && Number(m.ts) < Number(ts) && m.text && (!m.subtype || m.subtype === 'bot_message'))
    .map((m) => ({
      role: m.bot_id ? 'assistant' : 'user',
      content: m.text.replace(/<@[A-Z0-9]+>/g, '').trim().slice(0, HISTORY_MAX_CHARS),
    }))
    .filter((m) => m.content);
}

// ---------- MiniMax ----------
// Screenshots: download from Slack (needs files:read) and pass to MiniMax as data URLs.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
async function loadImages(files) {
  const out = [];
  for (const f of files.slice(0, 2)) {
    try {
      if (f.size > MAX_IMAGE_BYTES) {
        console.warn(`[bot] Skipping large image ${f.id} (${f.size} bytes)`);
        continue;
      }
      const res = await fetch(f.url_private_download || f.url_private, {
        headers: { Authorization: `Bearer ${env('SLACK_BOT_TOKEN')}` },
      });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type} (is files:read added?)`);
      const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
      out.push(`data:${type.split(';')[0]};base64,${b64}`);
    } catch (err) {
      console.warn(`[bot] Could not load image ${f.id}:`, err.message);
    }
  }
  if (files.length) console.log(`[bot] Loaded ${out.length}/${files.length} screenshot(s)`);
  return out;
}

// Today's date in Pacific Time, so answers move forward with the calendar.
function todayLine() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(now);
  return `Today is ${date}, ${time} Pacific Time. Program dates without a year are in ${env('PROGRAM_YEAR', '2026')}.`;
}

// Who is asking, so answers can be personal ("your advisor is Mona"). Needs users:read.
const askerCache = new Map();
async function getAsker(userId) {
  if (askerCache.has(userId)) return askerCache.get(userId);
  let asker = { name: '', tz: '' };
  try {
    const { user } = await slackApi('users.info', { user: userId });
    asker = {
      name: user?.profile?.real_name || user?.real_name || user?.profile?.display_name || '',
      tz: user?.tz || '',
    };
  } catch (err) {
    console.warn('[bot] Could not look up user:', err.message);
  }
  askerCache.set(userId, asker);
  return asker;
}

// "3 hours ahead of Pacific Time (EDT)" style hint, or '' if they're on Pacific Time.
function offsetMinutes(tz, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - at.getTime()) / 60000;
}
export function timeZoneHint(tz) {
  if (!tz) return '';
  try {
    const now = new Date();
    const diff = Math.round((offsetMinutes(tz, now) - offsetMinutes('America/Los_Angeles', now)) / 15) * 15;
    if (Math.abs(diff) < 1) return '';
    const abbr = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || tz;
    const hours = Math.abs(diff) / 60;
    const amount = Number.isInteger(hours) ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours} hours`;
    return `The founder's Slack time zone is ${tz} (${abbr}), ${amount} ${diff > 0 ? 'ahead of' : 'behind'} Pacific Time. Program times are in PT. Whenever you give a session time, also give their local time once, for example "10:00 AM PT (1:00 PM ${abbr})". Double-check the math.`;
  } catch {
    return '';
  }
}

export async function askMiniMax(question, history = [], asker = '', images = []) {
  const { name: askerName = '', tz = '' } = typeof asker === 'string' ? { name: asker } : asker || {};
  const tzHint = timeZoneHint(tz);
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
        ...(tzHint ? [{ role: 'system', content: tzHint }] : []),
        ...history,
        {
          role: 'user',
          content: images.length
            ? [{ type: 'text', text: question }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
            : question,
        },
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
  content = content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  // The model tags answers it couldn't find in the program info, so they show up in the digest.
  const answered = !/\[\[NO_INFO\]\]/.test(content);
  content = toSlackFormat(content.replace(/\s*\[\[NO_INFO\]\]\s*/g, ' ').trim());
  return { text: content || "Sorry, I couldn't come up with an answer to that.", answered };
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
  '• 🔗 Session links and advisor coaching sign-ups',
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

// ---------- Error alerts ----------
// DMs admins when something breaks, at most once per 10 minutes per kind of error.
const lastAlert = new Map();
export async function alertAdmins(what, err) {
  try {
    const key = String(err?.message || err).slice(0, 80);
    if (Date.now() - (lastAlert.get(key) || 0) < 10 * 60 * 1000) return;
    lastAlert.set(key, Date.now());
    for (const admin of adminIds()) {
      const { channel } = await slackApi('conversations.open', { users: admin });
      await slackApi('chat.postMessage', {
        channel: channel.id,
        text: `🚨 *Pavey hit an error* while ${what}\n\n\`${String(err?.message || err).slice(0, 500)}\`\n\n_The founder saw a “something went wrong” message. Similar errors are muted for 10 minutes._`,
      });
    }
  } catch (e) {
    console.error('[bot] Could not send error alert:', e.message);
  }
}

// ---------- Greetings ----------
const GREETING = /^(hi+|hey+|hello+|hiya|howdy|yo|sup|what'?s up|good (morning|afternoon|evening)|hola|buenos d[ií]as|thanks?( you)?|thank you|ty)[\s!?.,:)]*(pavey)?[\s!?.,:)]*$/i;

const THANKS = /^(thanks?|thank you|ty)\b/i;

function greetingText(userId) {
  let next = '';
  try {
    const { upcomingSessions } = HOME_HELPERS;
    const s = upcomingSessions?.(loadProgramData(), 1)?.[0];
    if (s) next = `\n\n📅 *Up next:* ${s.activity}, ${s.startText}${s.time ? ` at ${s.time}` : ''}`;
  } catch {}
  return `👋 *Hi <@${userId}>, I’m Pavey.* Ask me anything about the Strategic Planning Intensive, like:\n• _What do I need to do before the next session?_\n• _How do I join Workshop 1?_\n• _Who is my advisor, and how do I book coaching?_${next}`;
}
let HOME_HELPERS = {};
import('./home.js').then((m) => (HOME_HELPERS = m)).catch(() => {});

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

  // Ignore bot messages, edits, joins, etc. (but keep messages with an attached screenshot)
  if (event.bot_id || (event.subtype && event.subtype !== 'file_share')) return;

  const isDm = event.type === 'message' && event.channel_type === 'im';
  const isMention = event.type === 'app_mention';
  if (!isDm && !isMention) return;

  const userId = event.user;
  const channel = event.channel;
  const imageFiles = (event.files || []).filter((f) => /^image\/(png|jpe?g|gif|webp)$/i.test(f.mimetype || ''));
  const typed = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  const question =
    typed || (imageFiles.length ? 'Here is a screenshot. What is it, and how does it relate to the Intensive? Help me with whatever it shows.' : '');
  const threadTs = isMention ? event.thread_ts || event.ts : event.thread_ts; // DMs: reply in the agent chat thread, if any
  console.log(`[bot] ${isDm ? 'DM' : 'mention'} from ${userId}: ${question}`);

  // In regular DMs and mentions, Pavey posts "looking that up" right away and then swaps in the answer.
  let placeholderTs = null;
  const reply = (text) =>
    placeholderTs
      ? slackApi('chat.update', { channel, ts: placeholderTs, text, blocks: '[]' })
      : slackApi('chat.postMessage', { channel, text, thread_ts: threadTs });

  try {
    if (isDm && /^!(digest|eval|help|reminders|schedule-reminders|cancel-reminders)$/i.test(question) && isAdmin(userId)) {
      const cmd = question.slice(1).toLowerCase();
      if (cmd === 'digest') {
        const { sendDigest } = await import('./digest.js');
        return sendDigest({ to: channel, threadTs });
      }
      if (cmd.includes('reminders')) {
        const { remindersCommand } = await import('./reminders.js');
        return remindersCommand(cmd, { to: channel, threadTs });
      }
      if (cmd === 'eval') {
        const { runEval } = await import('./eval.js');
        return runEval({ to: channel, threadTs });
      }
      return reply('*Admin commands*\n• `!digest`: this week’s usage and feedback\n• `!eval`: run the test questions and check Pavey’s answers\n• `!reminders`: preview the 15-minute session reminders for the channel\n• `!schedule-reminders` / `!cancel-reminders`: queue or clear them');
    }

    const isGreeting = !question || GREETING.test(question);

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

    if (isGreeting && !imageFiles.length) {
      await reply(THANKS.test(question) ? '🙌 Anytime! Ask me whenever something comes up.' : greetingText(userId));
      console.log(`[bot] Greeted ${userId}`);
      return;
    }

    const isAgentChat = isDm && Boolean(event.thread_ts);
    if (isAgentChat) {
      const { setThinking } = await import('./agent.js');
      await setThinking(channel, event.thread_ts, imageFiles.length ? 'is reading your screenshot…' : undefined);
    } else {
      const note = imageFiles.length ? '🔎 _Reading your screenshot…_' : '⏳ _Looking that up…_';
      placeholderTs = (await slackApi('chat.postMessage', { channel, text: note, thread_ts: threadTs })).ts;
    }
    const images = await loadImages(imageFiles);
    const history = await getHistory({ isDm, channel, ts: event.ts, threadTs: event.thread_ts });
    if (isAgentChat && !history.some((m) => m.role === 'user')) {
      const { setChatTitle } = await import('./agent.js');
      await setChatTitle(channel, event.thread_ts, question);
    }
    if (history.length) console.log(`[bot] Using ${history.length} earlier messages as context`);
    let result;
    try {
      result = await askMiniMax(question, history, await getAsker(userId), images);
    } catch (err) {
      if (!images.length) throw err;
      console.warn('[bot] Image answer failed, retrying without the image:', err.message);
      if (!typed) {
        await reply("*I couldn't read that screenshot.*\n\n📍 Could you type your question instead? I'm happy to help.");
        return;
      }
      result = await askMiniMax(question, history, await getAsker(userId));
    }
    const { text: answer, answered } = result;
    const { answerMessage } = await import('./feedback.js');
    const msg = answerMessage({ answer, question: typed || '(screenshot)', userId, answered });
    if (placeholderTs) await slackApi('chat.update', { channel, ts: placeholderTs, ...msg });
    else await slackApi('chat.postMessage', { channel, thread_ts: threadTs, ...msg });
    console.log(`[bot] Replied to ${userId} (${answer.length} chars, answered=${answered})`);
  } catch (err) {
    console.error('[bot] Error handling message:', err.message);
    alertAdmins(`answering <@${userId}>: “${question.slice(0, 200)}”`, err);
    try {
      await reply('*Something went wrong on my end.*\n\n📍 Please try again in a minute. If it keeps happening, let the PAV team know.');
    } catch (err2) {
      console.error('[bot] Could not even send the error reply:', err2.message);
    }
  }
}
