# Quick Setup Guide

I've built a production-ready Slack bot for the PAV Strategic Planning Sprint with TypeScript, automated reminders, and stability features! Here's what you need to do to get it running.

## What I've Built ✅

**Architecture & Stability:**
- ✅ Full TypeScript migration for type safety
- ✅ Error handling & retry logic for MiniMax API (automatic retries with exponential backoff)
- ✅ Environment variable validation (fails fast if config is missing)
- ✅ Structured logging system (comprehensive logging for debugging)
- ✅ Slack signature verification (security validation)
- ✅ Replay attack prevention (timestamp validation)

**Core Features:**
- ✅ Complete Node.js project structure
- ✅ MiniMax m4 API client integration
- ✅ Slack bot with Bolt SDK
- ✅ All your program information structured in JSON
- ✅ RAG system for intelligent Q&A
- ✅ Channel membership verification
- ✅ Admin commands for easy updates

**New Automated Features:**
- ✅ Automated deadline reminders (application, pre-work, course, presentation)
- ✅ Weekly progress check-ins during the course
- ✅ New member welcome automation
- ✅ Post-session feedback collection
- ✅ Vercel cron job configuration

**Documentation:**
- ✅ Comprehensive README with all features
- ✅ TypeScript configuration
- ✅ Vercel deployment configuration

## Your Manual Steps (15-20 minutes total)

### Step 1: Create Slack App (5-10 min)

1. Go to https://api.slack.com/apps → "Create New App" → "From scratch"
2. Name it (e.g., "PAV Program Bot") and select your workspace
3. **Copy Signing Secret** from Basic Information

4. **Add Bot Scopes** (OAuth & Permissions → Bot Token Scopes):
   - `chat:write`
   - `channels:history`
   - `im:history`
   - `im:write`
   - `groups:history`
   - `users:read`

5. Install to workspace → **Copy Bot Token** (starts with `xoxb-`)

6. **Enable Events** (Event Subscriptions):
   - Turn on "Enable Events"
   - Request URL: Leave blank for now
   - Subscribe to bot events: `app_mention`, `message`, `team_join`

7. **Add Slash Commands** (Slash Commands):
   - `/admin-update` - Request URL: leave blank
   - `/add-resource` - Request URL: leave blank
   - `/update-zoom` - Request URL: leave blank
   - `/admin-help` - Request URL: leave blank
   - `/feedback` - Request URL: leave blank

8. **Invite bot to your channel**:
   - In Slack, go to your closed channel
   - Type `/invite @YourBotName`
   - **Copy Channel ID** (right-click channel → Copy Link → extract ID)

**Save these 3 values:**
- Slack Signing Secret
- Slack Bot Token (xoxb-...)
- Slack Channel ID

---

### Step 2: Get MiniMax API Credentials (2-3 min)

Get your MiniMax API Key, Group ID, and API URL from your MiniMax dashboard.

**Save these 3 values:**
- MiniMax API Key
- MiniMax Group ID
- MiniMax API URL

---

### Step 3: Deploy to Vercel (5 min)

1. **Push to GitHub**:
   ```bash
   cd pav-slack-bot
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   # Create repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/pav-slack-bot.git
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Go to https://vercel.com → "Add New Project"
   - Import your GitHub repo
   - Add environment variables:
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
     CRON_SECRET = (generate a long random secret - use password manager)
     NODE_ENV = production
     ```
   - Click "Deploy"
   - Copy your Vercel URL

3. **Update Slack Event Subscription**:
   - Go back to your Slack app settings
   - Event Subscriptions → Request URL: `https://your-app.vercel.app/api/slack/events`
   - Update all slash command Request URLs to: `https://your-app.vercel.app/api/slack/commands`
   - Click "Save Changes"

---

### Step 4: Test (2 min)

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

## Project Location

All files are in: `/Users/emchan/Documents/Devin/pav-slack-bot/`

Key files:
- `data/program-info.json` - All your program information
- `src/bot.ts` - Main bot logic with TypeScript
- `src/minimax-client.ts` - MiniMax integration with retry logic
- `src/rag-system.ts` - Q&A system
- `src/reminders.ts` - Automated reminder system
- `src/logger.ts` - Structured logging
- `src/config.ts` - Environment validation
- `README.md` - Full documentation

---

## New Features

### Automated Reminders
The bot will automatically send:
- Application deadline reminder (1 day before)
- Pre-work start reminder (on the day)
- Course start reminder (1 day before)
- Presentation reminder (on the day)
- Weekly check-ins (every Monday during course)
- Feedback requests (day after each workshop)

### New Member Welcome
When someone joins the workspace, they automatically get a welcome DM with program info.

### Feedback Collection
Users can submit feedback with `/feedback <your feedback>`.

---

## Updating Information

### Easy Way (No Code Changes)
Use Slack commands:
- `/add-resource deck https://link "Description"` - Add a deck
- `/add-resource document https://link "Description"` - Add a document
- `/update-zoom mina https://new-link` - Update zoom link
- `/admin-help` - See all commands

### Manual Way
Edit `data/program-info.json` and redeploy to Vercel.

---

## Questions the Bot Can Answer

- "When is the next workshop?"
- "What are the student criteria?"
- "Give me the zoom link for Mina"
- "What's the application deadline?"
- "What will I learn in this program?"
- "How much time do I need to commit?"
- "Who are the workshop leads?"
- "What are the deliverables?"
- And much more - it uses natural language understanding!

---

## Stability Features

- **TypeScript**: Catches errors at compile time
- **Retry Logic**: Automatic retries for MiniMax API failures
- **Env Validation**: Validates all environment variables on startup
- **Structured Logging**: Comprehensive logging for debugging
- **Security**: Slack signature verification and replay attack prevention

---

## Cost

- Vercel: Free
- MiniMax: ~$0.50-2/month
- **Total: ~$0.50-2/month**

---

## Development Commands

```bash
# Type checking
npm run typecheck

# Build TypeScript
npm run build

# Run locally
npm start

# Development mode
npm run dev
```

---

Need help? Check the full README.md in the project folder!
