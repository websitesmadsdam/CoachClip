/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { ExportRequestMetadata } from "../types/exportTypes";
import { exportJobService } from "./exportJobService";
import { Annotation, FreezeAnnotation } from "../../../src/types";
import { getCircleGeometry, getArrowGeometry, getTextGeometry } from "../../../shared/annotationGeometry";
import { sanitizeExportFileName } from "../../../shared/exportSchema";
import { config } from "../config";

// Active FFmpeg processes map for cancellation tracking
const activeProcesses = new Map<string, import("child_process").ChildProcess>();
const cancelledJobs = new Set<string>();

// Promisified helper to run spawn securely without a shell (immune to injection)
function runProcess(command: string, args: string[], jobId?: string, timeoutSeconds?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (jobId && FfmpegExportService.isCancelled(jobId)) {
      return reject(new Error("Job cancelled"));
    }

    const proc = spawn(command, args);
    
    if (jobId) {
      activeProcesses.set(jobId, proc);
    }

    let stdout = "";
    let stderr = "";

    let timer: NodeJS.Timeout | undefined;
    const actualTimeout = timeoutSeconds ?? config.ffmpegTimeoutSeconds;
    if (actualTimeout && actualTimeout > 0) {
      timer = setTimeout(() => {
        console.error(`[runProcess] Command timed out after ${actualTimeout}s: ${command} ${args.join(" ")}`);
        proc.kill("SIGKILL");
        if (jobId) {
          activeProcesses.delete(jobId);
        }
        reject(new Error("FFMPEG_TIMEOUT"));
      }, actualTimeout * 1000);
    }

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (jobId) {
        activeProcesses.delete(jobId);
      }
      if (code === 0) {
        resolve(stdout);
      } else {
        if (jobId && FfmpegExportService.isCancelled(jobId)) {
          reject(new Error("Job cancelled"));
        } else {
          reject(new Error(`Command '${command} ${args.join(" ")}' failed (code ${code}). Stderr: ${stderr}`));
        }
      }
    });

    proc.on("error", (err) => {
      if (timer) clearTimeout(timer);
      if (jobId) {
        activeProcesses.delete(jobId);
      }
      reject(err);
    });
  });
}

export class FfmpegExportService {
  public static isCancelled(jobId: string): boolean {
    return cancelledJobs.has(jobId);
  }

  // Cancel active job process with SIGTERM -> SIGKILL fallback
  public static async cancelJob(jobId: string): Promise<boolean> {
    cancelledJobs.add(jobId);
    const proc = activeProcesses.get(jobId);
    if (proc) {
      try {
        console.log(`[FfmpegExportService] Sending SIGTERM to process for job ${jobId}`);
        proc.kill("SIGTERM");

        // Wait up to 3 seconds for it to exit
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 100));
          if (!activeProcesses.has(jobId)) {
            console.log(`[FfmpegExportService] Process for job ${jobId} terminated cleanly via SIGTERM`);
            break;
          }
        }

        if (activeProcesses.has(jobId)) {
          console.log(`[FfmpegExportService] Process for job ${jobId} did not exit. Sending SIGKILL.`);
          proc.kill("SIGKILL");
          activeProcesses.delete(jobId);
        }
        return true;
      } catch (e) {
        console.error(`Failed to kill active process for job ${jobId}:`, e);
      }
    }
    return false;
  }

  // Simple export method without annotations, freeze, or complex overlays
  public static async exportSimpleClip(options: {
    inputPath: string;
    outputPath: string;
    startTime: number;
    duration: number;
    sourceMetadata: { width: number; height: number; duration: number };
    signal?: AbortSignal;
    jobId?: string;
  }): Promise<{ success: boolean; duration: number; size: number }> {
    const { inputPath, outputPath, startTime, duration, sourceMetadata, jobId } = options;

    let outW = sourceMetadata.width;
    let outH = sourceMetadata.height;

    if (sourceMetadata.width > 1920 || sourceMetadata.height > 1080) {
      const scale = Math.min(1920 / sourceMetadata.width, 1080 / sourceMetadata.height);
      outW = Math.round((sourceMetadata.width * scale) / 2) * 2;
      outH = Math.round((sourceMetadata.height * scale) / 2) * 2;
    } else {
      outW = Math.round(sourceMetadata.width / 2) * 2;
      outH = Math.round(sourceMetadata.height / 2) * 2;
    }

    const sourceFps = await this.getVideoFps(inputPath);
    const outputFps = Number.isFinite(sourceFps)
      ? Math.min(Math.max(sourceFps, 24), 60)
      : 30;

    const hasAudio = await this.hasAudioStream(inputPath);

    const args = [
      "-ss", String(startTime),
      "-i", inputPath,
      "-t", String(duration)
    ];

    const videoFilters = `scale=${outW}:${outH}`;
    args.push("-vf", videoFilters);
    args.push("-map", "0:v:0");

    if (hasAudio) {
      args.push("-map", "0:a:0?");
    }

    args.push(
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(outputFps)
    );

    if (hasAudio) {
      args.push(
        "-c:a", "aac",
        "-ar", "48000",
        "-ac", "2"
      );
    }

    args.push("-movflags", "+faststart", "-y", outputPath);

    await runProcess("ffmpeg", args, jobId);

    // Validate using ffprobe to satisfy Phase 2.5
    await runProcess("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,size",
      "-of", "json",
      outputPath
    ]);

    const stats = fs.statSync(outputPath);

    return {
      success: true,
      duration,
      size: stats.size
    };
  }

  // Check if input video has audio
  public static async hasAudioStream(filePath: string): Promise<boolean> {
    try {
      const output = await runProcess("ffprobe", [
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=index",
        "-of", "json",
        filePath
      ]);
      const data = JSON.parse(output);
      return data.streams && data.streams.length > 0;
    } catch (e) {
      console.error("Failed to check audio stream:", e);
      return false;
    }
  }

  // Get FPS of video stream
  public static async getVideoFps(filePath: string): Promise<number> {
    try {
      const output = await runProcess("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "json",
        filePath
      ]);
      const data = JSON.parse(output);
      const rateStr = data.streams?.[0]?.r_frame_rate || "30/1";
      const parts = rateStr.split("/");
      if (parts.length === 2) {
        const fps = Number(parts[0]) / Number(parts[1]);
        if (fps > 0) return Math.round(fps * 100) / 100;
      }
      return 30;
    } catch (e) {
      console.error("Failed to get video FPS, defaulting to 30:", e);
      return 30;
    }
  }

  // Get dimensions of video (throws on failure)
  public static async getVideoDimensions(filePath: string): Promise<{ width: number; height: number; duration: number }> {
    const output = await runProcess("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration",
      "-of", "json",
      filePath
    ]);
    const data = JSON.parse(output);
    const stream = data.streams?.[0];
    if (!stream || !stream.width || !stream.height) {
      throw new Error("ffprobe: Missing valid video stream dimensions");
    }
    const duration = Number(stream.duration || 0);
    return {
      width: Number(stream.width),
      height: Number(stream.height),
      duration: duration
    };
  }

  // Auto-wrap text to fit bounds
  private static wrapText(text: string, maxChars = 22): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= maxChars) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Generate SVG overlay for annotations
  private static generateSvgOverlay(
    width: number,
    height: number,
    annotations: Annotation[]
  ): string {
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Arrow marker definitions
    svgContent += `
      <defs>
        <marker id="arrow-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFB020" />
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#D64545" />
        </marker>
        <marker id="arrow-white" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFFFFF" />
        </marker>
      </defs>
    `;

    for (const a of annotations) {
      const colorHex = a.type !== "freeze" && a.type !== "text" 
        ? (a.color === "yellow" ? "#FFB020" : a.color === "red" ? "#D64545" : "#FFFFFF") 
        : "#FFFFFF";

      if (a.type === "circle") {
        const cx = a.x * width;
        const cy = a.y * height;
        const geom = getCircleGeometry(width, height, a.radius);
        const strokeWidth = a.thickness === "bold" ? 8 : 4;
        const dashStyle = a.thickness === "bold" ? "" : "stroke-dasharray: 8 8";

        svgContent += `
          <ellipse cx="${cx}" cy="${cy}" rx="${geom.rx}" ry="${geom.ry}" 
                   stroke="${colorHex}" stroke-width="${strokeWidth}" 
                   fill="rgba(255, 176, 32, 0.05)" style="${dashStyle}" />
        `;
      } else if (a.type === "arrow") {
        const geom = getArrowGeometry(width, height, a.startX, a.startY, a.endX, a.endY);

        svgContent += `
          <line x1="${geom.x1}" y1="${geom.y1}" x2="${geom.x2}" y2="${geom.y2}" 
                stroke="${colorHex}" stroke-width="${geom.strokeWidth}" 
                marker-end="url(#arrow-${a.color})" />
        `;
      } else if (a.type === "text") {
        const geom = getTextGeometry(width, height, a.x, a.y, a.size, a.text);

        // Draw background rectangle
        svgContent += `
          <rect x="${geom.rectX}" y="${geom.rectY}" width="${geom.boxWidth}" height="${geom.boxHeight}" 
                rx="${geom.fontSize * 0.22}" fill="rgba(0, 0, 0, 0.82)" />
        `;

        // Draw each line of text
        for (let idx = 0; idx < geom.lines.length; idx++) {
          const lineY = geom.rectY + geom.paddingY + geom.fontSize * 0.85 + idx * geom.fontSize * 1.25;
          const escapedLine = geom.lines[idx]
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          svgContent += `
            <text x="${a.x * width}" y="${lineY}" 
                  font-family="Arial, Helvetica, sans-serif" font-size="${geom.fontSize}" 
                  fill="#FFFFFF" font-weight="bold" text-anchor="middle">
              ${escapedLine}
            </text>
          `;
        }
      }
    }

    svgContent += `</svg>`;
    return svgContent;
  }

  // Orchestrate background export process
  public static async executeExport(
    jobId: string,
    metadata: ExportRequestMetadata,
    inputPath: string,
    outputPath: string,
    tempDir: string
  ): Promise<void> {
    const jobTmpDir = path.join(tempDir, "jobs", jobId);
    fs.mkdirSync(jobTmpDir, { recursive: true });

    try {
      // 1. Probe source video metadata
      exportJobService.updateJob(jobId, { stage: "validating", progress: 5 });
      const { width: rawW, height: rawH } = await this.getVideoDimensions(inputPath);
      const hasAudio = await this.hasAudioStream(inputPath);
      const fps = await this.getVideoFps(inputPath);

      console.log(`[ExportJob ${jobId}] Source detected: ${rawW}x${rawH}, FPS: ${fps}, Has Audio: ${hasAudio}`);

      // 2. Compute Output Dimensions (max 1080p, preserve aspect, even numbers)
      let outW = rawW;
      let outH = rawH;
      if (rawW > 1920 || rawH > 1080) {
        const scale = Math.min(1920 / rawW, 1080 / rawH);
        outW = Math.round((rawW * scale) / 2) * 2;
        outH = Math.round((rawH * scale) / 2) * 2;
      } else {
        outW = Math.round(rawW / 2) * 2;
        outH = Math.round(rawH / 2) * 2;
      }

      const start = metadata.clip.startTime;
      const end = metadata.clip.endTime;

      // 3. Extract and filter valid freeze annotations
      const freezes = (metadata.annotations
        .filter((a) => a.type === "freeze") as FreezeAnnotation[])
        .filter((f) => f.time >= start && f.time <= end && f.duration > 0)
        .sort((a, b) => a.time - b.time);

      // Avoid overlapping freezes
      const validFreezes: FreezeAnnotation[] = [];
      let lastFreezeTime = -1;
      for (const f of freezes) {
        if (f.time >= lastFreezeTime) {
          validFreezes.push(f);
          lastFreezeTime = f.time + 0.1; // minor buffer
        }
      }

      // 4. Construct Chronological Segment List
      type Segment = 
        | { type: "video"; start: number; end: number }
        | { type: "freeze"; time: number; duration: number };

      const segments: Segment[] = [];
      let currentPos = start;

      for (const f of validFreezes) {
        if (f.time > currentPos + 0.05) {
          segments.push({ type: "video", start: currentPos, end: f.time });
        }
        segments.push({ type: "freeze", time: f.time, duration: f.duration });
        currentPos = f.time;
      }

      if (currentPos < end - 0.05) {
        segments.push({ type: "video", start: currentPos, end });
      }

      if (segments.length === 0) {
        throw new Error("No video duration to render.");
      }

      // 5. Render segments
      const segmentFiles: string[] = [];
      const totalSteps = segments.length;

      for (let i = 0; i < segments.length; i++) {
        if (FfmpegExportService.isCancelled(jobId)) {
          throw new Error("Job cancelled");
        }

        const seg = segments[i];
        const segOutFile = path.join(jobTmpDir, `seg_${i}.mp4`);
        const segProgressBase = 10 + Math.round((i / totalSteps) * 75);

        if (seg.type === "video") {
          exportJobService.updateJob(jobId, {
            stage: "rendering_annotations",
            progress: segProgressBase
          });

          // Filter active annotations for this range
          const activeAnnos = metadata.annotations.filter(
            (a): a is Exclude<Annotation, { type: "freeze" }> => {
              if (a.type === "freeze") return false;
              return !(a.endTime < seg.start || a.startTime > seg.end);
            }
          );

          if (activeAnnos.length > 0) {
            // Render individual SVG for each active annotation to overlay with correct timing
            const overlayArgs: string[] = ["-ss", String(seg.start), "-t", String(seg.end - seg.start), "-i", inputPath];
            const filterChains: string[] = [`[0:v]scale=${outW}:${outH}[v0]`];

            for (let k = 0; k < activeAnnos.length; k++) {
              const anno = activeAnnos[k];
              const svgContent = this.generateSvgOverlay(outW, outH, [anno]);
              const svgPath = path.join(jobTmpDir, `seg_${i}_anno_${k}.svg`);
              fs.writeFileSync(svgPath, svgContent);

              overlayArgs.push("-i", svgPath);

              const relStart = Math.max(0, anno.startTime - seg.start);
              const relEnd = Math.min(seg.end - seg.start, anno.endTime - seg.start);
              const prevLabel = `v${k}`;
              const nextLabel = `v${k + 1}`;

              filterChains.push(
                `[${prevLabel}][${k + 1}:v]overlay=0:0:enable='between(t,${relStart},${relEnd})'[${nextLabel}]`
              );
            }

            const lastLabel = `v${activeAnnos.length}`;
            let filterString = filterChains.join("; ") + `; [${lastLabel}]null[v_out]`;

            const finalArgs = [
              ...overlayArgs
            ];

            if (hasAudio) {
              filterString += "; [0:a]aresample=async=1,aformat=sample_rates=44100:channel_layouts=stereo[a_out]";
              finalArgs.push("-filter_complex", filterString, "-map", "[v_out]", "-map", "[a_out]", "-c:a", "aac");
            } else {
              // Generate silent audio inline to bypass variable audio layout bugs
              filterString += "; anullsrc=channel_layout=stereo:sample_rate=44100[a_out]";
              finalArgs.push("-filter_complex", filterString, "-map", "[v_out]", "-map", "[a_out]", "-c:a", "aac", "-shortest");
            }

            finalArgs.push(
              "-c:v", "libx264",
              "-pix_fmt", "yuv420p",
              "-r", String(fps),
              "-y",
              segOutFile
            );

            await runProcess("ffmpeg", finalArgs, jobId);
          } else {
            // Plain video trim with downscale
            let filterString = `[0:v]scale=${outW}:${outH}[v_out]`;
            const finalArgs = [
              "-ss", String(seg.start),
              "-t", String(seg.end - seg.start),
              "-i", inputPath
            ];

            if (hasAudio) {
              filterString += "; [0:a]aresample=async=1,aformat=sample_rates=44100:channel_layouts=stereo[a_out]";
              finalArgs.push("-filter_complex", filterString, "-map", "[v_out]", "-map", "[a_out]", "-c:a", "aac");
            } else {
              filterString += "; anullsrc=channel_layout=stereo:sample_rate=44100[a_out]";
              finalArgs.push("-filter_complex", filterString, "-map", "[v_out]", "-map", "[a_out]", "-c:a", "aac", "-shortest");
            }

            finalArgs.push(
              "-c:v", "libx264",
              "-pix_fmt", "yuv420p",
              "-r", String(fps),
              "-y",
              segOutFile
            );

            await runProcess("ffmpeg", finalArgs, jobId);
          }
        } else if (seg.type === "freeze") {
          exportJobService.updateJob(jobId, {
            stage: "rendering_freezes",
            progress: segProgressBase
          });

          // 1. Extract single frame
          const imgFile = path.join(jobTmpDir, `freeze_frame_${i}.png`);
          await runProcess("ffmpeg", [
            "-ss", String(seg.time),
            "-i", inputPath,
            "-vframes", "1",
            "-q:v", "2",
            "-y",
            imgFile
          ], jobId);

          // 2. Identify active annotations at freeze time
          const activeAnnos = metadata.annotations.filter(
            (a) => a.type !== "freeze" && a.startTime <= seg.time && a.endTime >= seg.time
          );

          // 3. Generate Overlay SVG
          const svgContent = this.generateSvgOverlay(outW, outH, activeAnnos);
          const svgPath = path.join(jobTmpDir, `freeze_svg_${i}.svg`);
          fs.writeFileSync(svgPath, svgContent);

          // 4. Create annotated frame by overlaying the SVG onto the PNG frame (instantaneous single-frame output)
          const annotatedImgFile = path.join(jobTmpDir, `freeze_annotated_${i}.png`);
          await runProcess("ffmpeg", [
            "-i", imgFile,
            "-i", svgPath,
            "-filter_complex", `[0:v]scale=${outW}:${outH}[scaled]; [scaled][1:v]overlay=0:0`,
            "-vframes", "1",
            "-y",
            annotatedImgFile
          ], jobId);

          // 5. Render freeze MP4 of exactly `seg.duration` length from the static annotated image
          await runProcess("ffmpeg", [
            "-loop", "1",
            "-t", String(seg.duration),
            "-i", annotatedImgFile,
            "-f", "lavfi",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-r", String(fps),
            "-c:a", "aac",
            "-ar", "44100",
            "-ac", "2",
            "-t", String(seg.duration),
            "-y",
            segOutFile
          ], jobId);
        }

        segmentFiles.push(segOutFile);
      }

      if (FfmpegExportService.isCancelled(jobId)) {
        throw new Error("Job cancelled");
      }

      // 6. Concatenate all generated segment MP4s using absolute path resolution
      exportJobService.updateJob(jobId, { stage: "encoding", progress: 90 });
      const concatListFile = path.join(jobTmpDir, "concat_list.txt");
      const concatLines = segmentFiles.map((f) => `file '${path.resolve(f).replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(concatListFile, concatLines);

      await runProcess("ffmpeg", [
        "-f", "concat",
        "-safe", "0",
        "-i", concatListFile,
        "-c", "copy",
        "-y",
        outputPath
      ], jobId);

      if (FfmpegExportService.isCancelled(jobId)) {
        throw new Error("Job cancelled");
      }

      // 7. Complete job & final details
      exportJobService.updateJob(jobId, { stage: "finalizing", progress: 98 });
      const outputStats = fs.statSync(outputPath);
      const outputDuration = segments.reduce((sum, s) => {
        if (s.type === "video") return sum + (s.end - s.start);
        return sum + s.duration;
      }, 0);

      const finalFileName = sanitizeExportFileName(metadata.projectTitle || "CoachClip");

      const completedAt = Date.now();
      const expiresAtMs = completedAt + (config.outputTtlMinutes * 60 * 1000);
      const expiresAtIso = new Date(expiresAtMs).toISOString();

      exportJobService.updateJob(jobId, {
        status: "completed",
        stage: "completed",
        progress: 100,
        expiresAt: expiresAtMs,
        output: {
          fileName: finalFileName,
          size: outputStats.size,
          duration: outputDuration,
          downloadUrl: `/api/exports/${jobId}/download`,
          expiresAt: expiresAtIso
        }
      });
    } catch (err: unknown) {
      if (FfmpegExportService.isCancelled(jobId)) {
        console.log(`[ExportJob ${jobId}] Execution caught cancellation. Ensuring status remains cancelled.`);
        exportJobService.updateJob(jobId, {
          status: "cancelled"
        });
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Export Job ${jobId} failed with error:`, err);
        
        if (errMsg === "FFMPEG_TIMEOUT") {
          exportJobService.updateJob(jobId, {
            status: "failed",
            errorCode: "FFMPEG_TIMEOUT",
            userMessage: "Klippet tog for lang tid at behandle. Prøv et kortere klip eller en mindre video."
          });
        } else {
          exportJobService.updateJob(jobId, {
            status: "failed",
            errorCode: "FFMPEG_ERROR",
            userMessage: "Klippet kunne ikke oprettes. Projektet og dine markeringer er dog stadig gemt."
          });
        }
      }
    } finally {
      // Clean up the uploaded raw source video file immediately to conserve host disk space
      if (fs.existsSync(inputPath)) {
        try {
          fs.unlinkSync(inputPath);
          console.log(`[ExportJob ${jobId}] Successfully deleted raw input source file to save space.`);
        } catch (e) {
          console.error(`Failed to delete raw input source video file:`, e);
        }
      }

      // If job is cancelled or failed, delete partial output file
      const finalJob = exportJobService.getJob(jobId);
      if (finalJob && (finalJob.status === "cancelled" || finalJob.status === "failed")) {
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath);
            console.log(`[ExportJob ${jobId}] Deleted partial output file due to non-completed status.`);
          } catch (e) {
            console.warn(`[ExportJob ${jobId}] Failed to delete partial output file:`, e);
          }
        }
      }

      // Clean up temporary segment files inside job-specific directory
      try {
        fs.rmSync(jobTmpDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to clean up job temp directory:", e);
      }
    }
  }
}
