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
  ffmpegTimeoutSeconds: number;
  corsOrigin: string;
  exportApiUrl?: string;
  e2eProcessingDelayMs: number;
  rateLimitExportCreate: number;
  rateLimitExportCreateWindowSeconds: number;
  rateLimitStatus: number;
  rateLimitStatusWindowSeconds: number;
  rateLimitDownload: number;
  rateLimitDownloadWindowSeconds: number;
  shutdownGracePeriodSeconds: number;
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
  ffmpegTimeoutSeconds: Number(getEnv("FFMPEG_TIMEOUT_SECONDS", "600")),
  corsOrigin: getEnv("CORS_ORIGIN", "*"),
  exportApiUrl: process.env.VITE_EXPORT_API_URL,
  e2eProcessingDelayMs: Number(getEnv("E2E_PROCESSING_DELAY_MS", "0")),
  rateLimitExportCreate: Number(getEnv("RATE_LIMIT_EXPORT_CREATE", "5")),
  rateLimitExportCreateWindowSeconds: Number(getEnv("RATE_LIMIT_EXPORT_CREATE_WINDOW_SECONDS", "600")),
  rateLimitStatus: Number(getEnv("RATE_LIMIT_STATUS", "180")),
  rateLimitStatusWindowSeconds: Number(getEnv("RATE_LIMIT_STATUS_WINDOW_SECONDS", "60")),
  rateLimitDownload: Number(getEnv("RATE_LIMIT_DOWNLOAD", "20")),
  rateLimitDownloadWindowSeconds: Number(getEnv("RATE_LIMIT_DOWNLOAD_WINDOW_SECONDS", "3600")),
  shutdownGracePeriodSeconds: Number(getEnv("SHUTDOWN_GRACE_PERIOD_SECONDS", "30"))
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
  if (isNaN(config.ffmpegTimeoutSeconds) || config.ffmpegTimeoutSeconds <= 0) {
    throw new Error("INVALID_CONFIG: FFMPEG_TIMEOUT_SECONDS must be a positive number");
  }
  if (isNaN(config.rateLimitExportCreate) || config.rateLimitExportCreate <= 0) {
    throw new Error("INVALID_CONFIG: RATE_LIMIT_EXPORT_CREATE must be a positive number");
  }
  if (isNaN(config.rateLimitExportCreateWindowSeconds) || config.rateLimitExportCreateWindowSeconds <= 0) {
    throw new Error("INVALID_CONFIG: RATE_LIMIT_EXPORT_CREATE_WINDOW_SECONDS must be a positive number");
  }
  if (isNaN(config.rateLimitStatus) || config.rateLimitStatus <= 0) {
    throw new Error("INVALID_CONFIG: RATE_LIMIT_STATUS must be a positive number");
  }
  if (isNaN(config.rateLimitStatusWindowSeconds) || config.rateLimitStatusWindowSeconds <= 0) {
    throw new Error("INVALID_CONFIG: RATE_LIMIT_STATUS_WINDOW_SECONDS must be a positive number");
  }
  if (isNaN(config.rateLimitDownload) || config.rateLimitDownload <= 0) {
    throw new Error("INVALID_CONFIG: RATE_LIMIT_DOWNLOAD must be a positive number");
  }
  if (isNaN(config.rateLimitDownloadWindowSeconds) || config.rateLimitDownloadWindowSeconds <= 0) {
    throw new Error("INVALID_CONFIG: RATE_LIMIT_DOWNLOAD_WINDOW_SECONDS must be a positive number");
  }
  if (isNaN(config.shutdownGracePeriodSeconds) || config.shutdownGracePeriodSeconds <= 0) {
    throw new Error("INVALID_CONFIG: SHUTDOWN_GRACE_PERIOD_SECONDS must be a positive number");
  }
  if (process.env.NODE_ENV === "production" && config.e2eProcessingDelayMs > 0 && process.env.IS_E2E !== "true" && process.env.E2E_TEST_MODE !== "true") {
    throw new Error("INVALID_CONFIG: E2E_PROCESSING_DELAY_MS must be 0 in production mode");
  }
  if (process.env.NODE_ENV === "production" && (!config.corsOrigin || config.corsOrigin === "*")) {
    throw new Error("INVALID_CONFIG: CORS_ORIGIN must be explicitly set and cannot be '*' in production mode");
  }
}
