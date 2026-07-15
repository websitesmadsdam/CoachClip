/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: Express request handler contains intentional unused parameters (next, err) and raw any types for express req bodies/files.
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { exportJobService } from "../services/exportJobService";
import { FfmpegExportService } from "../services/ffmpegExportService";
import { exportQueue } from "../services/exportQueue";
import { ExportRequestMetadata } from "../types/exportTypes";

import { config } from "../config";

export const exportRouter = Router();

const uploadsDir = path.join(config.tempDir, "uploads");
const exportsDir = path.join(config.tempDir, "exports");

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
    fileSize: config.maxUploadBytes,
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
exportRouter.post("/", upload.single("video"), async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const file = req.file;

  if (!exportQueue.isAcceptingNewJobs()) {
    if (file) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    res.status(503).json({
      error: {
        code: "SERVER_SHUTTING_DOWN",
        userMessage: "CoachClip er ved at genstarte. Prøv igen om et øjeblik."
      }
    });
    return;
  }

  const metadataStr = req.body.metadata;

  if (!file) {
    res.status(400).json({ error: "MISSING_FILE", message: "Ingen videofil blev uploadet." });
    return;
  }

  if (!metadataStr) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "MISSING_METADATA", message: "Projektdetaljer og metadata mangler." });
    return;
  }

  // Enforce metadata payload size limit (safety constraint)
  if (metadataStr.length > 500 * 1024) { // 500 KB limit
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "METADATA_TOO_LARGE", message: "Metadata payload er for stor." });
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

  // Validate uploaded file size with config
  if (file.size > config.maxUploadBytes) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "FILE_TOO_LARGE",
      message: "Videofilen er større end den tilladte filstørrelse.",
    });
    return;
  }

  // Validate the video file with ffprobe to reject unreadable/corrupted files
  let videoMeta;
  try {
    videoMeta = await FfmpegExportService.getVideoDimensions(file.path);
  } catch (err) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "INVALID_VIDEO_FILE",
      message: "Videofilen kunne ikke læses af systemet. Sørg for, at det er en gyldig MP4- eller MOV-video."
    });
    return;
  }

  if (!videoMeta || videoMeta.duration <= 0 || !videoMeta.width || !videoMeta.height) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "INVALID_VIDEO_METADATA",
      message: "Videoen mangler gyldige strømme eller varighedsoplysninger."
    });
    return;
  }

  // Validate clip boundaries
  if (typeof metadata.clip?.startTime !== "number" || typeof metadata.clip?.endTime !== "number") {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "INVALID_CLIP", message: "Ugyldige klipgrænser defineret." });
    return;
  }

  const clipDuration = metadata.clip.endTime - metadata.clip.startTime;
  if (metadata.clip.startTime < 0) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "INVALID_START_TIME", message: "Starttidspunktet kan ikke være negativt." });
    return;
  }

  if (clipDuration < 0.5) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "CLIP_TOO_SHORT", message: "Det valgte klip skal være mindst 0,5 sekunder." });
    return;
  }

  if (clipDuration > config.maxClipDurationSeconds) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "CLIP_TOO_LONG",
      message: `Det valgte klip kan højst være ${config.maxClipDurationSeconds} sekunder i denne version.`,
    });
    return;
  }

  // 0.5s tolerance for end of video boundary check
  if (metadata.clip.endTime > videoMeta.duration + 0.5) {
    fs.unlinkSync(file.path);
    res.status(400).json({
      error: "INVALID_END_TIME",
      message: "Sluttidspunktet ligger ud over videoens faktiske varighed."
    });
    return;
  }

  // Validate annotations constraints
  if (!Array.isArray(metadata.annotations)) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "INVALID_ANNOTATIONS", message: "Annotationer skal leveres som et array." });
    return;
  }

  if (metadata.annotations.length > 100) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "TOO_MANY_ANNOTATIONS", message: "Der kan højst tilføjes 100 annotationer pr. klip." });
    return;
  }

  // Comprehensive freeze validation pass
  const freezeAnnos = metadata.annotations.filter((a: any) => a.type === "freeze") as any[];
  const sortedFreezes = [...freezeAnnos].sort((a: any, b: any) => a.time - b.time);
  let lastFreezeTime = -999;
  let cumulativeFreezeDur = 0;

  for (const f of sortedFreezes) {
    if (f.duration !== 2 && f.duration !== 3 && f.duration !== 5) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "INVALID_FREEZE_DURATION", message: "Varighed af frysebillede skal være 2, 3 eller 5 sekunder." });
      return;
    }
    if (f.time < metadata.clip.startTime || f.time > metadata.clip.endTime) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "INVALID_FREEZE_TIME", message: "Frysepunktet ligger uden for klippets tidsramme." });
      return;
    }
    if (Math.abs(f.time - lastFreezeTime) < 0.05) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "DUPLICATE_FREEZE", message: "To frysepunkter må ikke ligge på samme kildetidspunkt eller meget tæt på hinanden." });
      return;
    }
    lastFreezeTime = f.time;
    cumulativeFreezeDur += f.duration;
  }

  if (cumulativeFreezeDur > 30) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "TOO_MUCH_FREEZE", message: "Den samlede frysetid må højst være 30 sekunder." });
    return;
  }

  let textCount = 0;
  let svgCount = 0;
  let totalFreezeDuration = 0;

  for (const a of metadata.annotations) {
    if (!a.type) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "INVALID_ANNOTATION", message: "En annotation mangler en type." });
      return;
    }

    if (a.type === "text") {
      textCount++;
      if (typeof a.text !== "string" || a.text.length > 120) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "TEXT_TOO_LONG", message: "En tekstannotation må højst indeholde 120 tegn." });
        return;
      }
      if (a.startTime < 0 || a.endTime < a.startTime || a.startTime > metadata.clip.endTime || a.endTime < metadata.clip.startTime) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_ANNOTATION_TIME", message: "En tekstannotation har ugyldige tidsgrænser." });
        return;
      }
      if (a.x < 0 || a.x > 1 || a.y < 0 || a.y > 1) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_COORDINATES", message: "Koordinater skal være mellem 0 og 1." });
        return;
      }
    } else if (a.type === "circle") {
      svgCount++;
      if (a.startTime < 0 || a.endTime < a.startTime || a.startTime > metadata.clip.endTime || a.endTime < metadata.clip.startTime) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_ANNOTATION_TIME", message: "En cirkelannotation har ugyldige tidsgrænser." });
        return;
      }
      if (a.x < 0 || a.x > 1 || a.y < 0 || a.y > 1) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_COORDINATES", message: "Koordinater skal være mellem 0 og 1." });
        return;
      }
      if (a.radius <= 0 || a.radius > 1) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_RADIUS", message: "Radius skal være mellem 0 og 1." });
        return;
      }
    } else if (a.type === "arrow") {
      svgCount++;
      if (a.startTime < 0 || a.endTime < a.startTime || a.startTime > metadata.clip.endTime || a.endTime < metadata.clip.startTime) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_ANNOTATION_TIME", message: "En pilannotation har ugyldige tidsgrænser." });
        return;
      }
      if (a.startX < 0 || a.startX > 1 || a.startY < 0 || a.startY > 1 || a.endX < 0 || a.endX > 1 || a.endY < 0 || a.endY > 1) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_COORDINATES", message: "Pilespidskoordinater skal være mellem 0 og 1." });
        return;
      }
    } else if (a.type === "freeze") {
      if (a.time < metadata.clip.startTime || a.time > metadata.clip.endTime) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_FREEZE_TIME", message: "Frysepunktet ligger uden for klippets tidsramme." });
        return;
      }
      if (a.duration !== 2 && a.duration !== 3 && a.duration !== 5) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: "INVALID_FREEZE_DURATION", message: "Varighed af frysebillede skal være 2, 3 eller 5 sekunder." });
        return;
      }
      totalFreezeDuration += a.duration;
    } else {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "INVALID_TYPE", message: "Ugyldig annotationstype fundet." });
      return;
    }
  }

  if (textCount > 50) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "TOO_MANY_TEXTS", message: "Du kan højst tilføje 50 tekstannotationer." });
    return;
  }

  if (svgCount > 50) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "TOO_MANY_SVGS", message: "Du kan højst tilføje 50 geometriske markeringer (cirkler/pile)." });
    return;
  }

  if (totalFreezeDuration > 30) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: "TOO_MUCH_FREEZE", message: "Den samlede frysetid må højst være 30 sekunder." });
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

  // Enqueue job in our real FIFO queue
  exportQueue.enqueue(jobId, metadata.projectId, file.path, outputFilePath, metadata, config.tempDir);

  // Respond immediately with jobId & queued status
  res.status(201).json({
    jobId,
    status: "queued",
  });
});

// 2. Query Export Job Status Endpoint
exportRouter.get("/:jobId", (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  if (typeof jobId !== "string") {
    res.status(400).json({ error: "INVALID_JOB_ID", message: "Ugyldigt job ID" });
    return;
  }
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
  const jobId = req.params.jobId;
  if (typeof jobId !== "string") {
    res.status(400).json({ error: "INVALID_JOB_ID", message: "Ugyldigt job ID" });
    return;
  }
  const job = exportJobService.getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "NOT_FOUND", message: "Eksportjobbet blev ikke fundet." });
    return;
  }

  const now = Date.now();
  const expiresAt = job.expiresAt ?? (job.createdAt + config.outputTtlMinutes * 60 * 1000);

  if (job.status === "expired" || now >= expiresAt || !job.outputFilePath || !fs.existsSync(job.outputFilePath)) {
    if (job.status !== "expired") {
      exportJobService.updateJob(jobId, { status: "expired" });
    }
    res.status(410).json({
      error: {
        code: "EXPORT_EXPIRED",
        userMessage: "Eksportfilen er udløbet. Eksportér projektet igen for at oprette en ny videofil."
      }
    });
    return;
  }

  if (job.status !== "completed") {
    res.status(400).json({ error: "PROCESSING", message: "Videoen er ikke færdigbehandlet endnu." });
    return;
  }

  const downloadFileName = job.output?.fileName || "CoachClip.mp4";

  res.download(job.outputFilePath, downloadFileName, (err) => {
    if (err) {
      console.error(`Error sending download stream for job ${jobId}:`, err);
    }
  });
});

// 4. Cancel/Delete Export Job Endpoint
exportRouter.delete("/:jobId", async (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  if (typeof jobId !== "string") {
    res.status(400).json({ error: "INVALID_JOB_ID", message: "Ugyldigt job ID" });
    return;
  }
  const job = exportJobService.getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "NOT_FOUND", message: "Eksportjobbet blev ikke fundet." });
    return;
  }

  // Cancel job via exportQueue (handles both queued and active processes cleanly)
  await exportQueue.cancel(jobId);

  res.json({ jobId, status: "cancelled", message: "Eksporten blev afbrudt." });
});
