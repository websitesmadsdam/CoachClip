/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { exportRouter } from "./server/src/routes/exportRoutes";
import { FileCleanupService } from "./server/src/services/fileCleanupService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize background temp file cleanup task (clean files older than 60 minutes)
  const tempDir = process.env.TEMP_DIR || "./tmp";
  const ttlMinutes = Number(process.env.OUTPUT_TTL_MINUTES || "60");
  FileCleanupService.initialize(tempDir, ttlMinutes);

  // Parse JSON payloads safely
  app.use(express.json());

  // Mount API endpoints FIRST
  app.use("/api/exports", exportRouter);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "CoachClip MVP Renderer" });
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
    
    // SPA fallback: render index.html for other paths
    app.get("*", (req, res) => {
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
