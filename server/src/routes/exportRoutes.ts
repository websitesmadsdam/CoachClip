/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { exportJobService } from "../services/exportJobService";
import { FfmpegExportService } from "../services/ffmpegExportService";
import { ExportRequestMetadata } from "../types/exportTypes";

export const exportRouter = Router();

// Configure safe local storage engine with randomized filenames
const TEMP_DIR = process.env.TEMP_DIR || "./tmp";
const uploadsDir = path.join(TEMP_DIR, "uploads");
const exportsDir = path.join(TEMP_DIR, "exports");

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(exportsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const secureId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${secureId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB limit
  },
});

// Helper for relative url origin
const getOrigin = (req: Request) => {
  const forwardedHost = req.headers["x-forwarded-host"] as string;
  const host = forwardedHost || req.headers.host || "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${protocol}://${host}`;
};

// 1. Create Export Job Endpoint
exportRouter.post("/", upload.single("video"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const file = req.file;
  const metadataStr = req.body.metadata;

  if (!file) {
    res.status(400).json({ error: "MISSING_FILE", message: "Ingen videofil blev uploadet." });
    return;
  }

  if (!metadataStr) {
    // Delete file immediately if metadata is missing
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "MISSING_METADATA", message: "Projektdetaljer og metadata mangler." });
    return;
  }

  let metadata: ExportRequestMetadata;
  try {
    metadata = JSON.parse(metadataStr);
  } catch (err) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "INVALID_METADATA", message: "Kunne ikke læse projektets metadata-format." });
    return;
  }

  // Validate clip duration limit (max 90s)
  const clipDuration = metadata.clip.endTime - metadata.clip.startTime;
  if (clipDuration > 90) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "CLIP_TOO_LONG",
      message: "Det valgte klip kan højst være 90 sekunder i denne version.",
    });
    return;
  }

  // Validate file size limit (max 2 GB)
  if (file.size > 2 * 1024 * 1024 * 1024) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "FILE_TOO_LARGE",
      message: "Videofilen er større end de 2 GB, som CoachClip understøtter i denne version.",
    });
    return;
  }

  // Validate file extension (must be mp4 or mov)
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".mp4" && ext !== ".mov") {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "UNSUPPORTED_FORMAT",
      message: "Videoen kunne ikke behandles. Prøv en MP4- eller MOV-video med H.264- eller HEVC-video.",
    });
    return;
  }

  const jobId = crypto.randomUUID();
  const outputFileName = `${jobId}_output.mp4`;
  const outputFilePath = path.join(exportsDir, outputFileName);

  // Register job
  const job = exportJobService.createJob(jobId, metadata.projectId);
  exportJobService.updateJob(jobId, {
    inputFilePath: file.path,
    outputFilePath,
  });

  // Start processing asynchronously in background
  FfmpegExportService.executeExport(jobId, metadata, file.path, outputFilePath, TEMP_DIR)
    .catch((err) => {
      console.error(`Export Job ${jobId} failed inside Express router:`, err);
    });

  // Respond immediately with jobId & queued status
  res.status(201).json({
    jobId,
    status: "queued",
  });
});

// 2. Query Export Job Status Endpoint
exportRouter.get("/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = exportJobService.getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "NOT_FOUND", message: "Eksportjobbet blev ikke fundet." });
    return;
  }

  // If completed, update downloadUrl dynamically to include current host origin
  if (job.status === "completed" && job.output) {
    const origin = getOrigin(req);
    res.json({
      ...job,
      output: {
        ...job.output,
        downloadUrl: `${origin}${job.output.downloadUrl}`,
      },
    });
    return;
  }

  res.json(job);
});

// 3. Download Processed Video Endpoint
exportRouter.get("/:jobId/download", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = exportJobService.getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "NOT_FOUND", message: "Eksportjobbet blev ikke fundet." });
    return;
  }

  if (job.status === "expired" || !job.outputFilePath || !fs.existsSync(job.outputFilePath)) {
    res.status(410).json({
      error: "EXPIRED",
      message: "Den færdige videofil er udløbet og er blevet slettet. Eksportér projektet igen.",
    });
    return;
  }

  if (job.status !== "completed") {
    res.status(400).json({ error: "PROCESSING", message: "Videoen er ikke færdigbehandlet endnu." });
    return;
  }

  const normalizedFileName = (job.output?.fileName || "coachclip_export.mp4")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "oe")
    .replace(/[åÅ]/g, "aa")
    .replace(/[^a-zA-Z0-9_.-]/g, "_");

  res.download(job.outputFilePath, normalizedFileName, (err) => {
    if (err) {
      console.error(`Error sending download stream for job ${jobId}:`, err);
    }
  });
});

// 4. Cancel/Delete Export Job Endpoint
exportRouter.delete("/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = exportJobService.getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "NOT_FOUND", message: "Eksportjobbet blev ikke fundet." });
    return;
  }

  // Delete associated files
  if (job.inputFilePath && fs.existsSync(job.inputFilePath)) {
    try {
      fs.unlinkSync(job.inputFilePath);
    } catch (e) {
      console.error("Cleanup error during cancel:", e);
    }
  }
  if (job.outputFilePath && fs.existsSync(job.outputFilePath)) {
    try {
      fs.unlinkSync(job.outputFilePath);
    } catch (e) {
      console.error("Cleanup error during cancel:", e);
    }
  }

  exportJobService.updateJob(jobId, { status: "cancelled" });
  res.json({ jobId, status: "cancelled", message: "Eksporten blev afbrudt." });
});
