/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { exportJobService } from "./exportJobService";
import { FfmpegExportService } from "./ffmpegExportService";
import { ExportRequestMetadata } from "../types/exportTypes";

type QueueItem = {
  jobId: string;
  projectId: string;
  inputPath: string;
  outputPath: string;
  metadata: ExportRequestMetadata;
  tempDir: string;
};

class ExportQueue {
  private queue: QueueItem[] = [];
  private activeJobs = new Set<string>();
  private maxConcurrency = Number(process.env.MAX_CONCURRENT_EXPORTS || "2");

  public enqueue(
    jobId: string,
    projectId: string,
    inputPath: string,
    outputPath: string,
    metadata: ExportRequestMetadata,
    tempDir: string
  ): void {
    const job = exportJobService.getJob(jobId);
    if (!job || job.status === "cancelled") {
      return;
    }

    this.queue.push({
      jobId,
      projectId,
      inputPath,
      outputPath,
      metadata,
      tempDir,
    });

    console.log(`[ExportQueue] Job ${jobId} enqueued. Queue length: ${this.queue.length}`);
    this.processNext();
  }

  public cancel(jobId: string): boolean {
    // 1. If it's in the queue (waiting), remove it
    const index = this.queue.findIndex((item) => item.jobId === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`[ExportQueue] Cancelled queued job ${jobId}`);
      exportJobService.updateJob(jobId, { status: "cancelled" });
      return true;
    }

    // 2. If it is active, FfmpegExportService will kill its process
    if (this.activeJobs.has(jobId)) {
      console.log(`[ExportQueue] Job ${jobId} is active, cancelling via service`);
      FfmpegExportService.cancelJob(jobId);
      this.activeJobs.delete(jobId);
      exportJobService.updateJob(jobId, { status: "cancelled" });
      this.processNext();
      return true;
    }

    return false;
  }

  public getActiveCount(): number {
    return this.activeJobs.size;
  }

  public getQueuedCount(): number {
    return this.queue.length;
  }

  public onJobFinished(jobId: string) {
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId);
      console.log(`[ExportQueue] Job ${jobId} finished. Active count: ${this.activeJobs.size}`);
      this.processNext();
    }
  }

  private processNext(): void {
    if (this.activeJobs.size >= this.maxConcurrency) {
      console.log(`[ExportQueue] Concurrency limit of ${this.maxConcurrency} reached.`);
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    // Check if job was cancelled while in queue
    const job = exportJobService.getJob(item.jobId);
    if (!job || job.status === "cancelled") {
      console.log(`[ExportQueue] Job ${item.jobId} was cancelled before starting. Skipping.`);
      this.processNext();
      return;
    }

    // Mark as processing
    this.activeJobs.add(item.jobId);
    console.log(`[ExportQueue] Starting Job ${item.jobId}. Active count: ${this.activeJobs.size}`);

    // Update state transition
    exportJobService.updateJob(item.jobId, {
      status: "processing",
      stage: "validating",
    });

    FfmpegExportService.executeExport(
      item.jobId,
      item.metadata,
      item.inputPath,
      item.outputPath,
      item.tempDir
    )
      .then(() => {
        console.log(`[ExportQueue] Job ${item.jobId} completed successfully.`);
      })
      .catch((err) => {
        console.error(`[ExportQueue] Job ${item.jobId} failed with error:`, err);
      })
      .finally(() => {
        this.onJobFinished(item.jobId);
      });
  }
}

export const exportQueue = new ExportQueue();
