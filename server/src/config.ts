/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";

export type AppConfig = {
  port: number;
  tempDir: string;
  outputTtlMinutes: number;
  maxUploadBytes: number;
  maxClipDurationSeconds: number;
  corsOrigin: string;
  exportApiUrl?: string;
};

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: AppConfig = {
  port: Number(getEnv("PORT", "3000")),
  tempDir: path.resolve(getEnv("TEMP_DIR", "./tmp")),
  outputTtlMinutes: Number(getEnv("OUTPUT_TTL_MINUTES", "60")),
  maxUploadBytes: Number(getEnv("MAX_UPLOAD_BYTES", String(2 * 1024 * 1024 * 1024))), // 2 GB
  maxClipDurationSeconds: Number(getEnv("MAX_CLIP_DURATION_SECONDS", "90")), // 90s
  corsOrigin: getEnv("CORS_ORIGIN", "*"),
  exportApiUrl: process.env.VITE_EXPORT_API_URL
};

export function validateConfig() {
  if (isNaN(config.port)) {
    throw new Error("INVALID_CONFIG: PORT must be a number");
  }
  if (isNaN(config.outputTtlMinutes) || config.outputTtlMinutes <= 0) {
    throw new Error("INVALID_CONFIG: OUTPUT_TTL_MINUTES must be a positive number");
  }
  if (isNaN(config.maxUploadBytes) || config.maxUploadBytes <= 0) {
    throw new Error("INVALID_CONFIG: MAX_UPLOAD_BYTES must be a positive number");
  }
  if (isNaN(config.maxClipDurationSeconds) || config.maxClipDurationSeconds <= 0) {
    throw new Error("INVALID_CONFIG: MAX_CLIP_DURATION_SECONDS must be a positive number");
  }
}
