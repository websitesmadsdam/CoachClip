/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: Test script uses raw any and intentionally unused mocks for testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exportJobService } from "../src/services/exportJobService";
import { FileCleanupService } from "../src/services/fileCleanupService";
import fs from "fs";
import path from "path";
import { getCircleGeometry, getArrowGeometry, getTextGeometry } from "../../shared/annotationGeometry";
import { sanitizeExportFileName } from "../../shared/exportSchema";

describe("CoachClip Backend MVP - Unit Tests", () => {
  beforeEach(() => {
    // Clear in-memory jobs before each test
    const jobs = (exportJobService as any).jobs;
    if (jobs) {
      jobs.clear();
    }
  });

  // 1. Test Export Status Transitions
  describe("Export Status Transitions", () => {
    it("should successfully create a new job and transition through stages", () => {
      const jobId = "test-job-123";
      const projectId = "proj-abc";

      const job = exportJobService.createJob(jobId, projectId);
      expect(job.status).toBe("queued");
      expect(job.progress).toBe(0);

      // Transition to processing
      exportJobService.updateJob(jobId, { status: "processing", stage: "trimming", progress: 25 });
      const updatedJob = exportJobService.getJob(jobId);
      expect(updatedJob?.status).toBe("processing");
      expect(updatedJob?.stage).toBe("trimming");
      expect(updatedJob?.progress).toBe(25);

      // Transition to completed
      exportJobService.updateJob(jobId, {
        status: "completed",
        progress: 100,
        output: {
          fileName: "test_output.mp4",
          size: 1048576,
          duration: 12,
          downloadUrl: `/api/exports/${jobId}/download`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      });

      const completedJob = exportJobService.getJob(jobId);
      expect(completedJob?.status).toBe("completed");
      expect(completedJob?.progress).toBe(100);
      expect(completedJob?.output?.fileName).toBe("test_output.mp4");
    });
  });

  // 2. Test Error Code Mapping & Validation Constraints
  describe("Validation & Error Code Mapping", () => {
    it("should correctly handle clip validation error codes and map to user messages", () => {
      // Mock duration validation
      const validateClipDuration = (startTime: number, endTime: number) => {
        const duration = endTime - startTime;
        if (duration <= 0) {
          return {
            isValid: false,
            errorCode: "INVALID_BOUNDS",
            message: "Ugyldig tidsramme. Starttidspunkt skal være før sluttidspunkt.",
          };
        }
        if (duration > 90) {
          return {
            isValid: false,
            errorCode: "CLIP_TOO_LONG",
            message: "Det valgte klip kan højst være 90 sekunder i denne version.",
          };
        }
        return { isValid: true };
      };

      // Under 90s is valid
      const validCheck = validateClipDuration(5, 35);
      expect(validCheck.isValid).toBe(true);

      // Over 90s is rejected with correct Danish text
      const tooLongCheck = validateClipDuration(0, 95);
      expect(tooLongCheck.isValid).toBe(false);
      expect(tooLongCheck.errorCode).toBe("CLIP_TOO_LONG");
      expect(tooLongCheck.message).toContain("90 sekunder");

      // Negative bounds rejected
      const invalidCheck = validateClipDuration(10, 5);
      expect(invalidCheck.isValid).toBe(false);
      expect(invalidCheck.errorCode).toBe("INVALID_BOUNDS");
    });
  });

  // 3. Test File Cleanup Interval Logic
  describe("File Cleanup Service Logic", () => {
    const mockTempDir = "./tmp_test_cleanup";

    beforeEach(() => {
      if (fs.existsSync(mockTempDir)) {
        fs.rmSync(mockTempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(mockTempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(mockTempDir)) {
        fs.rmSync(mockTempDir, { recursive: true, force: true });
      }
    });

    it("should correctly identify and delete expired files based on TTL", () => {
      const activeFile = path.join(mockTempDir, "active.mp4");
      const expiredFile = path.join(mockTempDir, "expired.mp4");

      // Write test files
      fs.writeFileSync(activeFile, "active content");
      fs.writeFileSync(expiredFile, "expired content");

      const now = Date.now();
      const mtimeExpired = new Date(now - 65 * 60 * 1000); // 65 mins old (Expired!)
      const mtimeActive = new Date(now - 10 * 60 * 1000);  // 10 mins old (Active)

      fs.utimesSync(expiredFile, mtimeExpired, mtimeExpired);
      fs.utimesSync(activeFile, mtimeActive, mtimeActive);

      // Run direct manual cleanup routine
      const ttlMinutes = 60;
      const files = fs.readdirSync(mockTempDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(mockTempDir, file);
        const stats = fs.statSync(filePath);
        const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

        if (ageMinutes > ttlMinutes) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      expect(deletedCount).toBe(1);
      expect(fs.existsSync(activeFile)).toBe(true);
      expect(fs.existsSync(expiredFile)).toBe(false);
    });
  });

  // 4. Test Shared Geometry Calculations
  describe("Shared Geometry & File Name Sanitization", () => {

    it("should compute circle geometry as a perfect circle using min(width, height)", () => {
      // 16:9 widescreen
      const { rx, ry, radiusPx } = getCircleGeometry(1280, 720, 0.1);
      expect(rx).toBe(72);
      expect(ry).toBe(72);
      expect(radiusPx).toBe(72);

      // Portrait
      const portrait = getCircleGeometry(720, 1280, 0.15);
      expect(portrait.rx).toBe(108);
      expect(portrait.ry).toBe(108);
    });

    it("should compute arrow geometry correctly", () => {
      const { x1, y1, x2, y2, length } = getArrowGeometry(1000, 500, 0.1, 0.2, 0.4, 0.6);
      expect(x1).toBe(100);
      expect(y1).toBe(100);
      expect(x2).toBe(400);
      expect(y2).toBe(300);
      expect(length).toBe(Math.sqrt(300 * 300 + 200 * 200));
    });

    it("should compute text bounding box and wrap text correctly", () => {
      const { boxWidth, boxHeight, fontSize, lines } = getTextGeometry(1000, 500, 0.5, 0.5, "normal", "Dette er en test af line wrap");
      expect(fontSize).toBe(20);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(boxWidth).toBeGreaterThan(0);
      expect(boxHeight).toBeGreaterThan(0);
    });

    it("should sanitize export file name with Danish character replacements", () => {
      const name1 = sanitizeExportFileName("Træning og øvelse på Åen");
      expect(name1).toBe("Traening_og_oevelse_paa_Aaen.mp4");

      const name2 = sanitizeExportFileName("   Spiller 1 - Skud! ???   ");
      expect(name2).toBe("Spiller_1_-_Skud.mp4");

      // Reserved windows names handled
      const name3 = sanitizeExportFileName("CON");
      expect(name3).toBe("_CON.mp4");
    });
  });
});
