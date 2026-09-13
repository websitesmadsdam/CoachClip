/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from "express";

export type RateLimitStore = Map<string, { count: number; resetTime: number }>;

// retryAfterSeconds is 0 when allowed
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

// Fixed-window counter per key
export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number
): RateLimitResult {
  const rateData = store.get(key);
  if (!rateData || now > rateData.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  rateData.count++;
  if (rateData.count > maxRequests) {
    return { allowed: false, retryAfterSeconds: Math.ceil((rateData.resetTime - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export type RateLimiterOptions = {
  store: RateLimitStore;
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  // Danish, trainer-facing message
  message: (secondsLeft: number) => string;
  now?: () => number;
};

export function createRateLimiter(options: RateLimiterOptions) {
  const { store, keyPrefix, maxRequests, windowMs, message, now = Date.now } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = `${keyPrefix}_${Array.isArray(ip) ? ip[0] : ip}`;
    const result = checkRateLimit(store, key, maxRequests, windowMs, now());

    if (result.allowed) {
      next();
      return;
    }

    res.setHeader("Retry-After", result.retryAfterSeconds.toString());
    res.status(429).json({
      error: "TOO_MANY_REQUESTS",
      message: message(result.retryAfterSeconds),
    });
  };
}
