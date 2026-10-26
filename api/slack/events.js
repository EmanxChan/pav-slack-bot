import { waitUntil } from '@vercel/functions';
import { verifySlackSignature, handleEvent } from '../../lib/bot-core.js';

export const maxDuration = 60;

export async function POST(request) {
  const rawBody = await request.text();

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Slack's one-time URL verification when you save the Request URL.
  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge });
  }

  if (!verifySlackSignature(rawBody, request.headers)) {
    console.warn('[bot] Invalid Slack signature; check SLACK_SIGNING_SECRET');
    return new Response('Invalid signature', { status: 401 });
  }

  // Slack retries if we're slow. We already started on the first attempt, so skip retries
  // to avoid double replies.
  if (request.headers.get('x-slack-retry-num')) {
    console.log('[bot] Ignoring Slack retry', request.headers.get('x-slack-retry-reason'));
    return Response.json({ ok: true });
  }

  if (body.type === 'event_callback' && body.event) {
    // Ack Slack immediately (it needs a response within 3s) and keep working in the background.
    waitUntil(handleEvent(body.event, { teamId: body.team_id, appId: body.api_app_id }));
  }

  return Response.json({ ok: true });
}

export function GET() {
  return Response.json({ status: 'ok', endpoint: 'slack events' });
}
