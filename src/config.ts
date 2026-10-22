export interface EnvConfig {
  slack: {
    botToken: string;
    signingSecret: string;
    channelId: string;
  };
  minimax: {
    apiKey: string;
    groupId: string;
    apiUrl: string;
  };
  port: number;
}

function validateEnv(): EnvConfig {
  const requiredVars = {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please set them in your .env file or Vercel environment variables.'
    );
  }

  // Validate formats
  if (!requiredVars.SLACK_BOT_TOKEN?.startsWith('xoxb-')) {
    throw new Error('SLACK_BOT_TOKEN must start with "xoxb-"');
  }

  return {
    slack: {
      botToken: requiredVars.SLACK_BOT_TOKEN!,
      signingSecret: requiredVars.SLACK_SIGNING_SECRET!,
      channelId: requiredVars.SLACK_CHANNEL_ID!,
    },
    minimax: {
      apiKey: requiredVars.MINIMAX_API_KEY!,
      groupId: requiredVars.MINIMAX_GROUP_ID!,
      apiUrl: process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1',
    },
    port: parseInt(process.env.PORT || '3000', 10),
  };
}

export const config = validateEnv();
