import fs from 'fs';
import path from 'path';
import { LogLevel, SessionEventType } from '../types';

export class SessionLogger {
  private logDir: string;
  private logFile: string;
  private debugEnabled: boolean;

  constructor(logDir: string = 'logs', debugEnabled: boolean = false) {
    this.logDir = logDir;
    this.logFile = path.join(logDir, `session-${this.getFormattedDate()}.log`);
    this.debugEnabled = debugEnabled;
    
    this.ensureLogDirectoryExists();
  }

  private ensureLogDirectoryExists(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getFormattedDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private writeToLog(level: LogLevel, message: string): void {
    const timestamp = this.getTimestamp();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Only log debug messages if debug is enabled
    if (level === LogLevel.DEBUG && !this.debugEnabled) {
      return;
    }
    
    fs.appendFile(this.logFile, logEntry, (err) => {
      if (err) {
        console.error(`Error writing to log file: ${err.message}`);
        console.error(logEntry);
      }
    });
    
    // Also output to console for development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                           level === LogLevel.WARN ? 'warn' : 
                           level === LogLevel.DEBUG ? 'debug' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`);
    }
  }

  public debug(message: string): void {
    this.writeToLog(LogLevel.DEBUG, message);
  }

  public info(message: string): void {
    this.writeToLog(LogLevel.INFO, message);
  }

  public warn(message: string): void {
    this.writeToLog(LogLevel.WARN, message);
  }

  public error(message: string): void {
    this.writeToLog(LogLevel.ERROR, message);
  }

  public log(eventType: SessionEventType, message: string): void {
    let level: LogLevel;
    
    switch (eventType) {
      case SessionEventType.ERROR:
        level = LogLevel.ERROR;
        break;
      case SessionEventType.WARN:
        level = LogLevel.WARN;
        break;
      case SessionEventType.START:
      case SessionEventType.STOP:
      case SessionEventType.LOGIN:
      case SessionEventType.LOGOUT:
        level = LogLevel.INFO;
        break;
      default:
        level = LogLevel.DEBUG;
    }
    
    this.writeToLog(level, `[${eventType.toUpperCase()}] ${message}`);
  }
}