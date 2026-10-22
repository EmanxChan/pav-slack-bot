export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;
    let log = `[${timestamp}] [${level}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      log += ` ${JSON.stringify(context)}`;
    }

    if (error) {
      log += `\n${error.stack || error.message}`;
    }

    return log;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Specific logging methods for common events
  logSlackEvent(eventType: string, userId?: string, context?: Record<string, unknown>): void {
    this.info(`Slack event: ${eventType}`, { userId, ...context });
  }

  logMiniMaxCall(prompt: string, responseLength: number, context?: Record<string, unknown>): void {
    this.debug('MiniMax API call', { promptLength: prompt.length, responseLength, ...context });
  }

  logMiniMaxError(error: Error, context?: Record<string, unknown>): void {
    this.error('MiniMax API error', error, context);
  }

  logReminderSent(type: string, target: string): void {
    this.info(`Reminder sent: ${type}`, { target });
  }
}

export const logger = new Logger();
