/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { createServer as createViteServer } from "vite";
import { exportRouter } from "./server/src/routes/exportRoutes";
import { FileCleanupService } from "./server/src/services/fileCleanupService";
import { config, validateConfig } from "./server/src/config";
import { exportQueue } from "./server/src/services/exportQueue";

async function startServer() {
  // Validate configuration before starting
  validateConfig();

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
    const origin = config.corsOrigin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Custom sliding-window rate-limiting middleware for all API requests
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  app.use("/api/", (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const ipKey = Array.isArray(ip) ? ip[0] : ip;
    const now = Date.now();
    const windowMs = 60000;
    const maxRequests = 100; // 100 requests per minute max

    const rateData = rateLimitMap.get(ipKey);
    if (!rateData || now > rateData.resetTime) {
      rateLimitMap.set(ipKey, { count: 1, resetTime: now + windowMs });
      next();
    } else {
      rateData.count++;
      if (rateData.count > maxRequests) {
        res.status(429).json({
          error: "TOO_MANY_REQUESTS",
          message: "Du har sendt for mange anmodninger. Prøv igen om et minut."
        });
      } else {
        next();
      }
    }
  });

  // Mount API endpoints FIRST
  app.use("/api/exports", exportRouter);

  let isShuttingDown = false;

  app.get("/api/live", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ready", (req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: "shutting_down", message: "Server is shutting down cleanly." });
      return;
    }
    let ffmpegOk = false;
    let ffprobeOk = false;
    let tempWritable = false;
    
    try {
      execSync("ffmpeg -version");
      ffmpegOk = true;
    } catch (e) {
      console.error("FFmpeg readiness check failed:", e);
    }

    try {
      execSync("ffprobe -version");
      ffprobeOk = true;
    } catch (e) {
      console.error("FFprobe readiness check failed:", e);
    }

    try {
      const testFile = path.join(config.tempDir, `.write-test-${Date.now()}`);
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      tempWritable = true;
    } catch (e) {
      console.error("Temp directory readiness write check failed:", e);
    }

    if (ffmpegOk && ffprobeOk && tempWritable) {
      res.json({
        status: "ready",
        ffmpeg: true,
        ffprobe: true,
        tempDirectoryWritable: true
      });
    } else {
      res.status(500).json({
        status: "not_ready",
        ffmpeg: ffmpegOk,
        ffprobe: ffprobeOk,
        tempDirectoryWritable: tempWritable
      });
    }
  });

  app.get("/api/health", (req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: "shutting_down", message: "Server is shutting down cleanly." });
      return;
    }
    let ffmpegOk = false;
    let ffprobeOk = false;
    let tempWritable = false;
    
    try {
      execSync("ffmpeg -version");
      ffmpegOk = true;
    } catch (e) {
      console.error("FFmpeg healthcheck failed:", e);
    }

    try {
      execSync("ffprobe -version");
      ffprobeOk = true;
    } catch (e) {
      console.error("FFprobe healthcheck failed:", e);
    }

    try {
      const testFile = path.join(config.tempDir, `.write-test-${Date.now()}`);
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      tempWritable = true;
    } catch (e) {
      console.error("Temp directory write check failed:", e);
    }

    res.json({
      status: "ok",
      ffmpeg: ffmpegOk,
      ffprobe: ffprobeOk,
      tempDirectoryWritable: tempWritable,
      activeJobs: exportQueue.getActiveCount(),
      queuedJobs: exportQueue.getQueuedCount()
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
    console.log("Starting full-stack server in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting full-stack server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files from the build output directory
    app.use(express.static(distPath));
    
    // SPA fallback: render index.html for other paths (using Express 5 *all named wildcard)
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CoachClip Server] Up and running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[CoachClip Server] Received ${signal}. Starting graceful shutdown...`);

    // 1. Tell exportQueue to stop accepting/processing new jobs
    exportQueue.stopNewJobs();

    // 2. Stop accepting new HTTP connections
    server.close(() => {
      console.log("[CoachClip Server] HTTP server closed.");
    });

    // 3. Set a fallback force-exit timeout (30 seconds)
    const forceExitTimeout = setTimeout(() => {
      console.error("[CoachClip Server] Force shutdown timeout reached. Exiting with failure.");
      process.exit(1);
    }, 30000);

    // 4. Wait for active jobs to finish
    console.log(`[CoachClip Server] Waiting for active export jobs to complete. Active count: ${exportQueue.getActiveCount()}`);
    while (exportQueue.getActiveCount() > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    console.log("[CoachClip Server] All active export jobs completed.");

    clearTimeout(forceExitTimeout);
    console.log("[CoachClip Server] Graceful shutdown completed. Exiting cleanly.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Critical failure during full-stack server boot:", err);
});
