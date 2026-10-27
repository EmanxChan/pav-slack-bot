// Slack "agent experience" (AI app) features: suggested prompts, thinking status, chat titles.
// Uses the assistant.threads.* methods; they need the assistant:write scope.
import { slackApi, hasAccess, loadProgramData } from './bot-core.js';
import { upcomingSessions } from './home.js';

const env = (k, d = '') => (process.env[k] || d).trim();

function shortDay(dateText) {
  // "Wednesday, October 28" -> "Wed Oct 28"
  const m = dateText.match(/^([A-Za-z]{3})[a-z]*,\s*([A-Za-z]{3})[a-z]*\s+(\d+)/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : dateText;
}

// Prompts follow the calendar: what's next first, coaching when it's coming up,
// and final plan / presentation once sessions are done.
export function promptsFor(data) {
  const sessions = upcomingSessions(data, 4);
  const prompts = [];
  const next = sessions[0];

  if (next) {
    const name = next.activity.split(':')[0].trim(); // "Workshop 1: ..." -> "Workshop 1"
    prompts.push({
      title: `📅 Prep for ${name}`,
      message: `What do I need to do before ${next.activity} on ${next.startText}, and how do I join?`,
    });
  }
  if (sessions.some((s) => /coaching/i.test(s.activity))) {
    prompts.push({ title: '👥 Book my coaching', message: 'Who is my paired advisor, and how do I book my coaching session?' });
  }
  prompts.push({ title: '📝 My homework', message: 'What homework is due before the next session?' });
  if (sessions.length) {
    prompts.push({ title: '🗓️ Key dates', message: 'What are the key dates and deadlines for the rest of the Intensive?' });
  } else {
    prompts.push({ title: '📄 Final plan', message: 'What do I need to turn in for my final plan, and when is it due?' });
    prompts.push({ title: '🎤 Presentation', message: 'How does the Presentation to PAV work?' });
  }
  return prompts.slice(0, 4);
}

// A founder opened a new Pavey chat.
export async function startAgentChat({ user_id: userId, channel_id: channel, thread_ts: threadTs }) {
  if (!userId || !channel || !threadTs) return;
  try {
    if (!(await hasAccess(userId))) {
      await slackApi('chat.postMessage', {
        channel,
        thread_ts: threadTs,
        text: '*This assistant is for founders in the Strategic Planning Intensive.*\n\n📍 If you’re in the program and seeing this, reach out to the PAV team and we’ll get you access.',
      });
      return;
    }

    const data = loadProgramData();
    const next = upcomingSessions(data, 1)[0];
    const nextLine = next
      ? `\n\n📅 *Up next:* ${next.activity}, ${shortDay(next.startText)}${next.time ? ` at ${next.time}` : ''}`
      : '';

    await slackApi('chat.postMessage', {
      channel,
      thread_ts: threadTs,
      text: `👋 *Hi <@${userId}>, I’m Pavey.* Ask me anything about the Strategic Planning Intensive, or tap a suggestion below.${nextLine}`,
    });

    await slackApi('assistant.threads.setSuggestedPrompts', {
      channel_id: channel,
      thread_ts: threadTs,
      title: 'Try asking:',
      prompts: promptsFor(data),
    });
    console.log(`[bot] Started agent chat for ${userId}`);
  } catch (err) {
    console.error('[bot] Could not start agent chat:', err.message);
  }
}

// Shows "Pavey is …" while the answer is being written. Slack clears it when we reply.
export async function setThinking(channel, threadTs, status = 'is checking the program details…') {
  try {
    await slackApi('assistant.threads.setStatus', {
      channel_id: channel,
      thread_ts: threadTs,
      status,
    });
  } catch (err) {
    console.warn('[bot] Could not set thinking status:', err.message);
  }
}

// Names the chat after its first question so the history list is easy to scan.
export async function setChatTitle(channel, threadTs, question) {
  try {
    const title = question.length > 60 ? `${question.slice(0, 57)}…` : question;
    await slackApi('assistant.threads.setTitle', { channel_id: channel, thread_ts: threadTs, title });
  } catch (err) {
    console.warn('[bot] Could not set chat title:', err.message);
  }
}
