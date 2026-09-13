import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { checkRateLimit, createRateLimiter, RateLimitStore } from "../src/middleware/rateLimiter";
import { config } from "../src/config";
import { EXPORT_POLL_INTERVAL_MS } from "../../shared/exportJob";

describe("Rate Limiting & Retry-After", () => {
  const WINDOW_MS = 60000;

  it("should allow requests under the limit", () => {
    const store: RateLimitStore = new Map();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(store, "general_127.0.0.1", 100, WINDOW_MS, now).allowed).toBe(true);
    }
  });

  it("should reject requests exceeding the limit and report seconds until reset", () => {
    const store: RateLimitStore = new Map();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(store, "exports_create_127.0.0.1", 5, WINDOW_MS, now).allowed).toBe(true);
    }

    const blocked = checkRateLimit(store, "exports_create_127.0.0.1", 5, WINDOW_MS, now);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("should reset the window after its duration expires", () => {
    const store: RateLimitStore = new Map();
    const start = Date.now();
    for (let i = 0; i < 6; i++) {
      checkRateLimit(store, "k", 5, WINDOW_MS, start);
    }
    expect(checkRateLimit(store, "k", 5, WINDOW_MS, start).allowed).toBe(false);
    expect(checkRateLimit(store, "k", 5, WINDOW_MS, start + 61000).allowed).toBe(true);
  });

  it("should count keys independently", () => {
    const store: RateLimitStore = new Map();
    const now = Date.now();
    checkRateLimit(store, "a", 1, WINDOW_MS, now);
    expect(checkRateLimit(store, "a", 1, WINDOW_MS, now).allowed).toBe(false);
    expect(checkRateLimit(store, "b", 1, WINDOW_MS, now).allowed).toBe(true);
  });

  it("middleware should call next under the limit and answer 429 with Retry-After over it", () => {
    const limiter = createRateLimiter({
      store: new Map(),
      keyPrefix: "general",
      maxRequests: 1,
      windowMs: WINDOW_MS,
      message: (s) => `Prøv igen om ${s} sekunder.`,
      now: () => 1_000_000,
    });
    const req = { ip: "10.0.0.1", headers: {} } as unknown as Request;
    const setHeader = vi.fn();
    const json = vi.fn();
    const status = vi.fn();
    const res = { setHeader, status, json } as unknown as Response;
    status.mockReturnValue(res);
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: "TOO_MANY_REQUESTS", message: "Prøv igen om 60 sekunder." });
  });

  it("default limits should allow polling two exports at once from the same IP", () => {
    const pollsPerMinutePerExport = Math.ceil(60000 / EXPORT_POLL_INTERVAL_MS);
    const generalPerMinute = config.rateLimitGeneral / (config.rateLimitGeneralWindowSeconds / 60);
    const statusPerMinute = config.rateLimitStatus / (config.rateLimitStatusWindowSeconds / 60);

    expect(generalPerMinute).toBeGreaterThanOrEqual(2 * pollsPerMinutePerExport);
    expect(statusPerMinute).toBeGreaterThanOrEqual(2 * pollsPerMinutePerExport);
  });
});
