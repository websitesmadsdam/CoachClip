import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportQueue } from "../src/services/exportQueue";
import { exportJobService } from "../src/services/exportJobService";
import { FfmpegExportService } from "../src/services/ffmpegExportService";

// Mock FfmpegExportService so we do not run real slow ffmpeg child processes during queue tests
vi.mock("../src/services/ffmpegExportService", async (importOriginal) => {
  const actual = await importOriginal<any>();
  actual.FfmpegExportService.executeExport = vi.fn();
  actual.FfmpegExportService.getVideoDimensions = vi.fn();
  return actual;
});

describe("ExportQueue - Integration Tests", () => {
  let executeMock: any;

  beforeEach(() => {
    vi.resetAllMocks();
    // Configure concurrency to 1 for clean FIFO/limit validation
    process.env.MAX_CONCURRENT_EXPORTS = "1";
    // Access private properties/recreate queue state implicitly by clearing active structures
    (exportQueue as any).queue = [];
    (exportQueue as any).activeJobs = new Set<string>();
    (exportQueue as any).maxConcurrency = 1;

    executeMock = vi.spyOn(FfmpegExportService, "executeExport");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should enforce concurrency limits and process jobs sequentially in FIFO order", async () => {
    const jobIds = ["job-1", "job-2", "job-3"];
    
    // Create job entries in exportJobService
    for (const jid of jobIds) {
      exportJobService.createJob(jid, "proj-1");
    }

    // Prepare resolvers to control job execution timing manually
    const jobResolvers: Record<string, () => void> = {};
    const jobPromises = jobIds.map((jid) => {
      return new Promise<void>((resolve) => {
        jobResolvers[jid] = resolve;
      });
    });

    // When executeExport is called, hold it active until we trigger the resolver
    executeMock.mockImplementation((jobId: string) => {
      return jobPromises[jobIds.indexOf(jobId)];
    });

    // Enqueue first job
    exportQueue.enqueue("job-1", "proj-1", "in.mp4", "out-1.mp4", {} as any, "tmp");
    expect(exportQueue.getActiveCount()).toBe(1);
    expect(exportQueue.getQueuedCount()).toBe(0);

    const job1 = exportJobService.getJob("job-1");
    expect(job1?.status).toBe("processing");

    // Enqueue second and third jobs while job-1 is active
    exportQueue.enqueue("job-2", "proj-1", "in.mp4", "out-2.mp4", {} as any, "tmp");
    exportQueue.enqueue("job-3", "proj-1", "in.mp4", "out-3.mp4", {} as any, "tmp");

    // Check concurrency limit is enforced: only 1 active, 2 queued
    expect(exportQueue.getActiveCount()).toBe(1);
    expect(exportQueue.getQueuedCount()).toBe(2);

    const job2 = exportJobService.getJob("job-2");
    const job3 = exportJobService.getJob("job-3");
    expect(job2?.status).toBe("queued");
    expect(job3?.status).toBe("queued");

    // Complete job-1
    console.log("Resolving job-1...");
    jobResolvers["job-1"]();
    // Yield execution to allow microtask queue to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    // After job-1 completes, FIFO queue should automatically start job-2
    expect(exportQueue.getActiveCount()).toBe(1);
    expect(exportQueue.getQueuedCount()).toBe(1);

    const updatedJob2 = exportJobService.getJob("job-2");
    const updatedJob3 = exportJobService.getJob("job-3");
    expect(updatedJob2?.status).toBe("processing");
    expect(updatedJob3?.status).toBe("queued");

    // Complete job-2
    console.log("Resolving job-2...");
    jobResolvers["job-2"]();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Job-3 should now start
    expect(exportQueue.getActiveCount()).toBe(1);
    expect(exportQueue.getQueuedCount()).toBe(0);

    const finalJob3 = exportJobService.getJob("job-3");
    expect(finalJob3?.status).toBe("processing");

    // Complete job-3
    console.log("Resolving job-3...");
    jobResolvers["job-3"]();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Queue is empty
    expect(exportQueue.getActiveCount()).toBe(0);
    expect(exportQueue.getQueuedCount()).toBe(0);
  });

  it("should handle queued job cancellation and bypass processing", async () => {
    const jobIds = ["job-a", "job-b"];
    for (const jid of jobIds) {
      exportJobService.createJob(jid, "proj-2");
    }

    let jobAResolve: any;
    const jobAPromise = new Promise<void>((r) => { jobAResolve = r; });
    executeMock.mockImplementation((jobId: string) => {
      if (jobId === "job-a") return jobAPromise;
      return Promise.resolve();
    });

    // Enqueue job-a (becomes active)
    exportQueue.enqueue("job-a", "proj-2", "in.mp4", "out-a.mp4", {} as any, "tmp");
    // Enqueue job-b (stays queued)
    exportQueue.enqueue("job-b", "proj-2", "in.mp4", "out-b.mp4", {} as any, "tmp");

    expect(exportQueue.getActiveCount()).toBe(1);
    expect(exportQueue.getQueuedCount()).toBe(1);

    // Cancel job-b while it's in the queue
    const cancelResult = await exportQueue.cancel("job-b");
    expect(cancelResult).toBe(true);
    expect(exportQueue.getQueuedCount()).toBe(0);

    const jobB = exportJobService.getJob("job-b");
    expect(jobB?.status).toBe("cancelled");

    // Resolve job-a
    jobAResolve();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Both should be finished and no further exports should have run
    expect(exportQueue.getActiveCount()).toBe(0);
    expect(executeMock).toHaveBeenCalledTimes(1); // Only job-a was executed
  });

  it("should handle active job cancellation with concurrency limit 2", async () => {
    // 1. Set concurrency to 2
    (exportQueue as any).maxConcurrency = 2;
    process.env.MAX_CONCURRENT_EXPORTS = "2";

    const jobIds = ["job-1", "job-2", "job-3"];
    for (const jid of jobIds) {
      exportJobService.createJob(jid, "proj-1");
    }

    // Track concurrent active jobs / FFmpeg processes
    let activeFfmpegCount = 0;
    let maxObservedConcurrency = 0;

    // Prepare resolvers to control job execution timing
    const resolvers: Record<string, () => void> = {};

    let cancelCalled = false;
    const cancelMock = vi.spyOn(FfmpegExportService, "cancelJob").mockImplementation(async (jid) => {
      cancelCalled = true;
      // Simulate process exit delay of 100ms
      await new Promise((r) => setTimeout(r, 100));
      return true;
    });

    executeMock.mockImplementation((jobId: string) => {
      activeFfmpegCount++;
      if (activeFfmpegCount > maxObservedConcurrency) {
        maxObservedConcurrency = activeFfmpegCount;
      }
      return new Promise<void>((resolve) => {
        resolvers[jobId] = () => {
          activeFfmpegCount--;
          resolve();
        };
      });
    });

    // Enqueue 3 jobs
    exportQueue.enqueue("job-1", "proj-1", "in.mp4", "out-1.mp4", {} as any, "tmp");
    exportQueue.enqueue("job-2", "proj-1", "in.mp4", "out-2.mp4", {} as any, "tmp");
    exportQueue.enqueue("job-3", "proj-1", "in.mp4", "out-3.mp4", {} as any, "tmp");

    // job-1 and job-2 should be active, job-3 should be queued
    expect(exportQueue.getActiveCount()).toBe(2);
    expect(exportQueue.getQueuedCount()).toBe(1);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);

    // Cancel job-1
    const cancelPromise = exportQueue.cancel("job-1");
    
    // Status should be marked as cancelled immediately
    const job1 = exportJobService.getJob("job-1");
    expect(job1?.status).toBe("cancelled");

    // job-3 must NOT start yet because job-1 process hasn't finished stopping
    expect(exportQueue.getQueuedCount()).toBe(1);
    expect(exportQueue.getActiveCount()).toBe(2);

    // Wait for cancellation to resolve
    await cancelPromise;

    // Trigger the executeExport promise's finally block to simulate process exit on cancel
    resolvers["job-1"]();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now, job-3 should have started and queue should be updated
    expect(exportQueue.getQueuedCount()).toBe(0);
    expect(exportQueue.getActiveCount()).toBe(2); // job-2 and job-3 active
    expect(cancelCalled).toBe(true);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);

    // Resolve remaining jobs
    resolvers["job-2"]();
    resolvers["job-3"]();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(exportQueue.getActiveCount()).toBe(0);
    expect(exportQueue.getQueuedCount()).toBe(0);

    console.log(`[Test Log] Højeste observerede antal samtidige FFmpeg-processer: ${maxObservedConcurrency}`);
    expect(maxObservedConcurrency).toBe(2);
  });
});
