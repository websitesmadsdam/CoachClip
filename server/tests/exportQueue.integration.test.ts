import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { ExportQueue } from "../src/services/exportQueue";
import { exportJobService } from "../src/services/exportJobService";
import { FfmpegExportService } from "../src/services/ffmpegExportService";
import { ExportRequestMetadata } from "../src/types/exportTypes";

// Mock FfmpegExportService so we do not run real slow ffmpeg child processes during queue tests
vi.mock("../src/services/ffmpegExportService", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const service = actual.FfmpegExportService as Record<string, unknown>;
  service.executeExport = vi.fn();
  service.getVideoDimensions = vi.fn();
  return actual;
});

const createTestMetadata = (): ExportRequestMetadata => ({
  projectId: "proj-1",
  projectTitle: "Testprojekt",
  clip: {
    startTime: 0,
    endTime: 4,
  },
  sourceVideo: {
    fileName: "in.mp4",
    duration: 10,
    width: 1280,
    height: 720,
  },
  annotations: [],
  output: {
    maxWidth: 1280,
    maxHeight: 720,
    format: "mp4",
  },
});

describe("ExportQueue - Integration Tests", () => {
  let executeMock: MockInstance<typeof FfmpegExportService.executeExport>;
  let queue: ExportQueue;

  beforeEach(() => {
    vi.resetAllMocks();
    // Configure concurrency to 1 for clean FIFO/limit validation
    process.env.MAX_CONCURRENT_EXPORTS = "1";
    queue = new ExportQueue({ maxConcurrency: 1 });

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
    queue.enqueue("job-1", "proj-1", "in.mp4", "out-1.mp4", createTestMetadata(), "tmp");
    expect(queue.getActiveCount()).toBe(1);
    expect(queue.getQueuedCount()).toBe(0);

    const job1 = exportJobService.getJob("job-1");
    expect(job1?.status).toBe("processing");

    // Enqueue second and third jobs while job-1 is active
    queue.enqueue("job-2", "proj-1", "in.mp4", "out-2.mp4", createTestMetadata(), "tmp");
    queue.enqueue("job-3", "proj-1", "in.mp4", "out-3.mp4", createTestMetadata(), "tmp");

    // Check concurrency limit is enforced: only 1 active, 2 queued
    expect(queue.getActiveCount()).toBe(1);
    expect(queue.getQueuedCount()).toBe(2);

    const job2 = exportJobService.getJob("job-2");
    const job3 = exportJobService.getJob("job-3");
    expect(job2?.status).toBe("queued");
    expect(job3?.status).toBe("queued");

    // Complete job-1
    console.log("Resolving job-1...");
    jobResolvers["job-1"]();
    // Yield execution to allow microtask queue to run
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // After job-1 completes, FIFO queue should automatically start job-2
    expect(queue.getActiveCount()).toBe(1);
    expect(queue.getQueuedCount()).toBe(1);

    const updatedJob2 = exportJobService.getJob("job-2");
    const updatedJob3 = exportJobService.getJob("job-3");
    expect(updatedJob2?.status).toBe("processing");
    expect(updatedJob3?.status).toBe("queued");

    // Complete job-2
    console.log("Resolving job-2...");
    jobResolvers["job-2"]();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // Job-3 should now start
    expect(queue.getActiveCount()).toBe(1);
    expect(queue.getQueuedCount()).toBe(0);

    const finalJob3 = exportJobService.getJob("job-3");
    expect(finalJob3?.status).toBe("processing");

    // Complete job-3
    console.log("Resolving job-3...");
    jobResolvers["job-3"]();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // Queue is empty
    expect(queue.getActiveCount()).toBe(0);
    expect(queue.getQueuedCount()).toBe(0);
  });

  it("should handle queued job cancellation and bypass processing", async () => {
    const jobIds = ["job-a", "job-b"];
    for (const jid of jobIds) {
      exportJobService.createJob(jid, "proj-2");
    }

    let jobAResolve: () => void = () => {};
    const jobAPromise = new Promise<void>((resolve) => {
      jobAResolve = resolve;
    });
    executeMock.mockImplementation((jobId: string) => {
      if (jobId === "job-a") return jobAPromise;
      return Promise.resolve();
    });

    // Enqueue job-a (becomes active)
    queue.enqueue("job-a", "proj-2", "in.mp4", "out-a.mp4", createTestMetadata(), "tmp");
    // Enqueue job-b (stays queued)
    queue.enqueue("job-b", "proj-2", "in.mp4", "out-b.mp4", createTestMetadata(), "tmp");

    expect(queue.getActiveCount()).toBe(1);
    expect(queue.getQueuedCount()).toBe(1);

    // Cancel job-b while it's in the queue
    const cancelResult = await queue.cancel("job-b");
    expect(cancelResult).toBe(true);
    expect(queue.getQueuedCount()).toBe(0);

    const jobB = exportJobService.getJob("job-b");
    expect(jobB?.status).toBe("cancelled");

    // Resolve job-a
    jobAResolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // Both should be finished and no further exports should have run
    expect(queue.getActiveCount()).toBe(0);
    expect(executeMock).toHaveBeenCalledTimes(1); // Only job-a was executed
  });

  it("should handle active job cancellation with concurrency limit 2", async () => {
    // 1. Set concurrency to 2
    process.env.MAX_CONCURRENT_EXPORTS = "2";
    queue = new ExportQueue({ maxConcurrency: 2 });

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
    vi.spyOn(FfmpegExportService, "cancelJob").mockImplementation(async () => {
      cancelCalled = true;
      // Simulate process exit delay of 100ms
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
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
    queue.enqueue("job-1", "proj-1", "in.mp4", "out-1.mp4", createTestMetadata(), "tmp");
    queue.enqueue("job-2", "proj-1", "in.mp4", "out-2.mp4", createTestMetadata(), "tmp");
    queue.enqueue("job-3", "proj-1", "in.mp4", "out-3.mp4", createTestMetadata(), "tmp");

    // job-1 and job-2 should be active, job-3 should be queued
    expect(queue.getActiveCount()).toBe(2);
    expect(queue.getQueuedCount()).toBe(1);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);

    // Cancel job-1
    const cancelPromise = queue.cancel("job-1");
    
    // Status should be marked as cancelled immediately
    const job1 = exportJobService.getJob("job-1");
    expect(job1?.status).toBe("cancelled");

    // job-3 must NOT start yet because job-1 process hasn't finished stopping
    expect(queue.getQueuedCount()).toBe(1);
    expect(queue.getActiveCount()).toBe(2);

    // Wait for cancellation to resolve
    await cancelPromise;

    // Trigger the executeExport promise's finally block to simulate process exit on cancel
    resolvers["job-1"]();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // Now, job-3 should have started and queue should be updated
    expect(queue.getQueuedCount()).toBe(0);
    expect(queue.getActiveCount()).toBe(2); // job-2 and job-3 active
    expect(cancelCalled).toBe(true);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);

    // Resolve remaining jobs
    resolvers["job-2"]();
    resolvers["job-3"]();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(queue.getActiveCount()).toBe(0);
    expect(queue.getQueuedCount()).toBe(0);

    console.log(`[Test Log] Højeste observerede antal samtidige FFmpeg-processer: ${maxObservedConcurrency}`);
    expect(maxObservedConcurrency).toBe(2);
  });
});
