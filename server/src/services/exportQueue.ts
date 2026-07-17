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

export class ExportQueue {
  private queue: QueueItem[] = [];
  private activeJobs = new Set<string>();
  private maxConcurrency = Number(process.env.MAX_CONCURRENT_EXPORTS || "2");
  private acceptingNewJobs = true;
  private processingEnabled = true;

  constructor(options?: { maxConcurrency?: number }) {
    if (options?.maxConcurrency !== undefined) {
      this.maxConcurrency = options.maxConcurrency;
    }
  }

  public stopNewJobs(): void {
    this.acceptingNewJobs = false;
    this.processingEnabled = false;
    console.log(`[ExportQueue] Queue stopped. New jobs will be rejected and queued jobs won't start.`);
  }

  public resumeJobs(): void {
    this.acceptingNewJobs = true;
    this.processingEnabled = true;
    console.log(`[ExportQueue] Queue resumed.`);
  }

  public isAcceptingNewJobs(): boolean {
    return this.acceptingNewJobs;
  }

  public enqueue(
    jobId: string,
    projectId: string,
    inputPath: string,
    outputPath: string,
    metadata: ExportRequestMetadata,
    tempDir: string
  ): void {
    if (!this.acceptingNewJobs) {
      console.warn(`[ExportQueue] Queue is stopped. Rejecting Job ${jobId}.`);
      exportJobService.updateJob(jobId, { status: "failed" });
      return;
    }

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

  public async cancel(jobId: string): Promise<boolean> {
    // 1. If it's in the queue (waiting), remove it
    const index = this.queue.findIndex((item) => item.jobId === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`[ExportQueue] Cancelled queued job ${jobId}`);
      exportJobService.updateJob(jobId, { status: "cancelled" });
      return true;
    }

    // 2. If it is active, wait for the cancelJob process to fully terminate
    if (this.activeJobs.has(jobId)) {
      console.log(`[ExportQueue] Job ${jobId} is active, cancelling via service`);
      // Update job status to cancelled
      exportJobService.updateJob(jobId, { status: "cancelled" });
      
      // Cancel the job process and wait for it to exit
      await FfmpegExportService.cancelJob(jobId);
      
      // Wait a tiny bit to ensure the executeExport promise's finally block has fully run
      // and onJobFinished has been executed
      for (let i = 0; i < 10; i++) {
        if (!this.activeJobs.has(jobId)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      
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
    if (!this.processingEnabled) {
      console.log(`[ExportQueue] Processing is disabled. Not processing any further queued jobs.`);
      return;
    }

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
