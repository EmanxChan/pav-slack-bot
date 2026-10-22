module.exports = async (req, res) => {
  console.log('Slack events endpoint called');
  console.log('Request body:', req.body);

  // Handle URL verification challenge
  if (req.body && req.body.type === 'url_verification') {
    console.log('URL verification challenge received');
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // For other events
  console.log('Event type:', req.body.type);
  res.status(200).json({ ok: true });
};
