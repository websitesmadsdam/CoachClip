import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportQueue } from "../src/services/exportQueue";
import { exportJobService } from "../src/services/exportJobService";
import { FfmpegExportService } from "../src/services/ffmpegExportService";

// Mock FfmpegExportService so we do not run real slow ffmpeg child processes during queue tests
vi.mock("../src/services/ffmpegExportService", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    FfmpegExportService: {
      ...actual.FfmpegExportService,
      executeExport: vi.fn(),
      getVideoDimensions: vi.fn(),
    }
  };
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
      exportJobService.createJob(jid, {
        projectId: "proj-1",
        clip: { startTime: 0, endTime: 5 },
        sourceVideo: { fileName: "test.mp4", duration: 10, width: 640, height: 360 },
        annotations: [],
        output: { maxWidth: 640, maxHeight: 360, format: "mp4" }
      });
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
      exportJobService.createJob(jid, {
        projectId: "proj-2",
        clip: { startTime: 0, endTime: 5 },
        sourceVideo: { fileName: "test.mp4", duration: 10, width: 640, height: 360 },
        annotations: [],
        output: { maxWidth: 640, maxHeight: 360, format: "mp4" }
      });
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
    const cancelResult = exportQueue.cancel("job-b");
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
});
