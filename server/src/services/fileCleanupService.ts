/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { exportJobService } from "./exportJobService";

export class FileCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;

  public static initialize(tempDir: string, ttlMinutes: number) {
    // Ensure cleanup runs every 5 minutes
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const uploadsDir = path.join(tempDir, "uploads");
    const exportsDir = path.join(tempDir, "exports");

    // Ensure directories exist
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(exportsDir, { recursive: true });

    this.cleanupInterval = setInterval(() => {
      this.runCleanup(uploadsDir, exportsDir, ttlMinutes);
    }, 5 * 60 * 1000); // 5 minutes

    // Run once on startup
    this.runCleanup(uploadsDir, exportsDir, ttlMinutes);
  }

  public static runCleanup(uploadsDir: string, exportsDir: string, ttlMinutes: number) {
    const now = Date.now();
    const ttlMs = ttlMinutes * 60 * 1000;

    // Clean up jobs map & expired export files
    const allJobs = exportJobService.getAllJobs();
    for (const job of allJobs) {
      const expiresAt = job.expiresAt ?? (job.createdAt + ttlMs);
      const isExpired = now >= expiresAt;

      if (isExpired && job.status === "completed") {
        // Delete output file if exists
        if (job.outputFilePath && fs.existsSync(job.outputFilePath)) {
          try {
            fs.unlinkSync(job.outputFilePath);
          } catch (e) {
            console.error(`Failed to delete output file ${job.outputFilePath}:`, e);
          }
        }
        // Delete input file if exists
        if (job.inputFilePath && fs.existsSync(job.inputFilePath)) {
          try {
            fs.unlinkSync(job.inputFilePath);
          } catch (e) {
            console.error(`Failed to delete input file ${job.inputFilePath}:`, e);
          }
        }
        // Set job status
        exportJobService.updateJob(job.jobId, { status: "expired" });
      } else if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
        // Delete output file if exists
        if (job.outputFilePath && fs.existsSync(job.outputFilePath)) {
          try {
            fs.unlinkSync(job.outputFilePath);
          } catch (e) {
            console.warn(`Failed to delete output file during cleanup:`, e);
          }
        }
        // Delete input file if exists
        if (job.inputFilePath && fs.existsSync(job.inputFilePath)) {
          try {
            fs.unlinkSync(job.inputFilePath);
          } catch (e) {
            console.warn(`Failed to delete input file during cleanup:`, e);
          }
        }
      }
    }

    // Direct folder cleanup for orphaned files (safety fallback)
    this.cleanFolderOfOldFiles(uploadsDir, ttlMs);
    this.cleanFolderOfOldFiles(exportsDir, ttlMs);

    // Clean up orphaned job directories under tmp/jobs/
    const jobsParentDir = path.join(path.dirname(uploadsDir), "jobs");
    this.cleanFolderOfOldFiles(jobsParentDir, ttlMs);
  }

  private static cleanFolderOfOldFiles(folderPath: string, ttlMs: number) {
    if (!fs.existsSync(folderPath)) return;

    try {
      const files = fs.readdirSync(folderPath);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile() && now - stats.mtimeMs > ttlMs) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error(`Cleanup failed for file ${filePath}:`, e);
          }
        } else if (stats.isDirectory()) {
          // If a subdirectory is old, remove recursively
          if (now - stats.mtimeMs > ttlMs) {
            try {
              fs.rmSync(filePath, { recursive: true, force: true });
            } catch (e) {
              console.error(`Cleanup failed for directory ${filePath}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Failed to scan folder for cleanup: ${folderPath}`, e);
    }
  }

  public static shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
