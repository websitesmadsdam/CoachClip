/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExportJob, ExportStatus, ExportStage } from "../types/exportTypes";
import { config } from "../config";

class ExportJobService {
  private jobs = new Map<string, ExportJob>();

  public createJob(jobId: string, projectId: string): ExportJob {
    const ttlMs = config.outputTtlMinutes * 60 * 1000;
    const now = Date.now();
    const job: ExportJob = {
      jobId,
      projectId,
      status: "queued",
      stage: "validating",
      progress: 0,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.jobs.set(jobId, job);
    return job;
  }

  public getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  public updateJob(
    jobId: string,
    updates: Partial<Omit<ExportJob, "jobId" | "projectId" | "createdAt">>
  ): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const updatedJob = {
      ...job,
      ...updates,
    };
    this.jobs.set(jobId, updatedJob);
    return updatedJob;
  }

  public getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  public deleteJob(jobId: string) {
    this.jobs.delete(jobId);
  }
}

export const exportJobService = new ExportJobService();
