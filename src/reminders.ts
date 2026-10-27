import programInfo from '../data/program-info.json';
import { logger } from './logger';
import { ScheduledReminder } from './types';

/**
 * Reminder messages for different events
 */
const REMINDER_MESSAGES: Record<string, string> = {
  application_deadline: `📢 *APPLICATION DEADLINE REMINDER*

Just a friendly reminder that the application deadline for the Strategic Planning Intensive is coming up!

Make sure to submit your application by the deadline to be considered for this intensive.

Application form: [Link]

Don't miss out on this opportunity to create a working strategic plan for your business!`,

  pre_work_start: `📚 *PRE-WORK STARTING TODAY*

Pre-work materials are now available for the Strategic Planning Intensive!

Please review the materials and complete the following before Workshop 1:
- Draft your mission, vision, and values
- Draft 3-year revenue/profit/cash goals
- Complete the ROOL questionnaire
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

  new_member_welcome: `👋 *Welcome to the Strategic Planning Intensive!*

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
    applicationDeadline: programInfo.program.keyDates.applicationDeadline,
    preWorkStart: programInfo.program.keyDates.preWorkStart,
    courseStart: programInfo.program.keyDates.courseStart,
    presentationDate: programInfo.program.keyDates.presentationToPAV,
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
 * Get all scheduled reminders based on program dates from JSON
 */
export function getScheduledReminders(): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];
  const keyDates = programInfo.program.keyDates;
  const curriculum = programInfo.curriculum;

  // Application deadline reminder (1 day before)
  const appDeadline = new Date(keyDates.applicationDeadline);
  appDeadline.setDate(appDeadline.getDate() - 1);
  reminders.push({
    type: 'applicationDeadline',
    date: appDeadline.toISOString().split('T')[0],
    message: getReminderMessage('applicationDeadline'),
    targetChannel: process.env.SLACK_CHANNEL_ID,
  });

  // Pre-work start reminder (on the day)
  reminders.push({
    type: 'preWorkStart',
    date: keyDates.preWorkStart,
    message: getReminderMessage('preWorkStart'),
    targetChannel: process.env.SLACK_CHANNEL_ID,
  });

  // Course start reminder (1 day before)
  const courseStart = new Date(keyDates.courseStart);
  courseStart.setDate(courseStart.getDate() - 1);
  reminders.push({
    type: 'workshop',
    date: courseStart.toISOString().split('T')[0],
    message: getReminderMessage('workshop'),
    targetChannel: process.env.SLACK_CHANNEL_ID,
  });

  // Presentation reminder (on the day)
  reminders.push({
    type: 'presentation',
    date: keyDates.presentationToPAV,
    message: getReminderMessage('presentation'),
    targetChannel: process.env.SLACK_CHANNEL_ID,
  });

  // Weekly check-ins (every Monday during the course)
  const startDate = new Date(keyDates.courseStart);
  const endDate = new Date(keyDates.presentationToPAV);
  let current = new Date(startDate);

  while (current <= endDate) {
    if (current.getDay() === 1) { // Monday
      reminders.push({
        type: 'weeklyCheckin',
        date: current.toISOString().split('T')[0],
        message: getReminderMessage('weeklyCheckin'),
        targetChannel: process.env.SLACK_CHANNEL_ID,
      });
    }
    current.setDate(current.getDate() + 1);
  }

  // Post-workshop feedback reminders (day after each workshop)
  // Find workshops in curriculum
  curriculum.forEach((item) => {
    if (item.activity.includes('Workshop')) {
      const workshopDate = new Date(item.date);
      workshopDate.setDate(workshopDate.getDate() + 1);
      reminders.push({
        type: 'feedback',
        date: workshopDate.toISOString().split('T')[0],
        message: getReminderMessage('feedback'),
        targetChannel: process.env.SLACK_CHANNEL_ID,
      });
    }
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
    applicationDeadline: programInfo.program.keyDates.applicationDeadline,
    preWorkStart: programInfo.program.keyDates.preWorkStart,
    courseStart: programInfo.program.keyDates.courseStart,
    presentationDate: programInfo.program.keyDates.presentationToPAV,
  };
  return formatMessage(template, placeholders);
}
