/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { config, validateConfig } from "../src/config";

describe("Production Config Validation Regression Tests", () => {
  let originalNodeEnv: string | undefined;
  let originalCorsOrigin: string;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalCorsOrigin = config.corsOrigin;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    config.corsOrigin = originalCorsOrigin;
  });

  it("should reject an invalid production configuration (NODE_ENV=production, CORS_ORIGIN=*)", () => {
    process.env.NODE_ENV = "production";
    config.corsOrigin = "*";

    expect(() => validateConfig()).toThrowError(
      /CORS_ORIGIN must be explicitly set and cannot be '\*' in production mode/
    );
  });

  it("should reject an invalid production configuration with empty CORS_ORIGIN", () => {
    process.env.NODE_ENV = "production";
    config.corsOrigin = "";

    expect(() => validateConfig()).toThrowError(
      /CORS_ORIGIN must be explicitly set and cannot be '\*' in production mode/
    );
  });

  it("should accept a valid production configuration (NODE_ENV=production, CORS_ORIGIN=http://127.0.0.1:3009)", () => {
    process.env.NODE_ENV = "production";
    config.corsOrigin = "http://127.0.0.1:3009";

    expect(() => validateConfig()).not.toThrow();
  });
});
