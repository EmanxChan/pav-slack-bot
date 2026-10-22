const eventsHandler = require('./slack/events');
const commandsHandler = require('./slack/commands');
const cronHandler = require('./cron/daily');

module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  console.log('Incoming request:', req.method, path);

  // Route to appropriate handler
  if (path.startsWith('/api/slack/events')) {
    return eventsHandler(req, res);
  }

  if (path.startsWith('/api/slack/commands')) {
    return commandsHandler(req, res);
  }

  if (path.startsWith('/api/cron/daily')) {
    return cronHandler(req, res);
  }

  // Health check
  if (path === '/' || path === '/api') {
    return res.status(200).json({ status: 'ok', message: 'PAV Slack Bot is running' });
  }

  res.status(404).json({ error: 'Not found' });
};
