import { describe, it, expect, beforeEach } from "vitest";

// Replicate rate limiting logic to test it in isolation
describe("Rate Limiting & Retry-After", () => {
  let rateLimitMap: Map<string, { count: number; resetTime: number }>;

  beforeEach(() => {
    rateLimitMap = new Map();
  });

  const runLimiter = (
    ip: string,
    keyPrefix: string,
    maxRequests: number,
    windowMs: number,
    now: number
  ) => {
    const ipKey = `${keyPrefix}_${ip}`;
    const rateData = rateLimitMap.get(ipKey);

    if (!rateData || now > rateData.resetTime) {
      rateLimitMap.set(ipKey, { count: 1, resetTime: now + windowMs });
      return { allowed: true };
    } else {
      rateData.count++;
      if (rateData.count > maxRequests) {
        const secondsLeft = Math.ceil((rateData.resetTime - now) / 1000);
        return { allowed: false, retryAfter: secondsLeft };
      } else {
        return { allowed: true };
      }
    }
  };

  it("should allow requests under the limit", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const res = runLimiter("127.0.0.1", "general", 100, 60000, now);
      expect(res.allowed).toBe(true);
    }
  });

  it("should reject requests exceeding general limit and set retryAfter", () => {
    const now = Date.now();
    // General limit of 100
    for (let i = 0; i < 100; i++) {
      const res = runLimiter("127.0.0.1", "general", 100, 60000, now);
      expect(res.allowed).toBe(true);
    }

    const blockedRes = runLimiter("127.0.0.1", "general", 100, 60000, now);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.retryAfter).toBe(60); // 60 seconds left
  });

  it("should reject requests exceeding exports create limit and set retryAfter", () => {
    const now = Date.now();
    // Export limit is 5
    for (let i = 0; i < 5; i++) {
      const res = runLimiter("127.0.0.1", "exports_create", 5, 60000, now);
      expect(res.allowed).toBe(true);
    }

    const blockedRes = runLimiter("127.0.0.1", "exports_create", 5, 60000, now);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.retryAfter).toBe(60); // 60 seconds left
  });

  it("should reset rate limit window after window duration expires", () => {
    const start = Date.now();
    
    // Fill up to limit
    for (let i = 0; i < 5; i++) {
      runLimiter("127.0.0.1", "exports_create", 5, 60000, start);
    }

    // Exceeded at same time window
    const blockedRes = runLimiter("127.0.0.1", "exports_create", 5, 60000, start);
    expect(blockedRes.allowed).toBe(false);

    // After 61 seconds (beyond window)
    const later = start + 61000;
    const allowedRes = runLimiter("127.0.0.1", "exports_create", 5, 60000, later);
    expect(allowedRes.allowed).toBe(true);
  });
});
