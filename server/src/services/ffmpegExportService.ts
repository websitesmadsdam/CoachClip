/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { ExportRequestMetadata, ExportJob } from "../types/exportTypes";
import { exportJobService } from "./exportJobService";
import { Annotation } from "../../../src/types";

// Promisified helper to run spawn securely without a shell (immune to injection)
function runProcess(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command '${command} ${args.join(" ")}' failed (code ${code}). Stderr: ${stderr}`));
      }
    });
  });
}

export class FfmpegExportService {
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

  // Get dimensions of video
  public static async getVideoDimensions(filePath: string): Promise<{ width: number; height: number; duration: number }> {
    try {
      const output = await runProcess("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,duration",
        "-of", "json",
        filePath
      ]);
      const data = JSON.parse(output);
      const stream = data.streams?.[0] || {};
      return {
        width: Number(stream.width || 1920),
        height: Number(stream.height || 1080),
        duration: Number(stream.duration || 0)
      };
    } catch (e) {
      console.error("Failed to get video dimensions via ffprobe:", e);
      return { width: 1920, height: 1080, duration: 0 };
    }
  }

  // Auto-wrap text to fits in the bounds
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

  // Generate SVG overlay for a single annotation or multiple annotations
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
        const rx = a.radius * width;
        const ry = a.radius * height;
        const strokeWidth = a.thickness === "bold" ? 8 : 4;
        const dashStyle = a.thickness === "bold" ? "" : "stroke-dasharray: 8 8";

        svgContent += `
          <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" 
                   stroke="${colorHex}" stroke-width="${strokeWidth}" 
                   fill="rgba(255, 176, 32, 0.05)" style="${dashStyle}" />
        `;
      } else if (a.type === "arrow") {
        const x1 = a.startX * width;
        const y1 = a.startY * height;
        const x2 = a.endX * width;
        const y2 = a.endY * height;

        svgContent += `
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                stroke="${colorHex}" stroke-width="6" 
                marker-end="url(#arrow-${a.color})" />
        `;
      } else if (a.type === "text") {
        const lines = this.wrapText(a.text, 22);
        const fontSize = a.size === "small" ? height * 0.03 : a.size === "large" ? height * 0.055 : height * 0.04;
        const charWidth = fontSize * 0.52;
        const paddingX = fontSize * 0.6;
        const paddingY = fontSize * 0.45;
        const maxLineLength = Math.max(...lines.map(l => l.length));

        const boxWidth = maxLineLength * charWidth + paddingX * 2;
        const boxHeight = lines.length * fontSize * 1.25 + paddingY * 2;

        const rectX = a.x * width - boxWidth / 2;
        const rectY = a.y * height - boxHeight / 2;

        // Draw background rectangle
        svgContent += `
          <rect x="${rectX}" y="${rectY}" width="${boxWidth}" height="${boxHeight}" 
                rx="${fontSize * 0.22}" fill="rgba(0, 0, 0, 0.82)" />
        `;

        // Draw each line of text
        for (let idx = 0; idx < lines.length; idx++) {
          const lineY = rectY + paddingY + fontSize * 0.85 + idx * fontSize * 1.25;
          // Escape HTML characters safely
          const escapedLine = lines[idx]
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          svgContent += `
            <text x="${a.x * width}" y="${lineY}" 
                  font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" 
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

  // Orchestrate the background export process
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
      const { width: rawW, height: rawH, duration: rawDur } = await this.getVideoDimensions(inputPath);
      const hasAudio = await this.hasAudioStream(inputPath);

      // 2. Compute Output Dimensions (max 1080p, preserve aspect ratio, even numbers)
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
      const freezes = metadata.annotations
        .filter((a) => a.type === "freeze")
        .map((a) => a as any)
        .filter((f) => f.time >= start && f.time <= end && f.duration > 0)
        .sort((a, b) => a.time - b.time);

      // Avoid overlapping freezes
      const validFreezes: any[] = [];
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
            (a) => a.type !== "freeze" && !(a.endTime < seg.start || a.startTime > seg.end)
          );

          if (activeAnnos.length > 0) {
            // Render individual SVG for each active annotation to overlay with correct timing
            const overlayArgs: string[] = ["-ss", String(seg.start), "-to", String(seg.end), "-i", inputPath];
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
            const filterString = filterChains.join("; ") + `; [${lastLabel}]null[v_out]`;

            const finalArgs = [
              ...overlayArgs,
              "-filter_complex", filterString,
              "-map", "[v_out]"
            ];

            if (hasAudio) {
              finalArgs.push("-map", "0:a", "-c:a", "aac", "-ar", "44100", "-ac", "2");
            } else {
              // No audio source, inject silence
              finalArgs.push(
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map", "1:a", "-c:a", "aac", "-shortest"
              );
            }

            finalArgs.push(
              "-c:v", "libx264",
              "-pix_fmt", "yuv420p",
              "-r", "25",
              "-y",
              segOutFile
            );

            await runProcess("ffmpeg", finalArgs);
          } else {
            // Plain video trim with downscale
            const filterString = `[0:v]scale=${outW}:${outH}[v_out]`;
            const finalArgs = [
              "-ss", String(seg.start),
              "-to", String(seg.end),
              "-i", inputPath,
              "-filter_complex", filterString,
              "-map", "[v_out]"
            ];

            if (hasAudio) {
              finalArgs.push("-map", "0:a", "-c:a", "aac", "-ar", "44100", "-ac", "2");
            } else {
              finalArgs.push(
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map", "1:a", "-c:a", "aac", "-shortest"
              );
            }

            finalArgs.push(
              "-c:v", "libx264",
              "-pix_fmt", "yuv420p",
              "-r", "25",
              "-y",
              segOutFile
            );

            await runProcess("ffmpeg", finalArgs);
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
          ]);

          // 2. Identify active annotations at freeze time
          const activeAnnos = metadata.annotations.filter(
            (a) => a.type !== "freeze" && a.startTime <= seg.time && a.endTime >= seg.time
          );

          // 3. Generate Overlay SVG
          const svgContent = this.generateSvgOverlay(outW, outH, activeAnnos);
          const svgPath = path.join(jobTmpDir, `freeze_svg_${i}.svg`);
          fs.writeFileSync(svgPath, svgContent);

          // 4. Render freeze MP4 with silence and annotation burned in
          await runProcess("ffmpeg", [
            "-loop", "1", "-i", imgFile,
            "-i", svgPath,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-filter_complex", `[0:v]scale=${outW}:${outH}[v0]; [v0][1:v]overlay=0:0[v_out]`,
            "-map", "[v_out]",
            "-map", "2:a",
            "-t", String(seg.duration),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-r", "25",
            "-c:a", "aac",
            "-ar", "44100",
            "-ac", "2",
            "-y",
            segOutFile
          ]);
        }

        segmentFiles.push(segOutFile);
      }

      // 6. Concatenate all generated segment MP4s
      exportJobService.updateJob(jobId, { stage: "encoding", progress: 90 });
      const concatListFile = path.join(jobTmpDir, "concat_list.txt");
      const concatLines = segmentFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(concatListFile, concatLines);

      await runProcess("ffmpeg", [
        "-f", "concat",
        "-safe", "0",
        "-i", concatListFile,
        "-c", "copy",
        "-y",
        outputPath
      ]);

      // 7. Complete job & final details
      exportJobService.updateJob(jobId, { stage: "finalizing", progress: 98 });
      const outputStats = fs.statSync(outputPath);
      const outputDuration = segments.reduce((sum, s) => {
        if (s.type === "video") return sum + (s.end - s.start);
        return sum + s.duration;
      }, 0);

      // Clean Danish normalized file name
      const cleanProjTitle = metadata.projectId 
        ? metadata.projectId.replace(/[^a-zA-Z0-9]/g, "_") 
        : "coach_clip";
      const finalFileName = `${cleanProjTitle}_export.mp4`;

      exportJobService.updateJob(jobId, {
        status: "completed",
        stage: "finalizing",
        progress: 100,
        output: {
          fileName: finalFileName,
          size: outputStats.size,
          duration: outputDuration,
          downloadUrl: `/api/exports/${jobId}/download`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 60 mins TTL
        }
      });
    } catch (err: any) {
      console.error(`Export Job ${jobId} failed with error:`, err);
      exportJobService.updateJob(jobId, {
        status: "failed",
        errorCode: "FFMPEG_ERROR",
        userMessage: "Klippet kunne ikke oprettes. Projektet og dine markeringer er dog stadig gemt."
      });
    } finally {
      // 8. Clean up temporary files inside job-specific directory
      try {
        fs.rmSync(jobTmpDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to clean up job temp directory:", e);
      }
    }
  }
}
