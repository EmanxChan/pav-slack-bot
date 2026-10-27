// Test questions with what a good answer must (and must not) contain.
// Run by DMing Pavey `!eval` as an admin. Results come back in that DM.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { slackApi, askMiniMax } from './bot-core.js';

function loadSet() {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'eval-set.json'), 'utf8'));
}

export function grade(test, answer, globalMustNot = []) {
  const lower = answer.toLowerCase();
  const problems = [];
  for (const group of test.mustIncludeAny || []) {
    if (!group.some((s) => lower.includes(s.toLowerCase()))) problems.push(`missing one of: ${group.join(' / ')}`);
  }
  for (const s of [...(test.mustNotInclude || []), ...globalMustNot]) {
    if (lower.includes(s.toLowerCase())) problems.push(`should not say: ${s}`);
  }
  return problems;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export async function runEval({ to, threadTs }) {
  const set = loadSet();
  await slackApi('chat.postMessage', { channel: to, thread_ts: threadTs, text: `🧪 Running ${set.tests.length} test questions. This takes about a minute…` });
  const started = Date.now();
  const results = await pool(set.tests, 8, async (t) => {
    try {
      const { text } = await askMiniMax(t.question, [], t.asker || '');
      return { t, text, problems: grade(t, text, set.globalMustNotInclude) };
    } catch (err) {
      return { t, text: '', problems: [`error: ${err.message}`] };
    }
  });
  const failed = results.filter((r) => r.problems.length);
  const lines = [
    `${failed.length ? '⚠️' : '✅'} *Pavey test run: ${results.length - failed.length}/${results.length} passed* (${Math.round((Date.now() - started) / 1000)}s)`,
  ];
  for (const r of failed) {
    lines.push('', `❌ *${r.t.question}*`, `• ${r.problems.join('\n• ')}`, `> ${r.text.slice(0, 300).replace(/\n/g, ' ')}`);
  }
  await slackApi('chat.postMessage', { channel: to, thread_ts: threadTs, text: lines.join('\n') });
  console.log(`[bot] Eval: ${results.length - failed.length}/${results.length} passed`);
}
