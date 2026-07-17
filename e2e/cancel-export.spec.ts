import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { TEST_VIDEO, waitForExportCreation } from "./fixtures/testVideo";

test.describe("CoachClip - Export Cancellation", () => {
  test("should successfully cancel an active export and clean up the job on the backend", async ({ page, request }) => {
    // Register event listeners to capture and log API errors
    page.on("requestfailed", req => {
      if (req.url().includes("/api/")) {
        console.error(
          `[API REQUEST FAILED] ${req.method()} ${req.url()}: ` +
          `${req.failure()?.errorText}`
        );
      }
    });

    page.on("response", async res => {
      if (
        res.url().includes("/api/") &&
        res.status() >= 400
      ) {
        console.error(
          `[API RESPONSE ERROR] ${res.status()} ${res.url()}: ` +
          `${await res.text()}`
        );
      }
    });

    // Validate actual duration of the test video before proceeding
    const actualDurationStr = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${TEST_VIDEO.path}"`
    ).toString().trim();
    const actualDuration = parseFloat(actualDurationStr);
    expect(actualDuration).toBeGreaterThanOrEqual(TEST_VIDEO.trimEnd);

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    
    // 1. Open home page and proceed to video select screen
    await page.goto("/");
    await page.locator("button:has-text('Nyt analyseklip')").first().click();

    // 2. Click "Prøv en demo basketball-video"
    await page.locator("button:has-text('Prøv en demo basketball-video')").click();

    // 3. Clip Selection (Choose / Trim) -> Click next
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

    // 4. Fine-Tuning Screen -> Click next
    await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
    await page.locator("button:has-text('Klip er korrekt: Tegn')").click();

    // 5. Drawing Workspace -> Go next
    await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
    await page.locator("button:has-text('Næste: Gennemse klip')").click();

    // 6. Review -> Click save
    await expect(page.locator("h3:has-text('Gennemse dit klip')")).toBeVisible();
    await page.locator("button:has-text('Ja, gem klip')").click();

    // 7. Save Settings -> Click export
    await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
    await page.locator("button:has-text('Gem og eksportér')").click();

    // 8. Privacy Warning Dialogue
    await expect(page.getByText("Beskyttelse af dine videoer")).toBeVisible();

    // Setup listener to intercept the export job creation and cancellation
    let jobId: string | null = null;
    page.on("response", async (response) => {
      const url = response.url();
      if (url.endsWith("/api/exports") && response.request().method() === "POST") {
        try {
          const body = await response.json();
          jobId = body.jobId;
          console.log("Intercepted created jobId:", jobId);
        } catch {
          // ignore
        }
      }
    });

    let deleteFired = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/exports/") && req.method() === "DELETE") {
        deleteFired = true;
        console.log("Intercepted DELETE request to:", req.url());
      }
    });

    // Start real export
    const createPromise = waitForExportCreation(page);

    await page.getByRole("button", { name: "Fortsæt og eksporter" }).click();

    await expect(page.getByText("Beskyttelse af dine videoer")).not.toBeVisible();

    const observation = await createPromise;

    expect(
      observation.status,
      `POST /api/exports failed.
URL: ${observation.requestUrl}
Status: ${observation.status}
Content-Type: ${observation.contentType}
Body: ${observation.responseBody}`
    ).toBe(202);

    const bodyObj = JSON.parse(observation.responseBody);
    expect(bodyObj).toMatchObject({
      status: "queued",
    });
    expect(typeof bodyObj.jobId).toBe("string");
    expect(bodyObj.jobId.length).toBeGreaterThan(0);
    jobId = bodyObj.jobId;

    // Wait until progress loader starts (progress >= 0%)
    await expect(page.locator("h3:has-text('Uploader video...')").or(page.locator("h3:has-text('Opretter dit taktikklip')"))).toBeVisible({ timeout: 15000 });

    // Poll backend directly until the job is queued or processing
    await expect
      .poll(async () => {
        const response = await request.get(`/api/exports/${jobId}`);
        const body = await response.json();
        return body.status;
      }, { timeout: 10000 })
      .toMatch(/queued|processing/);

    console.log("Clicking 'Afbryd eksport' button...");
    await page.locator("button:has-text('Afbryd eksport')").click();

    // Verify UI updates back to the failure / cancelled screen
    await expect(page.locator("h3:has-text('Eksporten fejlede')")).toBeVisible();
    await expect(page.locator("p:has-text('Eksporten blev afbrudt.')")).toBeVisible();

    // Confirm that the DELETE route was triggered
    expect(deleteFired).toBe(true);

    // Poll backend to verify job status is indeed cancelled
    await expect
      .poll(async () => {
        const response = await request.get(`/api/exports/${jobId}`);
        const body = await response.json();
        return body.status;
      }, { timeout: 5000 })
      .toBe("cancelled");
  });
});
