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

const ALLOWED_KEYS = [
  "timestamp",
  "level",
  "event",
  "jobId",
  "status",
  "stage",
  "activeJobs",
  "queuedJobs",
  "durationMs",
  "errorCode",
  "processExitCode",
];

// Validate LOG_LEVEL at startup
const rawLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
const validLevels = Object.keys(LOG_LEVELS);
if (rawLevel && !validLevels.includes(rawLevel)) {
  console.warn(`[Logger] Invalid LOG_LEVEL '${process.env.LOG_LEVEL}'. Falling back to 'info'.`);
}

function getLogLevel(): number {
  const envLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : 2;
}

export function redactString(str: string): string {
  if (!str) return str;
  let redacted = str;

  // 1. Redact local absolute paths (e.g., /tmp/coachclip, /app/applet/...)
  redacted = redacted.replace(/(?:\/[a-zA-Z0-9_\.\-]+){2,}/g, "[REDACTED_PATH]");

  // 2. Redact original videofilnavne (e.g. video_name.mp4 or clip.mov)
  redacted = redacted.replace(/\b[a-zA-Z0-9_\-\.]+\.(mp4|mov|avi|mkv)\b/gi, "[REDACTED_FILE]");

  // 3. Redact tokens / secrets (e.g. Bearer xyz, token=abc)
  redacted = redacted.replace(/token=[a-zA-Z0-9_\-\.\:\+]+/gi, "token=[REDACTED_SECRET]");
  redacted = redacted.replace(/bearer\s+[a-zA-Z0-9_\-\.\:\+]+/gi, "Bearer [REDACTED_SECRET]");

  // 4. Redact annotation text patterns
  redacted = redacted.replace(/"text"\s*:\s*"[^"]*"/gi, '"text":"[REDACTED_TEXT]"');
  redacted = redacted.replace(/'text'\s*:\s*'[^']*'/gi, "'text':'[REDACTED_TEXT]'");

  // 5. Redact entire FFmpeg commands (e.g. containing ffmpeg -i ...)
  if (redacted.toLowerCase().includes("ffmpeg") && redacted.toLowerCase().includes("-i")) {
    redacted = "[REDACTED_FFMPEG_COMMAND]";
  }

  return redacted;
}

function sanitizeValue(key: string, val: unknown): unknown {
  if (typeof val === "string") {
    return redactString(val);
  }
  return val;
}

export class Logger {
  private context?: string;
  private jobId?: string;

  constructor(context?: string, jobId?: string) {
    this.context = context;
    this.jobId = jobId;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    if (LOG_LEVELS[level] <= getLogLevel()) {
      const timestamp = new Date().toISOString();
      const isProd = process.env.NODE_ENV === "production";
      let jobId = this.jobId;

      // Extract metadata or allowed keys from args
      const meta: Record<string, unknown> = {};
      for (const arg of args) {
        if (arg && typeof arg === "object") {
          const record = arg as Record<string, unknown>;
          for (const key of ALLOWED_KEYS) {
            if (record[key] !== undefined) {
              meta[key] = record[key];
            }
          }
          if (!jobId && typeof record.jobId === "string") {
            jobId = record.jobId;
          }
        }
      }

      const redactedMessage = redactString(message);

      if (isProd) {
        const logObj: Record<string, unknown> = {
          timestamp,
          level,
          event: redactedMessage,
        };
        if (jobId) logObj.jobId = jobId;

        for (const key of ALLOWED_KEYS) {
          if (meta[key] !== undefined && key !== "timestamp" && key !== "level" && key !== "event") {
            logObj[key] = sanitizeValue(key, meta[key]);
          }
        }

        console.log(JSON.stringify(logObj));
      } else {
        const levelTag = level.toUpperCase().padEnd(5);
        const contextPart = this.context ? `[${this.context}]` : "";
        const jobPart = jobId ? `[Job ${jobId}]` : "";
        const prefixStr = (contextPart || jobPart) ? ` ${contextPart}${jobPart}` : "";
        console.log(`[${timestamp}] [${levelTag}]${prefixStr}: ${redactedMessage}`, ...args);
      }
    }
  }

  public error(message: string, ...args: unknown[]) {
    this.log("error", message, ...args);
  }

  public warn(message: string, ...args: unknown[]) {
    this.log("warn", message, ...args);
  }

  public info(message: string, ...args: unknown[]) {
    this.log("info", message, ...args);
  }

  public debug(message: string, ...args: unknown[]) {
    this.log("debug", message, ...args);
  }
}

export const logger = new Logger("CoachClip");
