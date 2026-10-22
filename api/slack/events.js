export default function handler(req, res) {
  console.log('=== Slack events endpoint called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body:', JSON.stringify(req.body));

  // Handle URL verification challenge
  if (req.body && req.body.type === 'url_verification') {
    console.log('Challenge received:', req.body.challenge);
    res.status(200).json({ challenge: req.body.challenge });
    return;
  }

  // For other events
  console.log('Event type:', req.body.type);
  res.status(200).json({ ok: true });
}
