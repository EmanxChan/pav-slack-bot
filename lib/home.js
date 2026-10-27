import { slackApi, hasAccess, loadProgramData } from './bot-core.js';

const env = (k, d = '') => (process.env[k] || d).trim();
const TZ = 'America/Los_Angeles';

// Questions offered as one-tap buttons. Tapping one makes the bot answer in Messages.
export const QUICK_QUESTIONS = [
  { label: '📅 What’s next?', question: 'What is the next session, and how do I join it?' },
  { label: '📝 My homework', question: 'What homework is due before the next session?' },
  { label: '👥 Book coaching', question: 'How do I book advisor coaching, and what times are open?' },
  { label: '🗓️ Key dates', question: 'What are the key dates and deadlines for the program?' },
];

// ---------- Dates ----------
// Curriculum dates look like "Wednesday, October 28" or "Friday, October 30 - Tuesday, November 3".
function toIsoDate(text, year) {
  const d = new Date(`${text.replace(/^[A-Za-z]+,\s*/, '')}, ${year} 12:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
}

function shortDate(text) {
  // "Wednesday, October 28" -> "Wed, Oct 28"
  const m = text.match(/^([A-Za-z]{3})[a-z]*,\s*([A-Za-z]{3})[a-z]*\s+(\d+)/);
  return m ? `${m[1]}, ${m[2]} ${m[3]}` : text;
}

export function upcomingSessions(data, limit = 3) {
  const year = env('PROGRAM_YEAR', '2026');
  const today = todayIso();
  return (data.curriculum || [])
    .map((item) => {
      const [startText, endText] = item.date.split(/\s+-\s+/);
      return { ...item, start: toIsoDate(startText, year), end: toIsoDate(endText || startText, year), startText, endText };
    })
    .filter((item) => item.end && item.end >= today)
    .filter((item) => !/^independent work/i.test(item.activity))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

// ---------- View ----------
const divider = { type: 'divider' };
const header = (text) => ({ type: 'header', text: { type: 'plain_text', text, emoji: true } });
const section = (text, accessory) => ({ type: 'section', text: { type: 'mrkdwn', text }, ...(accessory && { accessory }) });
const context = (text) => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });

function messagesUrl({ teamId, appId }) {
  return teamId && appId
    ? `https://slack.com/app_redirect?app=${appId}&team=${teamId}`
    : 'https://slack.com/app_redirect';
}

function contactLine() {
  const contact = env('HOME_CONTACT_USER_ID', 'U0C6J5X39NU');
  return `🙋 *Need a person?* Message <@${contact}> on the PAV team.`;
}

function sessionBlocksFor(data) {
  const sessions = upcomingSessions(data);
  return sessions.length
    ? sessions.map((s) => {
        const when = s.endText ? `${shortDate(s.startText)} to ${shortDate(s.endText)}` : shortDate(s.startText);
        const time = s.time ? `  ·  ${s.time}` : '';
        return section(`*${when}${time}*\n${s.activity}`);
      })
    : [section('The Intensive has wrapped. Thank you for being part of it.')];
}

// Welcome posted in Messages the first time someone opens it. Same content as Home,
// so it works even with the Home tab turned off.
export function buildWelcomeBlocks(userId, data) {
  const contact = env('HOME_CONTACT_USER_ID', 'U0C6J5X39NU');
  return [
    section(
      `👋 *Hi <@${userId}>, I’m Pavey.*\nI’m here to help you find what you need for the Path Ahead Ventures Strategic Planning Intensive, whenever you need it.`,
    ),
    section(
      '*Just type a question below, like:*\n• _When is Workshop 1, and how do I join?_\n• _What should I finish before the peer feedback session?_\n• _What times can I book coaching with Mina?_',
    ),
    context('I remember our conversation, so you can ask follow-ups like “what else?”'),
    divider,
    header('📅 Coming up'),
    ...sessionBlocksFor(data),
    divider,
    section('⚡ *Or tap a quick answer*'),
    {
      type: 'actions',
      elements: QUICK_QUESTIONS.map((q, i) => ({
        type: 'button',
        action_id: `ask_${i}`,
        text: { type: 'plain_text', text: q.label, emoji: true },
        value: q.question,
      })),
    },
    divider,
    context(
      `🙋 *Need a person?* For plan feedback, coaching and workshop content, reach out to <@U05SPV4SQ1E> or <@U05BCQL6PEG>. For logistics, links and Slack access, message <@${contact}>.`,
    ),
  ];
}

export function buildMemberHome(userId, data, ctx = {}) {
  const res = data.resources || {};
  
  const sessionBlocks = sessionBlocksFor(data);

  const links = [];
  if (res.spreadsheets?.advisorCoachingSignup) {
    links.push(`• <${res.spreadsheets.advisorCoachingSignup}|Advisor coaching sign-up sheet>`);
  }

  return {
    type: 'home',
    blocks: [
      header('🏔️ Strategic Planning Intensive'),
      section(
        `Hi <@${userId}>, I’m your assistant for the Path Ahead Ventures Strategic Planning Intensive. Ask me about dates, session links, homework and resources, any time.`,
      ),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'open_messages',
            text: { type: 'plain_text', text: '💬 Ask me a question', emoji: true },
            style: 'primary',
            url: messagesUrl(ctx),
          },
        ],
      },
      context('Chatting happens in the *Messages* tab above. I remember our conversation, so follow-up questions work.'),
      divider,
      header('📅 Coming up'),
      ...sessionBlocks,
      divider,
      header('⚡ Quick answers'),
      context('Tap a question and I’ll take you to Messages with the answer.'),
      {
        type: 'actions',
        elements: QUICK_QUESTIONS.map((q, i) => ({
          type: 'button',
          action_id: `ask_${i}`,
          text: { type: 'plain_text', text: q.label, emoji: true },
          value: q.question,
          url: messagesUrl(ctx), // opens Messages; Slack still sends us the tap so we can answer
        })),
      },
      ...(links.length ? [divider, header('🔗 Quick links'), section(links.join('\n'))] : []),
      divider,
      context(contactLine()),
    ],
  };
}

export function buildGuestHome() {
  return {
    type: 'home',
    blocks: [
      header('🏔️ Strategic Planning Intensive'),
      section('This assistant is for founders in the Path Ahead Ventures Strategic Planning Intensive.'),
      section('📍 If you’re in the program and seeing this, reach out to the PAV team and we’ll get you access.'),
      divider,
      context(contactLine()),
    ],
  };
}

export async function publishHome(userId, ctx = {}) {
  try {
    const allowed = await hasAccess(userId);
    const view = allowed ? buildMemberHome(userId, loadProgramData(), ctx) : buildGuestHome();
    await slackApi('views.publish', { user_id: userId, view: JSON.stringify(view) });
    console.log(`[bot] Published Home for ${userId} (${allowed ? 'member' : 'guest'})`);
  } catch (err) {
    console.error('[bot] Could not publish Home:', err.message);
  }
}

// Called when someone opens the Messages tab. Posts the welcome once per person.
export async function maybeWelcome(userId, channel) {
  try {
    if (!channel) return;
    if (!(await hasAccess(userId))) return;
    const history = await slackApi('conversations.history', { channel, limit: 1 });
    if (history.messages?.length) return; // already chatting, don't interrupt
    await slackApi('chat.postMessage', {
      channel,
      text: 'Hi, I’m Pavey, your Strategic Planning Intensive assistant. Ask me anything about the program.',
      blocks: JSON.stringify(buildWelcomeBlocks(userId, loadProgramData())),
    });
    console.log(`[bot] Sent welcome to ${userId}`);
  } catch (err) {
    console.error('[bot] Could not send welcome:', err.message);
  }
}
