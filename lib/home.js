import { slackApi, isAllowlisted, isChannelMember, loadProgramData } from './bot-core.js';

const env = (k, d = '') => (process.env[k] || d).trim();
const TZ = 'America/Los_Angeles';

// Questions offered as one-tap buttons. Tapping one makes the bot answer in Messages.
export const QUICK_QUESTIONS = [
  { label: '📅 What’s next?', question: 'What is the next session, and how do I join it?' },
  { label: '📝 My homework', question: 'What homework is due before the next session?' },
  { label: '👥 Book coaching', question: 'How do I book advisor coaching, and what times are open?' },
  { label: '🔗 Zoom links', question: 'What are all the Zoom links I need for the program?' },
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

export function buildMemberHome(userId, data, ctx = {}) {
  const sessions = upcomingSessions(data);
  const res = data.resources || {};
  const leads = data.workshopLeads || {};

  const sessionBlocks = sessions.length
    ? sessions.map((s) => {
        const when = s.endText ? `${shortDate(s.startText)} to ${shortDate(s.endText)}` : shortDate(s.startText);
        const time = s.time ? `  ·  ${s.time}` : '';
        return section(`*${when}${time}*\n${s.activity}`);
      })
    : [section('The Sprint has wrapped. Thank you for being part of it.')];

  const links = [];
  for (const lead of Object.values(leads)) {
    if (lead?.zoom) links.push(`• <${lead.zoom}|${lead.name.split(' ')[0]}’s Zoom room>`);
  }
  if (res.spreadsheets?.advisorCoachingSignup) {
    links.push(`• <${res.spreadsheets.advisorCoachingSignup}|Advisor coaching sign-up sheet>`);
  }
  const deckLabels = {
    '2026AscentBasecampPreRead': 'Pre-read deck',
    '2026KickoffSession': 'Workshop 1 deck',
    '2026BasecampSession': 'Workshop 2 deck',
  };
  for (const [key, label] of Object.entries(deckLabels)) {
    if (res.decks?.[key]) links.push(`• <${res.decks[key]}|${label}>`);
  }

  return {
    type: 'home',
    blocks: [
      header('🏔️ Strategic Planning Sprint'),
      section(
        `Hi <@${userId}>, I’m your assistant for the Path Ahead Ventures Strategic Planning Sprint. Ask me about dates, Zoom links, homework and resources, any time.`,
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
      context('Tap a question and I’ll answer it in Messages.'),
      {
        type: 'actions',
        elements: QUICK_QUESTIONS.map((q, i) => ({
          type: 'button',
          action_id: `ask_${i}`,
          text: { type: 'plain_text', text: q.label, emoji: true },
          value: q.question,
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
      header('🏔️ Strategic Planning Sprint'),
      section('This assistant is for founders in the Path Ahead Ventures Strategic Planning Sprint.'),
      section('📍 If you’re in the program and seeing this, reach out to the PAV team and we’ll get you access.'),
      divider,
      context(contactLine()),
    ],
  };
}

export async function publishHome(userId, ctx = {}) {
  try {
    const programChannel = env('SLACK_CHANNEL_ID');
    let allowed = true;
    if (programChannel && !isAllowlisted(userId)) {
      allowed = await isChannelMember(userId, programChannel);
    }
    const view = allowed ? buildMemberHome(userId, loadProgramData(), ctx) : buildGuestHome();
    await slackApi('views.publish', { user_id: userId, view: JSON.stringify(view) });
    console.log(`[bot] Published Home for ${userId} (${allowed ? 'member' : 'guest'})`);
  } catch (err) {
    console.error('[bot] Could not publish Home:', err.message);
  }
}
