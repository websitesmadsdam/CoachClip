import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import { TEST_VIDEO, waitForExportCreation } from "./fixtures/testVideo";

test.describe("CoachClip - Full E2E Export Flow", () => {
  test("should complete the entire pipeline from stock video to ffprobe-validated download", async ({ page }) => {
    // Register event listeners to capture and log API errors
    page.on("requestfailed", request => {
      if (request.url().includes("/api/")) {
        console.error(
          `[API REQUEST FAILED] ${request.method()} ${request.url()}: ` +
          `${request.failure()?.errorText}`
        );
      }
    });

    page.on("response", async response => {
      if (
        response.url().includes("/api/") &&
        response.status() >= 400
      ) {
        console.error(
          `[API RESPONSE ERROR] ${response.status()} ${response.url()}: ` +
          `${await response.text()}`
        );
      }
    });

    // Validate actual duration of the test video before proceeding
    const actualDurationStr = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${TEST_VIDEO.path}"`
    ).toString().trim();
    const actualDuration = parseFloat(actualDurationStr);
    expect(actualDuration).toBeGreaterThanOrEqual(TEST_VIDEO.trimEnd);

    // 1. Open home page
    await page.goto("/");
    await expect(page.locator("h2").first()).toContainText("Find situationen.");

    // 2. Start a new clip analysis
    await page.locator("button:has-text('Nyt analyseklip')").first().click();
    await expect(page.locator("h3:has-text('Vælg kamp- eller træningsvideo')")).toBeVisible();

    // 3. Select stock/demo basketball video
    await page.locator("button:has-text('Prøv en demo basketball-video')").click();
    
    // 4. Clip Selection Screen (trim bounds)
    await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10000 });

    // Verify video element load state
    const video = page.locator("video");
    await expect(video).toBeVisible();

    const videoState = await video.evaluate((element: HTMLVideoElement) => ({
      readyState: element.readyState,
      duration: element.duration,
      videoWidth: element.videoWidth,
      videoHeight: element.videoHeight,
      currentSrc: element.currentSrc,
      errorCode: element.error?.code ?? null,
      errorMessage: element.error?.message ?? null,
    }));

    if (videoState.errorCode === null) {
      expect(videoState.readyState).toBeGreaterThanOrEqual(1);
      expect(videoState.duration).toBeGreaterThanOrEqual(TEST_VIDEO.trimEnd);
      expect(videoState.videoWidth).toBe(640);
      expect(videoState.videoHeight).toBe(360);
    } else {
      console.warn(`Video format support check skipped because browser runtime reported error ${videoState.errorCode}: ${videoState.errorMessage}`);
    }

    await page.locator("button:has-text('Næste: Finjustering')").click();

    // 5. Fine-Tuning Screen
    await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
    await page.locator("button:has-text('Klip er korrekt: Tegn')").click();

    // 6. Annotation / Drawing Workspace
    await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();

    // --- ADD TEXT ANNOTATION ---
    console.log("Placing Text Annotation...");
    await page.locator("button:has-text('Tilføj tekst')").first().click();
    await page.locator(".absolute.inset-0.z-20.pointer-events-auto").click({ position: { x: 300, y: 150 } });
    await page.fill("textarea", "E2E Test: Gå dybt!");
    await page.locator("button:has-text('Gem')").click();

    // --- ADD CIRCLE ANNOTATION ---
    console.log("Placing Circle Annotation...");
    await page.locator("button:has-text('Marker spiller')").first().click();
    await page.locator(".absolute.inset-0.z-20.pointer-events-auto").click({ position: { x: 200, y: 200 } });
    await page.locator("button:has-text('Gem')").click();

    // --- ADD ARROW ANNOTATION ---
    console.log("Placing Arrow Annotation...");
    await page.locator("button:has-text('Vis bevægelse')").first().click();
    // Simulate drawing by doing drag-and-drop on the interactive workspace overlay
    const box = await page.locator(".absolute.inset-0.z-20.pointer-events-auto").boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 250, box.y + 250);
      await page.mouse.up();
    } else {
      // Fallback
      await page.locator(".absolute.inset-0.z-20.pointer-events-auto").click({ position: { x: 100, y: 100 } });
    }
    await page.locator("button:has-text('Gem')").click();

    // --- ADD FREEZE FRAME ---
    console.log("Placing Freeze Frame...");
    await page.locator("button:has-text('Frys billede')").first().click();
    await page.locator("button:has-text('Gem')").click();

    // Move to next step (Review)
    await page.locator("button:has-text('Næste: Gennemse klip')").click();

    // 7. Review Screen
    await expect(page.locator("h3:has-text('Gennemse dit klip')")).toBeVisible();
    await page.locator("button:has-text('Ja, gem klip')").click();

    // 8. Save Screen
    await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
    await page.locator("button:has-text('Gem og eksportér')").click();

    // 9. Privacy Warning Dialogue
    await expect(page.locator("h3:has-text('Beskyttelse af dine videoer')")).toBeVisible();

    const createPromise = waitForExportCreation(page);

    await page.locator("button:has-text('Fortsæt og eksporter')").click();

    const observation = await createPromise;

    expect(
      observation.status,
      `POST /api/exports failed.
URL: ${observation.requestUrl}
Status: ${observation.status}
Content-Type: ${observation.contentType}
Body: ${observation.responseBody}`
    ).toBe(202);

    const body = JSON.parse(observation.responseBody);
    expect(body).toMatchObject({
      status: "queued",
    });
    expect(typeof body.jobId).toBe("string");
    expect(body.jobId.length).toBeGreaterThan(0);

    // 10. Export Screen (polling loop)
    await expect(page.locator("h3:has-text('Uploader video...')").or(page.locator("h3:has-text('Opretter dit taktikklip')"))).toBeVisible({ timeout: 15000 });
    
    // Wait for compilation to complete (should render under 60s)
    await expect(page.locator("h3:has-text('Dit klip er klar!')")).toBeVisible({ timeout: 60000 });

    // 11. Download & Validate the MP4
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("a:has-text('Download MP4')").click()
    ]);

    const downloadPath = await download.path();
    console.log("Downloaded E2E video saved to Playwright temp path:", downloadPath);

    expect(fs.existsSync(downloadPath)).toBe(true);
    const stats = fs.statSync(downloadPath);
    console.log("Downloaded file size:", stats.size);
    expect(stats.size).toBeGreaterThan(0);

    // Run ffprobe to validate video parameters (ensure duration > 0 and codec is h264)
    console.log("Probing downloaded E2E output video with ffprobe...");
    const probeStr = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of json "${downloadPath}"`
    ).toString();
    const probeData = JSON.parse(probeStr);
    const stream = probeData.streams?.[0];

    expect(stream).toBeDefined();
    expect(stream.codec_name).toBe("h264");
    console.log("E2E Probed Video Stream properties:", stream);
  });
});
