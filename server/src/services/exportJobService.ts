/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: Types are exported for external modules but flagged locally.
 */

import { ExportJob, ExportStatus, ExportStage } from "../types/exportTypes";
import { config } from "../config";

class ExportJobService {
  private jobs = new Map<string, ExportJob>();

  public createJob(jobId: string, projectId: string): ExportJob {
    const now = Date.now();
    const job: ExportJob = {
      jobId,
      projectId,
      status: "queued",
      stage: "waiting",
      progress: 0,
      createdAt: now,
    };
    this.jobs.set(jobId, job);
    return job;
  }

  public getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  public transitionJob(
    jobId: string,
    updates: Partial<Omit<ExportJob, "jobId" | "projectId" | "createdAt">>
  ): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    // Once cancelled, failed, or expired, do not overwrite status with active ones (queued/processing/completed)
    if (job.status === "cancelled" || job.status === "failed" || job.status === "expired") {
      if (updates.status === "queued" || updates.status === "processing" || updates.status === "completed") {
        // Return existing job without applying status updates that revert final states
        return job;
      }
    }

    const nextStatus = updates.status ?? job.status;
    let nextStage = updates.stage ?? job.stage;

    // Auto-align stage if status transitions and stage is not explicitly specified
    if (updates.status && !updates.stage) {
      if (updates.status === "completed") {
        nextStage = "completed";
      } else if (updates.status === "queued") {
        nextStage = "waiting";
      }
    }

    console.log(`[ExportJobService] transitionJob ${jobId}: currentStatus=${job.status}, currentStage=${job.stage} -> updates=${JSON.stringify(updates)} -> nextStatus=${nextStatus}, nextStage=${nextStage}`);

    // Validation rules:
    // 1. queued must only use stage waiting
    if (nextStatus === "queued" && nextStage && nextStage !== "waiting") {
      throw new Error(`Ulovlig tilstand: status=queued kan kun have stage=waiting, fik stage=${nextStage}`);
    }
    // 2. completed must use stage completed
    if (nextStatus === "completed" && nextStage && nextStage !== "completed") {
      throw new Error(`Ulovlig tilstand: status=completed kan kun have stage=completed, fik stage=${nextStage}`);
    }
    // 3. processing must not use waiting or completed
    if (nextStatus === "processing" && nextStage && (nextStage === "waiting" || nextStage === "completed")) {
      throw new Error(`Ulovlig tilstand: status=processing kan ikke have stage=${nextStage}`);
    }

    const updatedJob = {
      ...job,
      ...updates,
      status: nextStatus,
      stage: nextStage,
    };
    this.jobs.set(jobId, updatedJob);
    return updatedJob;
  }

  public updateJob(
    jobId: string,
    updates: Partial<Omit<ExportJob, "jobId" | "projectId" | "createdAt">>
  ): ExportJob | undefined {
    return this.transitionJob(jobId, updates);
  }

  public getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  public deleteJob(jobId: string) {
    this.jobs.delete(jobId);
  }
}

export const exportJobService = new ExportJobService();
