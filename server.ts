/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { execSync } from "child_process";
import { createServer as createViteServer } from "vite";
import { exportRouter } from "./server/src/routes/exportRoutes";
import { FileCleanupService } from "./server/src/services/fileCleanupService";
import { config, validateConfig } from "./server/src/config";

async function startServer() {
  // Validate configuration before starting
  validateConfig();

  const app = express();
  const PORT = config.port;

  // Initialize background temp file cleanup task (clean files older than configured minutes)
  FileCleanupService.initialize(config.tempDir, config.outputTtlMinutes);

  // Parse JSON payloads safely
  app.use(express.json());

  // Mount API endpoints FIRST
  app.use("/api/exports", exportRouter);

  app.get("/api/health", (req, res) => {
    let ffmpegOk = false;
    let ffprobeOk = false;
    let ffmpegVersion = "unknown";
    
    try {
      const out = execSync("ffmpeg -version").toString();
      ffmpegOk = true;
      ffmpegVersion = out.split("\n")[0] || "unknown";
    } catch (e) {
      console.error("FFmpeg healthcheck failed:", e);
    }

    try {
      execSync("ffprobe -version");
      ffprobeOk = true;
    } catch (e) {
      console.error("FFprobe healthcheck failed:", e);
    }

    res.json({
      status: "ok",
      ffmpeg: ffmpegOk,
      ffprobe: ffprobeOk,
      version: ffmpegVersion,
      service: "CoachClip MVP Renderer"
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CoachClip Server] Up and running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical failure during full-stack server boot:", err);
});
