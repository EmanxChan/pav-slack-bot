# PAV Strategic Planning Sprint Slack Bot

A production-ready Slack bot for the Path Ahead Ventures Strategic Planning Sprint program that provides information about the program, answers questions about schedules, zoom links, and resources using MiniMax m4 AI for natural language understanding.

## Features

### Core Functionality
- **Natural Language Q&A**: Uses MiniMax m4 to understand and answer questions about the program
- **Channel & DM Support**: Responds to mentions in the closed channel and direct messages from channel members
- **Access Control**: Only responds to members of the designated channel
- **Program Information**: Provides details about:
  - Program overview and key dates
  - Learning outcomes and success measures
  - Student criteria and application process
  - Curriculum timeline and schedule
  - Zoom links for workshops and advisor sessions
  - Resources (decks, documents, spreadsheets)

### Automated Features
- **Deadline Reminders**: Automatic reminders for:
  - Application deadline
  - Pre-work start
  - Course start
  - Presentation day
- **Weekly Check-ins**: Automated weekly progress check-ins during the course
- **New Member Welcome**: Automatic welcome message when someone joins the workspace
- **Post-Session Feedback**: Automatic feedback collection after workshops

### Admin Commands
- `/admin-update <json>` - Update entire program info with JSON
- `/add-resource <type> <url> <description>` - Add a new resource (type: deck, document, spreadsheet)
- `/update-zoom <mina|mona> <link>` - Update advisor zoom link
- `/admin-help` - Show all admin commands

### User Commands
- `/feedback <your feedback>` - Submit feedback about the program or workshop

## Tech Stack

- **TypeScript** - Type-safe development
- **Node.js + Bolt SDK** - Slack bot framework
- **MiniMax m4 API** - Natural language understanding with retry logic
- **Vercel** - Serverless hosting with cron jobs
- **JSON** - Data storage for program information
- **Structured Logging** - Comprehensive logging for debugging and monitoring

## Architecture Improvements

### Stability Features
- **TypeScript Migration**: Full type safety and better IDE support
- **Error Handling & Retry Logic**: Automatic retries for MiniMax API failures with exponential backoff
- **Environment Variable Validation**: Validates all required environment variables on startup
- **Structured Logging**: Comprehensive logging system for debugging and monitoring
- **Slack Signature Verification**: Security validation for all incoming requests
- **Replay Attack Prevention**: Timestamp validation for Slack events

## Setup Instructions

### Step 1: Create Slack App (5-10 minutes)

1. Go to https://api.slack.com/apps and click "Create New App"
2. Choose "From scratch"
3. Name your app (e.g., "PAV Program Bot")
4. Select your Slack workspace
5. Under "Basic Information", note the **Signing Secret** (you'll need this later)

6. **Add Bot Permissions** (OAuth & Permissions → Bot Token Scopes):
   - `chat:write`
   - `channels:history`
   - `im:history`
   - `im:write`
   - `groups:history`
   - `users:read`

7. **Install to Workspace** and **copy the Bot Token** (starts with `xoxb-`)

8. **Enable Events** (Event Subscriptions):
   - Turn on "Enable Events"
   - Request URL: Leave blank for now (we'll add after deployment)
   - Under "Subscribe to bot events", add:
     - `app_mention`
     - `message`
     - `team_join`
   - Click "Save Changes"

9. **Add Slash Commands** (Slash Commands):
   - `/admin-update` - Request URL: leave blank for now
   - `/add-resource` - Request URL: leave blank for now
   - `/update-zoom` - Request URL: leave blank for now
   - `/admin-help` - Request URL: leave blank for now
   - `/feedback` - Request URL: leave blank for now
   - Set all Request URLs to your Vercel URL after deployment

10. **Add bot to your channel**:
    - In Slack, go to your closed channel
    - Type `/invite @YourBotName` to invite the bot
    - **Copy the Channel ID** (right-click channel → Copy Link → extract ID from URL)

**Save these 3 values:**
- Slack Signing Secret
- Slack Bot Token (xoxb-...)
- Slack Channel ID

---

### Step 2: Get MiniMax API Credentials (2-3 minutes)

1. Log in to your MiniMax account
2. Get your **API Key**
3. Get your **Group ID**
4. Note the **API URL** (usually `https://api.minimax.chat/v1`)

**Save these 3 values:**
- MiniMax API Key
- MiniMax Group ID
- MiniMax API URL

---

### Step 3: Deploy to Vercel (5 minutes)

1. **Push to GitHub**:
   ```bash
   cd pav-slack-bot
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   # Create a new repo on GitHub first, then:
   git remote add origin https://github.com/YOUR_USERNAME/pav-slack-bot.git
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Go to https://vercel.com → "Add New Project"
   - Import your GitHub repo
   - Add these environment variables:
     ```
     SLACK_SIGNING_SECRET = (your Slack signing secret)
     SLACK_BOT_TOKEN = (your Slack bot token starting with xoxb-)
     SLACK_CHANNEL_ID = (your channel ID)
     MINIMAX_API_KEY = (your MiniMax API key)
     MINIMAX_GROUP_ID = (your MiniMax group ID)
     MINIMAX_API_URL = https://api.minimax.chat/v1
     APPLICATION_DEADLINE = 2026-10-11
     PRE_WORK_START = 2026-10-21
     COURSE_START = 2026-10-28
     PRESENTATION_DATE = 2026-11-10
     TIMEZONE = America/Los_Angeles
     CRON_SECRET = (generate a long random secret)
     NODE_ENV = production
     ```
   - Click "Deploy"
   - Copy your Vercel URL (e.g., `https://pav-slack-bot.vercel.app`)

3. **Update Slack Event Subscription**:
   - Go back to your Slack app settings
   - Event Subscriptions → Request URL: `https://your-app.vercel.app/api/slack/events`
   - Update all slash command Request URLs to: `https://your-app.vercel.app/api/slack/commands`
   - Click "Save Changes"

---

### Step 4: Test the Bot (2 minutes)

1. In your Slack channel, mention the bot:
   ```
   @BotName when is the next workshop?
   ```

2. DM the bot:
   ```
   What are the student criteria?
   ```

3. Try admin commands:
   ```
   /admin-help
   ```

4. Try user feedback:
   ```
   /feedback The workshop was great!
   ```

---

## Project Structure

```
pav-slack-bot/
├── api/
│   ├── cron/
│   │   └── daily.ts          # Vercel cron job for reminders
│   ├── slack/
│   │   ├── commands.ts       # Slash command handlers
│   │   └── events.ts         # Slack event handlers
│   └── index.ts              # Vercel entry point
├── data/
│   └── program-info.json     # Program information data
├── src/
│   ├── bot.ts                # Main bot logic with Slack event handlers
│   ├── config.ts             # Environment variable validation
│   ├── index.ts              # Local development entry point
│   ├── logger.ts             # Structured logging system
│   ├── minimax-client.ts     # MiniMax API client with retry logic
│   ├── rag-system.ts         # RAG system for retrieving relevant context
│   ├── reminders.ts          # Automated reminder system
│   └── types.ts              # TypeScript type definitions
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json             # TypeScript configuration
├── vercel.json               # Vercel configuration with cron
└── README.md
```

## Local Development

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual credentials

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run TypeScript compilation:
   ```bash
   npm run build
   ```

5. Run locally:
   ```bash
   npm start
   ```

6. Use ngrok to expose local server to Slack (if needed):
   ```bash
   ngrok http 3000
   ```

## Updating Program Information

### Option 1: Admin Commands (Recommended)
Use the Slack commands to update information without touching code.

### Option 2: Edit JSON File
Edit `data/program-info.json` directly and redeploy to Vercel.

### Option 3: Google Sheets Integration (Future)
For easier non-technical updates, you can integrate Google Sheets as a data source.

## Scheduled Reminders

The bot automatically sends reminders based on the configured dates:

- **Application Deadline**: 1 day before deadline
- **Pre-work Start**: On the day pre-work begins
- **Course Start**: 1 day before first workshop
- **Presentation**: On presentation day
- **Weekly Check-ins**: Every Monday during the course
- **Feedback Requests**: Day after each workshop

The cron job runs daily at 14:00 UTC (configurable in `vercel.json`) and checks if any reminders should be sent that day.

## Troubleshooting

### Bot not responding to mentions
- Check that the bot is invited to the channel
- Verify event subscriptions are enabled in Slack app settings
- Check Vercel logs for errors
- Verify environment variables are set correctly

### MiniMax API errors
- Verify your API key and group ID are correct
- Check that you have access to the m4 model
- Check MiniMax API status
- The bot has automatic retry logic for transient failures

### DMs not working
- Ensure the bot has `im:write` and `im:history` scopes
- Verify the user is a member of the closed channel
- Check that the channel ID is correct in environment variables

### Reminders not sending
- Verify CRON_SECRET is set in Vercel environment variables
- Check that dates in environment variables are correct (YYYY-MM-DD format)
- Check Vercel cron job logs
- Verify the bot has posting permissions in the channel

### TypeScript compilation errors
- Run `npm run typecheck` to see specific errors
- Ensure all dependencies are installed: `npm install`
- Check that TypeScript version is compatible

## Cost Estimate

- **Vercel**: Free tier (sufficient for this use case)
- **MiniMax API**: ~$0.50-2/month depending on usage
- **Total**: ~$0.50-2/month

## Development Commands

```bash
# Install dependencies
npm install

# Type checking
npm run typecheck

# Build TypeScript to JavaScript
npm run build

# Run locally (after build)
npm start

# Run in development mode with ts-node
npm run dev
```

## Security Features

- **Slack Signature Verification**: All incoming Slack requests are verified
- **Replay Attack Prevention**: Timestamp validation prevents old requests
- **Environment Variable Validation**: Fails fast if required variables are missing
- **Channel Membership Verification**: Only responds to authorized channel members
- **Cron Secret Protection**: Cron jobs require Bearer token authentication
- **No Credential Exposure**: Credentials never appear in logs or responses

## Monitoring

The bot includes structured logging for:
- Slack events (mentions, DMs, commands)
- MiniMax API calls and errors
- Reminder dispatches
- Configuration validation
- Error tracking

Check Vercel logs to monitor bot activity and debug issues.

## License

ISC
