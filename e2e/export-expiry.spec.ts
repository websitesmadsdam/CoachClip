import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { TEST_VIDEO } from "./fixtures/testVideo";

test.describe("CoachClip - Export Expiry TTL", () => {
  test("returns 410 when completed output file is missing", async ({ page, request }) => {
    // Validate actual duration of the test video before proceeding
    const actualDurationStr = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${TEST_VIDEO.path}"`
    ).toString().trim();
    const actualDuration = parseFloat(actualDurationStr);
    expect(actualDuration).toBeGreaterThanOrEqual(TEST_VIDEO.trimEnd);

    // 1. Navigate to home
    await page.goto("/");
    await page.locator("button:has-text('Nyt analyseklip')").first().click();

    // 2. Select demo video
    await page.locator("button:has-text('Prøv en demo basketball-video')").click();

    // 3. Wizard Trimming -> Next
    await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10000 });
    await page.locator("button:has-text('Næste: Finjustering')").click();

    // 4. Fine-Tune -> Next
    await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
    await page.locator("button:has-text('Klip er korrekt: Tegn')").click();

    // 5. Drawing Workspace -> Go next
    await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
    await page.locator("button:has-text('Næste: Gennemse klip')").click();

    // 6. Review -> Save
    await expect(page.locator("h3:has-text('Gennemse dit klip')")).toBeVisible();
    await page.locator("button:has-text('Ja, gem klip')").click();

    // 7. Save Settings -> Export
    await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
    await page.locator("button:has-text('Gem og eksportér')").click();

    // 8. Privacy Dialogue -> Start
    await expect(page.locator("h3:has-text('Beskyttelse af dine videoer')")).toBeVisible();

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

    const createResponsePromise = page.waitForResponse(
      response =>
        response.url().includes("/api/exports") &&
        response.request().method() === "POST"
    );

    await page.locator("button:has-text('Fortsæt og eksporter')").click();

    const createResponse = await createResponsePromise;
    const responseStatus = createResponse.status();
    const body = await createResponse.text();
    expect(responseStatus, `POST /api/exports failed with status ${responseStatus}: ${body}`).toBe(201);

    // 9. Wait for completion
    await expect(page.locator("h3:has-text('Dit klip er klar!')")).toBeVisible({ timeout: 60000 });

    if (!jobId) {
      throw new Error("Could not intercept a valid jobId.");
    }

    // 10. Verify job is completed on backend first
    console.log(`Querying job status for: ${jobId}`);
    const statusRes = await request.get(`/api/exports/${jobId}`);
    expect(statusRes.ok()).toBe(true);
    const statusData = await statusRes.json();
    expect(statusData.status).toBe("completed");

    // Prove download BEFORE expiry works
    const preDownloadUrl = `/api/exports/${jobId}/download`;
    console.log(`Testing pre-expiry download URL: ${preDownloadUrl}`);
    const preDownloadRes = await request.get(preDownloadUrl);
    expect(preDownloadRes.status()).toBe(200);

    // 11. Simulate Expiration/TTL by deleting the output file from the server's `TEMP_DIR/exports` folder
    const tempDir = process.env.TEMP_DIR || "./tmp";
    const exportsDir = path.resolve(tempDir, "exports");
    const files = fs.readdirSync(exportsDir);
    const matchingFile = files.find(f => f.startsWith(jobId!));

    if (!matchingFile) {
      throw new Error(`Expected to find a matching output file for jobId ${jobId} in ${exportsDir}`);
    }

    const outputFilePath = path.join(exportsDir, matchingFile);
    console.log(`Simulating TTL expiry by deleting output file: ${outputFilePath}`);
    fs.unlinkSync(outputFilePath);

    // 12. Attempt to download and verify the server returns HTTP 410 (Gone)
    const downloadUrl = `/api/exports/${jobId}/download`;
    console.log(`Testing download URL: ${downloadUrl}`);
    const downloadRes = await request.get(downloadUrl);
    
    expect(downloadRes.status()).toBe(410);
    const errorJson = await downloadRes.json();
    console.log("Expired download API response:", errorJson);
    expect(errorJson.error?.code).toBe("EXPORT_EXPIRED");
  });
});
