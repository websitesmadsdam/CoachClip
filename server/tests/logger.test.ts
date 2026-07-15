import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, redactString } from "../src/utils/logger";

describe("Logger Utility Tests", () => {
  let consoleSpy: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("should output logs when log level is appropriate", () => {
    process.env.LOG_LEVEL = "debug";
    const logger = new Logger("TestCtx", "test-job-id");

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(consoleSpy).toHaveBeenCalledTimes(4);
    expect(consoleSpy.mock.calls[0][0]).toContain("[DEBUG] [TestCtx][Job test-job-id]: debug message");
    expect(consoleSpy.mock.calls[1][0]).toContain("[INFO ] [TestCtx][Job test-job-id]: info message");
  });

  it("should respect LOG_LEVEL configuration and suppress higher severity logs", () => {
    process.env.LOG_LEVEL = "warn";
    const logger = new Logger("TestCtx");

    logger.debug("debug message"); // suppressed
    logger.info("info message");   // suppressed
    logger.warn("warn message");   // shown
    logger.error("error message"); // shown

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain("[WARN ] [TestCtx]: warn message");
    expect(consoleSpy.mock.calls[1][0]).toContain("[ERROR] [TestCtx]: error message");
  });

  describe("Redaction & Privacy Features", () => {
    it("should redact absolute local paths from logs", () => {
      const pathMessage = "Input video path is /app/applet/tmp/exports/source.mp4 and temp is /tmp/coachclip/job_123";
      const result = redactString(pathMessage);
      
      expect(result).not.toContain("/app/applet");
      expect(result).not.toContain("/tmp/coachclip");
      expect(result).toContain("[REDACTED_PATH]");
    });

    it("should redact video file names from logs", () => {
      const filenameMessage = "Finished processing raw_footage_2026.mp4 into final_cut.mov";
      const result = redactString(filenameMessage);
      
      expect(result).not.toContain("raw_footage_2026.mp4");
      expect(result).not.toContain("final_cut.mov");
      expect(result).toContain("[REDACTED_FILE]");
    });

    it("should redact tokens and bearer authorization from logs", () => {
      const authMessage = "Connecting with token=abcdef123456 and authorization bearer token_xyz123";
      const result = redactString(authMessage);
      
      expect(result).not.toContain("abcdef123456");
      expect(result).not.toContain("token_xyz123");
      expect(result).toContain("token=[REDACTED_SECRET]");
      expect(result).toContain("Bearer [REDACTED_SECRET]");
    });

    it("should redact annotation text from logs", () => {
      const annotationMessage = 'Found annotation {"type": "text", "text": "Tactical Analysis for Team A"}';
      const result = redactString(annotationMessage);
      
      expect(result).not.toContain("Tactical Analysis for Team A");
      expect(result).toContain('"text":"[REDACTED_TEXT]"');
    });

    it("should redact entire FFmpeg command strings to prevent leakage of paths and filenames", () => {
      const commandMessage = "Executing command: ffmpeg -i /tmp/input.mp4 -vf scale=640:360 /tmp/output.mp4";
      const result = redactString(commandMessage);
      
      expect(result).toBe("[REDACTED_FFMPEG_COMMAND]");
    });

    it("should produce structured JSON in production mode containing only allowed fields", () => {
      process.env.NODE_ENV = "production";
      process.env.LOG_LEVEL = "info";
      
      const logger = new Logger("ProdCtx", "prod-job-123");
      logger.info("Process completed successfully", {
        status: "completed",
        stage: "finalizing",
        durationMs: 4500,
        unallowedSecretKey: "supersecretvalue",
        unallowedCommand: "ffmpeg -i input.mp4"
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
      
      expect(logOutput).toHaveProperty("timestamp");
      expect(logOutput.level).toBe("info");
      expect(logOutput.event).toBe("Process completed successfully");
      expect(logOutput.jobId).toBe("prod-job-123");
      expect(logOutput.status).toBe("completed");
      expect(logOutput.stage).toBe("finalizing");
      expect(logOutput.durationMs).toBe(4500);
      
      // Verify unallowed fields are stripped entirely from the production log object
      expect(logOutput).not.toHaveProperty("unallowedSecretKey");
      expect(logOutput).not.toHaveProperty("unallowedCommand");
    });
  });
});
