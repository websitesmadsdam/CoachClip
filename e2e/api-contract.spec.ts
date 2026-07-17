import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("CoachClip - Direct API Contract Verification", () => {
  test("creates a real export job through API", async ({ request }) => {
    const videoPath = path.join(process.cwd(), "public/demo_basketball_video.mp4");
    expect(fs.existsSync(videoPath)).toBe(true);

    const metadata = {
      projectId: "proj_api_contract_test",
      projectTitle: "API Contract Test Project",
      clip: {
        startTime: 1.0,
        endTime: 6.0,
      },
      sourceVideo: {
        fileName: "demo_basketball_video.mp4",
        duration: 8.0,
      },
      annotations: [
        {
          id: "anno_text_1",
          type: "text",
          text: "API Test Text",
          startTime: 2.0,
          endTime: 4.0,
          x: 0.5,
          y: 0.5,
          color: "#ff0000",
          fontSize: 24,
        },
      ],
    };

    const response = await request.post("/api/exports", {
      multipart: {
        video: {
          name: "demo_basketball_video.mp4",
          mimeType: "video/mp4",
          buffer: fs.readFileSync(videoPath),
        },
        metadata: JSON.stringify(metadata),
      },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "queued",
    });
    expect(typeof body.jobId).toBe("string");
    expect(body.jobId.length).toBeGreaterThan(0);
  });
});
