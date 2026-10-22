import { config } from './config';
import { logger } from './logger';
import { ScheduledReminder } from './types';

/**
 * Reminder messages for different events
 */
const REMINDER_MESSAGES: Record<string, string> = {
  application_deadline: `📢 *APPLICATION DEADLINE REMINDER*

Just a friendly reminder that the application deadline for the Strategic Planning Sprint is coming up!

Make sure to submit your application by the deadline to be considered for this intensive.

Application form: [Link]

Don't miss out on this opportunity to create a working strategic plan for your business!`,

  pre_work_start: `📚 *PRE-WORK STARTING TODAY*

Pre-work materials are now available for the Strategic Planning Sprint!

Please review the materials and complete the following before Workshop 1:
- Draft your mission, vision, and values
- Draft 3-year revenue/profit/cash goals
- Complete the ROOLA questionnaire
- Review the pre-read deck

All materials are available in the program resources. Let me know if you have any questions!`,

  workshop: `🎓 *UPCOMING WORKSHOP REMINDER*

This is a reminder that our next workshop is coming up soon!

Please make sure you've completed the pre-work and are ready to engage. Check the schedule for the exact time and zoom link.

See you there!`,

  presentation: `🎤 *PRESENTATION DAY REMINDER*

Today is presentation day! Here's what you need to know:

• Make sure your slides and 2-page plan are ready
• Join the zoom link at the scheduled time
• Be prepared to present page 1 of your strategic plan
• Have your full plan (pages 1 & 2) ready to submit

Good luck! You've worked hard to get here.`,

  weekly_checkin: `📊 *WEEKLY CHECK-IN*

How's your strategic plan coming along?

• What progress have you made this week?
• Are there any blockers I can help with?
• Do you have questions about upcoming sessions?

Feel free to ask me anything about the program, schedule, or resources!`,

  feedback: `📝 *WORKSHOP FEEDBACK*

Thank you for attending the workshop! We'd love to hear your feedback to help us improve future sessions.

Please take a few minutes to share your thoughts:
• What was most helpful?
• What could be improved?
• Any suggestions for future workshops?

Your feedback is invaluable in making this program better for everyone!`,

  new_member_welcome: `👋 *Welcome to the Strategic Planning Sprint!*

I'm your program assistant bot. I'm here to help you with any questions about the program.

Here's what you need to know:

📅 *Key Dates:*
• Application Deadline: {applicationDeadline}
• Pre-work Starts: {preWorkStart}
• Course Runs: {courseStart} - {courseEnd}
• Presentation: {presentationDate}

❓ *How to use me:*
• Mention me in this channel: @BotName your question
• DM me directly with questions
• I can help with schedules, zoom links, criteria, and more

📚 *Resources:*
• Ask me for zoom links, decks, or documents
• I'll provide all the information you need

Feel free to ask me anything! Let's make this a great program. 🚀`,
};

/**
 * Generate reminder message with placeholders replaced
 */
function formatMessage(template: string, placeholders: Record<string, string>): string {
  let message = template;
  Object.entries(placeholders).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return message;
}

/**
 * Get reminder message for a specific type
 */
export function getReminderMessage(
  type: ScheduledReminder['type'],
  customPlaceholders?: Record<string, string>
): string {
  const messageMap: Record<ScheduledReminder['type'], string> = {
    applicationDeadline: REMINDER_MESSAGES.application_deadline,
    preWorkStart: REMINDER_MESSAGES.pre_work_start,
    workshop: REMINDER_MESSAGES.workshop,
    presentation: REMINDER_MESSAGES.presentation,
    weeklyCheckin: REMINDER_MESSAGES.weekly_checkin,
    feedback: REMINDER_MESSAGES.feedback,
  };

  const template = messageMap[type];
  const defaultPlaceholders = {
    applicationDeadline: config.reminders.applicationDeadline,
    preWorkStart: config.reminders.preWorkStart,
    courseStart: config.reminders.courseStart,
    presentationDate: config.reminders.presentationDate,
  };

  const placeholders = { ...defaultPlaceholders, ...customPlaceholders };
  return formatMessage(template, placeholders);
}

/**
 * Check if a reminder should be sent today
 */
export function shouldSendReminder(
  type: ScheduledReminder['type'],
  targetDate: string
): boolean {
  const today = new Date().toISOString().split('T')[0];
  return today === targetDate;
}

/**
 * Get all scheduled reminders based on program dates
 */
export function getScheduledReminders(): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];

  // Application deadline reminder (1 day before)
  const appDeadline = new Date(config.reminders.applicationDeadline);
  appDeadline.setDate(appDeadline.getDate() - 1);
  reminders.push({
    type: 'applicationDeadline',
    date: appDeadline.toISOString().split('T')[0],
    message: getReminderMessage('applicationDeadline'),
    targetChannel: config.slack.channelId,
  });

  // Pre-work start reminder (on the day)
  reminders.push({
    type: 'preWorkStart',
    date: config.reminders.preWorkStart,
    message: getReminderMessage('preWorkStart'),
    targetChannel: config.slack.channelId,
  });

  // Course start reminder (1 day before)
  const courseStart = new Date(config.reminders.courseStart);
  courseStart.setDate(courseStart.getDate() - 1);
  reminders.push({
    type: 'workshop',
    date: courseStart.toISOString().split('T')[0],
    message: getReminderMessage('workshop'),
    targetChannel: config.slack.channelId,
  });

  // Presentation reminder (on the day)
  reminders.push({
    type: 'presentation',
    date: config.reminders.presentationDate,
    message: getReminderMessage('presentation'),
    targetChannel: config.slack.channelId,
  });

  // Weekly check-ins (every Monday during the course)
  const startDate = new Date(config.reminders.courseStart);
  const endDate = new Date(config.reminders.presentationDate);
  let current = new Date(startDate);

  while (current <= endDate) {
    if (current.getDay() === 1) { // Monday
      reminders.push({
        type: 'weeklyCheckin',
        date: current.toISOString().split('T')[0],
        message: getReminderMessage('weeklyCheckin'),
        targetChannel: config.slack.channelId,
      });
    }
    current.setDate(current.getDate() + 1);
  }

  // Post-workshop feedback reminders (day after each workshop)
  // Workshop 1: Oct 28
  const workshop1 = new Date('2026-10-28');
  workshop1.setDate(workshop1.getDate() + 1);
  reminders.push({
    type: 'feedback',
    date: workshop1.toISOString().split('T')[0],
    message: getReminderMessage('feedback'),
    targetChannel: config.slack.channelId,
  });

  // Workshop 2: Nov 3
  const workshop2 = new Date('2026-11-03');
  workshop2.setDate(workshop2.getDate() + 1);
  reminders.push({
    type: 'feedback',
    date: workshop2.toISOString().split('T')[0],
    message: getReminderMessage('feedback'),
    targetChannel: config.slack.channelId,
  });

  logger.info('Scheduled reminders generated', { count: reminders.length });
  return reminders;
}

/**
 * Get welcome message for new channel members
 */
export function getWelcomeMessage(): string {
  const template = REMINDER_MESSAGES.new_member_welcome;
  const placeholders = {
    applicationDeadline: config.reminders.applicationDeadline,
    preWorkStart: config.reminders.preWorkStart,
    courseStart: config.reminders.courseStart,
    presentationDate: config.reminders.presentationDate,
  };
  return formatMessage(template, placeholders);
}
