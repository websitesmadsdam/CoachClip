/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: simple standalone smoke test script uses raw any and ignored args for flexibility.
 */

import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runApiSmokeTest() {
  const customBaseUrl = process.env.SMOKE_API_BASE_URL;
  const PORT = "3009";
  const baseUrl = customBaseUrl || `http://localhost:${PORT}`;
  const inputPath = path.resolve("test_input_api.mp4");
  const outputPath = path.resolve("test_output_api.mp4");
  let serverProc: any = null;

  console.log("--- STARTING API SMOKE TEST: SIMPLE EXPORT ---");

  // Cleanup potential leftover files
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  let serverExit:
    | { code: number | null; signal: NodeJS.Signals | null }
    | undefined;
  const stderrLines: string[] = [];

  try {
    if (!customBaseUrl) {
      // 1. Start the test server
      console.log(`Step 1: Spawning test server on port ${PORT}...`);
      serverProc = spawn("npx", ["tsx", "server.ts"], {
        shell: false,
        detached: true,
        env: {
          ...process.env,
          PORT,
          NODE_ENV: "production",
          CORS_ORIGIN: `http://127.0.0.1:${PORT}`,
          TEMP_DIR: "./tmp/api_test_temp"
        }
      });

      serverProc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        serverExit = { code, signal };
      });

      // Capture server output for debugging if needed
      serverProc.stdout.on("data", (data: any) => {
        console.log(`[Server STDOUT] ${data.toString().trim()}`);
      });
      serverProc.stderr.on("data", (data: any) => {
        const text = data.toString();
        stderrLines.push(text);
        console.error(`[Server STDERR] ${text.trim()}`);
      });
    } else {
      console.log(`Step 1: Using existing test server at ${baseUrl}...`);
    }

    // Wait for server to become healthy
    console.log("Waiting for server to become healthy...");
    let healthy = false;
    for (let i = 0; i < 20; i++) {
      if (!customBaseUrl && serverExit) {
        const errorLog = stderrLines.join("").trim();
        throw new Error(
          `Test server exited before healthcheck: code=${serverExit.code}, signal=${serverExit.signal}\nStderr:\n${errorLog}`
        );
      }
      await delay(1000);
      if (!customBaseUrl && serverExit) {
        const errorLog = stderrLines.join("").trim();
        throw new Error(
          `Test server exited before healthcheck: code=${serverExit.code}, signal=${serverExit.signal}\nStderr:\n${errorLog}`
        );
      }
      try {
        const readyRes = await fetch(`${baseUrl}/api/ready`);
        if (readyRes.ok) {
          const readyJson = await readyRes.json();
          console.log("Server readiness response:", readyJson);
          if (
            readyJson.status === "ready" &&
            readyJson.ffmpeg === true &&
            readyJson.ffprobe === true
          ) {
            healthy = true;
            break;
          }
        }
      } catch (e) {
        // Server not ready yet
      }
    }

    if (!healthy) {
      throw new Error("Server failed to start or pass healthcheck within 20 seconds.");
    }

    // 2. Generate a small synthetic video (6s, H.264/AAC, 640x360)
    console.log("Step 2: Generating synthetic test video...");
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=6:size=640x360:rate=30 -f lavfi -i "sine=frequency=1000:duration=6" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y "${inputPath}"`,
      { stdio: "ignore" }
    );
    console.log("Synthetic video generated at:", inputPath);

    // 3. Prepare multipart metadata and payload
    console.log("Step 3: Sending POST /api/exports request...");
    const metadata = {
      projectId: "smoke_project_api",
      clip: {
        startTime: 1.0,
        endTime: 5.0
      },
      annotations: [] // Simple export: no annotations
    };

    const formData = new FormData();
    const fileBuffer = fs.readFileSync(inputPath);
    const fileBlob = new Blob([fileBuffer], { type: "video/mp4" });
    formData.append("video", fileBlob, "test_input_api.mp4");
    formData.append("metadata", JSON.stringify(metadata));

    const postRes = await fetch(`${baseUrl}/api/exports`, {
      method: "POST",
      body: formData
    });

    if (!postRes.ok) {
      const errorText = await postRes.text();
      throw new Error(`POST /api/exports failed with status ${postRes.status}: ${errorText}`);
    }

    const postJson = await postRes.json();
    console.log("POST Response received:", postJson);
    const jobId = postJson.jobId;
    if (!jobId) {
      throw new Error("No jobId returned in POST response.");
    }

    // 4. Poll job status
    console.log(`Step 4: Polling status of job ${jobId}...`);
    let jobCompleted = false;
    let finalJobState: any = null;

    for (let pollCount = 0; pollCount < 60; pollCount++) {
      await delay(1000);
      const pollRes = await fetch(`${baseUrl}/api/exports/${jobId}`);
      if (!pollRes.ok) {
        throw new Error(`GET /api/exports/${jobId} failed with status ${pollRes.status}`);
      }
      const job = await pollRes.json();
      console.log(`Poll #${pollCount + 1}: Status = ${job.status}, Stage = ${job.stage}, Progress = ${job.progress}%`);
      
      if (job.status === "completed") {
        jobCompleted = true;
        finalJobState = job;
        break;
      }
      if (job.status === "failed") {
        finalJobState = job;
        break;
      }
    }

    if (!jobCompleted) {
      console.error("\n--- JOB FAILED OR TIMED OUT ---");
      if (finalJobState) {
        console.error(`Final Job Status: ${finalJobState.status}`);
        console.error(`Stage: ${finalJobState.stage}`);
        console.error(`Error Code: ${finalJobState.errorCode}`);
        console.error(`User Message: ${finalJobState.userMessage}`);
        // Log additional details if available
        if (finalJobState.ffmpegStderr) {
          console.error("FFmpeg stderr logs:", finalJobState.ffmpegStderr);
        }
      }
      throw new Error("Job did not complete successfully.");
    }

    // 5. Download the final output video
    console.log("Step 5: Downloading output video...");
    const downloadUrl = finalJobState.output.downloadUrl;
    const finalDownloadUrl = downloadUrl.startsWith("http") ? downloadUrl : (baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl) + downloadUrl;
    console.log("Download URL:", finalDownloadUrl);

    const downloadRes = await fetch(finalDownloadUrl);
    if (!downloadRes.ok) {
      throw new Error(`Download failed with status ${downloadRes.status}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    console.log("Downloaded file saved to:", outputPath);

    // 6. Validate output file with ffprobe
    console.log("Step 6: Validating downloaded output file with ffprobe...");
    const stats = fs.statSync(outputPath);
    console.log(`Output size: ${stats.size} bytes`);
    if (stats.size === 0) {
      throw new Error("Output file is empty!");
    }

    const formatProbe = execSync(
      `ffprobe -v error -show_entries format=duration,format_name -of json "${outputPath}"`
    ).toString();
    const formatData = JSON.parse(formatProbe);
    const duration = Number(formatData.format?.duration);
    console.log(`Detected duration: ${duration}s`);

    const tolerance = 0.15;
    if (Math.abs(duration - 4.0) > tolerance) {
      throw new Error(`Expected duration around 4.0s (tolerance ±${tolerance}s), got ${duration}s`);
    }

    console.log("\n--- API SMOKE TEST: SIMPLE EXPORT PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- API SMOKE TEST: SIMPLE EXPORT FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    // Graceful teardown of the test server
    if (serverProc && serverProc.pid) {
      console.log("Step 7: Shutting down the test server process group...");
      try {
        process.kill(-serverProc.pid, "SIGKILL");
      } catch (e) {
        // Process group may already be dead
      }
    }

    // Clean up test files
    console.log("Step 8: Cleaning up local test files...");
    if (fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch (e) {
        // ignore
      }
    }
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        // ignore
      }
    }
    console.log("Cleanup complete.");
  }
}

runApiSmokeTest();
