// "Starting in 15 minutes" posts for the program channel, queued with Slack's
// chat.scheduleMessage so Slack delivers them on time (no cron needed).
// Admin DM commands: !reminders (preview + status), !schedule-reminders, !cancel-reminders
import { slackApi, loadProgramData } from './bot-core.js';

const env = (k, d = '') => (process.env[k] || d).trim();
const TZ = 'America/Los_Angeles';
const LEAD_MINUTES = Number(env('REMINDER_LEAD_MINUTES', '15'));
const MARK = 'pavey-reminder'; // used to recognize our scheduled posts

// Minutes that `tz` is ahead of UTC at a given instant.
function tzOffsetMinutes(tz, at) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - at.getTime()) / 60000;
}

// A wall-clock time in Pacific Time -> the real instant (handles the daylight-saving switch).
function pacificToDate(year, month, day, hour, minute) {
  const guess = new Date(Date.UTC(year, month, day, hour, minute));
  return new Date(guess.getTime() - tzOffsetMinutes(TZ, guess) * 60000);
}

// "10:00 AM - 12:30 PM PT", "10-11 PT", "12-2:30 PT", "12pm - 2pm PT" -> {hour, minute} of the start.
export function parseStart(timeText) {
  if (!timeText) return null;
  const [startPart, endPart = ''] = timeText.split(/\s*[-–]\s*/);
  const m = startPart.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  let ampm = (m[3] || '').toLowerCase();
  if (!ampm) {
    const endAmPm = (endPart.match(/(am|pm)/i) || [])[1]?.toLowerCase();
    // Without a marker, 7-11 is morning and 12-6 is afternoon (workday sessions).
    ampm = hour >= 7 && hour <= 11 ? 'am' : hour === 12 || hour <= 6 ? 'pm' : endAmPm || 'am';
  }
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return { hour, minute };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function plannedReminders(data = loadProgramData(), now = new Date()) {
  const year = Number(env('PROGRAM_YEAR', '2026'));
  const out = [];
  for (const s of data.curriculum || []) {
    if (!s.joinLink) continue; // live sessions only
    const dm = s.date.match(/([A-Za-z]+)\s+(\d{1,2})/g)?.[0]?.match(/([A-Za-z]+)\s+(\d{1,2})/);
    const month = MONTHS.indexOf((dm?.[1] || '').toLowerCase());
    const start = parseStart(s.time);
    if (month < 0 || !start) continue;
    const startsAt = pacificToDate(year, month, Number(dm[2]), start.hour, start.minute);
    const postAt = new Date(startsAt.getTime() - LEAD_MINUTES * 60000);
    out.push({ session: s, startsAt, postAt, future: postAt.getTime() > now.getTime() + 60000 });
  }
  return out;
}

const fmt = (d, opts) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(d);
const when = (d) => `${fmt(d, { weekday: 'short', month: 'short', day: 'numeric' })}, ${fmt(d, { hour: 'numeric', minute: '2-digit' })} PT`;

function reminderMessage({ session: s, startsAt }) {
  const name = s.activity;
  const startTime = fmt(startsAt, { hour: 'numeric', minute: '2-digit' });
  const details = [s.meetingId && `Meeting ID: \`${s.meetingId}\``, s.passcode && `Passcode: \`${s.passcode}\``].filter(Boolean).join('  ·  ');
  // Slack's date token shows each reader the time in their own time zone; PT stays as the anchor.
  const epoch = Math.floor(startsAt.getTime() / 1000);
  const localTime = `<!date^${epoch}^{time}|${startTime} PT>`;
  const text = `⏰ *${name} starts in ${LEAD_MINUTES} minutes*\n🕐 ${startTime} PT  ·  ${localTime} your time\n\n📹 <${s.joinLink}|Join on Teams>${details ? `\n${details}` : ''}\n\nSee you there!`;
  return {
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [{ type: 'button', style: 'primary', action_id: 'join_reminder', text: { type: 'plain_text', text: `📹 Join ${name.split(':')[0].trim()}`, emoji: true }, url: s.joinLink }],
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Questions? DM Pavey any time._` }] },
    ],
  };
}

async function scheduledInChannel(channel) {
  const all = [];
  let cursor;
  do {
    const data = await slackApi('chat.scheduledMessages.list', { channel, limit: 100, cursor });
    all.push(...(data.scheduled_messages || []));
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);
  return all.filter((m) => (m.text || '').includes(`starts in ${LEAD_MINUTES} minutes`) || (m.text || '').includes(MARK));
}

export async function remindersCommand(cmd, { to, threadTs }) {
  const say = (text) => slackApi('chat.postMessage', { channel: to, thread_ts: threadTs, text });
  const channel = env('SLACK_CHANNEL_ID');
  if (!channel) return say('SLACK_CHANNEL_ID is not set, so there is no channel to remind.');

  try {
    const plan = plannedReminders();
    const existing = await scheduledInChannel(channel);
    const isQueued = (p) => existing.some((m) => Math.abs(Number(m.post_at) - Math.floor(p.postAt.getTime() / 1000)) < 60);

    if (cmd === 'schedule-reminders') {
      const done = [];
      for (const p of plan.filter((x) => x.future && !isQueued(x))) {
        const msg = reminderMessage(p);
        await slackApi('chat.scheduleMessage', { channel, post_at: Math.floor(p.postAt.getTime() / 1000), text: msg.text, blocks: JSON.stringify(msg.blocks) });
        done.push(`• ${p.session.activity}: posts ${when(p.postAt)}`);
      }
      return say(done.length ? `✅ *Scheduled ${done.length} reminder${done.length === 1 ? '' : 's'} in <#${channel}>*\n${done.join('\n')}\n\nUse \`!reminders\` to check them or \`!cancel-reminders\` to remove them.` : 'Nothing new to schedule. Every upcoming session already has a reminder. Use `!reminders` to see them.');
    }

    if (cmd === 'cancel-reminders') {
      for (const m of existing) await slackApi('chat.deleteScheduledMessage', { channel, scheduled_message_id: m.id });
      return say(`🗑️ Cancelled ${existing.length} scheduled reminder${existing.length === 1 ? '' : 's'} in <#${channel}>.`);
    }

    // !reminders: preview + status
    const lines = plan.map((p) => {
      const status = !p.future ? '⏭️ already passed' : isQueued(p) ? '✅ scheduled' : '⬜ not scheduled yet';
      return `• *${p.session.activity}* (starts ${when(p.startsAt)}): reminder ${when(p.postAt)}, ${status}`;
    });
    const sample = plan.find((p) => p.future);
    return say(
      `⏰ *Session reminders for <#${channel}>* (${LEAD_MINUTES} minutes before)\n${lines.join('\n')}` +
        (sample ? `\n\n*Preview:*\n>${reminderMessage(sample).text.replace(/\n/g, '\n>')}` : '') +
        `\n\nRun \`!schedule-reminders\` to queue the missing ones, or \`!cancel-reminders\` to clear them.`,
    );
  } catch (err) {
    console.error('[bot] Reminders command failed:', err.message);
    return say(`Reminders failed: ${err.message}`);
  }
}
