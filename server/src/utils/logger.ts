/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LogLevel = "error" | "warn" | "info" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function getLogLevel(): number {
  const envLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : 2;
}

export class Logger {
  private prefix: string;

  constructor(context?: string, jobId?: string) {
    const contextPart = context ? `[${context}]` : "";
    const jobPart = jobId ? `[Job ${jobId}]` : "";
    this.prefix = `${contextPart}${jobPart}`.trim();
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (LOG_LEVELS[level] <= getLogLevel()) {
      const timestamp = new Date().toISOString();
      const levelTag = level.toUpperCase().padEnd(5);
      const prefixStr = this.prefix ? ` ${this.prefix}` : "";
      console.log(`[${timestamp}] [${levelTag}]${prefixStr}: ${message}`, ...args);
    }
  }

  public error(message: string, ...args: any[]) {
    this.log("error", message, ...args);
  }

  public warn(message: string, ...args: any[]) {
    this.log("warn", message, ...args);
  }

  public info(message: string, ...args: any[]) {
    this.log("info", message, ...args);
  }

  public debug(message: string, ...args: any[]) {
    this.log("debug", message, ...args);
  }
}

export const logger = new Logger("CoachClip");
