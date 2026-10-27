import { sendDigest } from '../../lib/digest.js';

export const maxDuration = 60;

// Vercel Cron calls this every Monday (see vercel.json). If CRON_SECRET is set,
// Vercel sends it as a Bearer token and we require it.
export async function GET(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const auth = request.headers.get('authorization') || '';
  const fromVercelCron = (request.headers.get('user-agent') || '').includes('vercel-cron');
  if (secret ? auth !== `Bearer ${secret}` : !fromVercelCron) {
    return new Response('Unauthorized', { status: 401 });
  }
  await sendDigest();
  return Response.json({ ok: true });
}
