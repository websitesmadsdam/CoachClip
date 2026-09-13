/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { exec, execSync } from "child_process";
import { createServer as createViteServer } from "vite";
import { exportRouter } from "./server/src/routes/exportRoutes";
import { FileCleanupService } from "./server/src/services/fileCleanupService";
import { config, validateConfig } from "./server/src/config";
import { exportQueue } from "./server/src/services/exportQueue";
import { logger } from "./server/src/utils/logger";
import { createRateLimiter, RateLimitStore } from "./server/src/middleware/rateLimiter";

// Helper for non-blocking disk space probe
function getFreeDiskSpace(): Promise<string> {
  return new Promise((resolve) => {
    exec("df -h /", (err, stdout) => {
      if (err || !stdout) {
        resolve("unknown");
        return;
      }
      const lines = stdout.trim().split("\n");
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        if (parts.length > 3) {
          resolve(parts[3]);
          return;
        }
      }
      resolve("unknown");
    });
  });
}

// Helper for non-blocking directory writability check
async function isTempWritableAsync(tempDir: string): Promise<boolean> {
  try {
    const testFile = path.join(tempDir, `.write-test-${Date.now()}`);
    await fs.promises.writeFile(testFile, "test");
    await fs.promises.unlink(testFile);
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  // Validate configuration before starting
  validateConfig();

  // Validate ffmpeg and ffprobe presence on startup (blocking only once on boot)
  let ffmpegAvailable = false;
  let ffprobeAvailable = false;

  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    ffmpegAvailable = true;
  } catch (e) {
    logger.error("FFmpeg startup validation failed:", e);
  }

  try {
    execSync("ffprobe -version", { stdio: "ignore" });
    ffprobeAvailable = true;
  } catch (e) {
    logger.error("FFprobe startup validation failed:", e);
  }

  const app = express();
  const PORT = config.port;

  // Initialize background temp file cleanup task (clean files older than configured minutes)
  FileCleanupService.initialize(config.tempDir, config.outputTtlMinutes);

  // Parse JSON payloads safely
  app.use(express.json());

  // Custom Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'"
    );
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // Custom CORS Middleware
  app.use((req, res, next) => {
    const allowedOrigin = config.corsOrigin || "*";
    const requestOrigin = req.headers.origin;

    if (allowedOrigin === "*") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (requestOrigin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    } else {
      // Unknown or non-matching origin: do not set Access-Control-Allow-Origin header
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Fixed-window rate limiting; all limits come from config
  const rateLimitStore: RateLimitStore = new Map();

  const generalLimiter = createRateLimiter({
    store: rateLimitStore,
    keyPrefix: "general",
    maxRequests: config.rateLimitGeneral,
    windowMs: config.rateLimitGeneralWindowSeconds * 1000,
    message: (s) => `Du har sendt for mange anmodninger. Prøv igen om ${s} sekunder.`,
  });

  const exportsCreateLimiter = createRateLimiter({
    store: rateLimitStore,
    keyPrefix: "exports_create",
    maxRequests: config.rateLimitExportCreate,
    windowMs: config.rateLimitExportCreateWindowSeconds * 1000,
    message: (s) => `Du har oprettet for mange eksporter. Prøv igen om ${s} sekunder.`,
  });

  const exportsStatusLimiter = createRateLimiter({
    store: rateLimitStore,
    keyPrefix: "exports_status",
    maxRequests: config.rateLimitStatus,
    windowMs: config.rateLimitStatusWindowSeconds * 1000,
    message: (s) => `Du har foretaget for mange statusforespørgsler. Prøv igen om ${s} sekunder.`,
  });

  const exportsDownloadLimiter = createRateLimiter({
    store: rateLimitStore,
    keyPrefix: "exports_download",
    maxRequests: config.rateLimitDownload,
    windowMs: config.rateLimitDownloadWindowSeconds * 1000,
    message: (s) => `Du har foretaget for mange downloads. Prøv igen om ${s} sekunder.`,
  });

  // Mount rate limiters
  app.use("/api/", generalLimiter);
  app.post("/api/exports", exportsCreateLimiter);
  app.get("/api/exports/:jobId", exportsStatusLimiter);
  app.get("/api/exports/:jobId/download", exportsDownloadLimiter);

  // Mount API endpoints FIRST
  app.use("/api/exports", exportRouter);

  let isShuttingDown = false;

  app.get("/api/live", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ready", async (req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: "shutting_down", message: "Server is shutting down cleanly." });
      return;
    }
    const tempWritable = await isTempWritableAsync(config.tempDir);

    if (ffmpegAvailable && ffprobeAvailable && tempWritable) {
      res.json({
        status: "ready",
        ffmpeg: true,
        ffprobe: true,
        tempDirectoryWritable: true
      });
    } else {
      res.status(500).json({
        status: "not_ready",
        ffmpeg: ffmpegAvailable,
        ffprobe: ffprobeAvailable,
        tempDirectoryWritable: tempWritable
      });
    }
  });

  app.get("/api/health", async (req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: "shutting_down", message: "Server is shutting down cleanly." });
      return;
    }
    const tempWritable = await isTempWritableAsync(config.tempDir);
    const freeDisk = await getFreeDiskSpace();
    const freeMemBytes = os.freemem();
    const totalMemBytes = os.totalmem();

    res.json({
      status: "ok",
      ffmpeg: ffmpegAvailable,
      ffprobe: ffprobeAvailable,
      tempDirectoryWritable: tempWritable,
      activeJobs: exportQueue.getActiveCount(),
      queuedJobs: exportQueue.getQueuedCount(),
      system: {
        freeMemory: Math.round(freeMemBytes / (1024 * 1024)) + " MB",
        totalMemory: Math.round(totalMemBytes / (1024 * 1024)) + " MB",
        freeDiskSpace: freeDisk
      }
    });
  });

  // Explicit fallback for any unhandled /api/ paths to avoid returning index.html
  app.all("/api/*all", (req, res) => {
    res.status(404).json({
      error: "NOT_FOUND",
      message: "API-ressourcen blev ikke fundet."
    });
  });

  // Serve static assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    logger.info("Starting full-stack server in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    logger.info("Starting full-stack server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files from the build output directory
    app.use(express.static(distPath));
    
    // SPA fallback: render index.html for other paths (using Express 5 *all named wildcard)
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`[CoachClip Server] Up and running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.warn(`[CoachClip Server] Received ${signal}. Starting graceful shutdown...`);

    // 1. Tell exportQueue to stop accepting/processing new jobs
    exportQueue.stopNewJobs();

    // 2. Stop accepting new HTTP connections
    server.close(() => {
      logger.info("[CoachClip Server] HTTP server closed.");
    });

    // 3. Set a fallback force-exit timeout
    const forceExitTimeout = setTimeout(() => {
      logger.error("[CoachClip Server] Force shutdown timeout reached. Exiting with failure.");
      process.exit(1);
    }, config.shutdownGracePeriodSeconds * 1000);

    // 4. Wait for active jobs to finish
    logger.info(`[CoachClip Server] Waiting for active export jobs to complete. Active count: ${exportQueue.getActiveCount()}`);
    while (exportQueue.getActiveCount() > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    logger.info("[CoachClip Server] All active export jobs completed.");

    clearTimeout(forceExitTimeout);
    logger.info("[CoachClip Server] Graceful shutdown completed. Exiting cleanly.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error("Critical failure during full-stack server boot:", err);
});
