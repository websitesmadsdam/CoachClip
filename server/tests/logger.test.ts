import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../src/utils/logger";

describe("Logger Utility Tests", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
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
});
