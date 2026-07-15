import { test, expect } from "@playwright/test";

test.describe("CoachClip - Export Cancellation", () => {
  test("should successfully cancel an active export and clean up the job on the backend", async ({ page, request }) => {
    // 1. Open home page and proceed to video select screen
    await page.goto("/");
    await page.locator("button:has-text('Nyt analyseklip')").first().click();

    // 2. Click "Prøv en demo basketball-video"
    await page.locator("button:has-text('Prøv en demo basketball-video')").click();

    // 3. Clip Selection (Choose / Trim) -> Click next
    await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10000 });
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
    await expect(page.locator("h3:has-text('Beskyttelse af dine videoer')")).toBeVisible();

    // Setup listener to intercept the export job creation and cancellation
    let jobId: string | null = null;
    page.on("response", async (response) => {
      const url = response.url();
      if (url.endsWith("/api/exports") && response.request().method() === "POST") {
        try {
          const body = await response.json();
          jobId = body.jobId;
          console.log("Intercepted created jobId:", jobId);
        } catch (e) {
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
    await page.locator("button:has-text('Fortsæt og eksporter')").click();

    // Wait until progress loader starts (progress >= 0%)
    await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();

    // Wait 1 second to let some rendering happen, then click cancellation
    await page.waitForTimeout(1000);
    console.log("Clicking 'Afbryd eksport' button...");
    await page.locator("button:has-text('Afbryd eksport')").click();

    // Verify UI updates back to the failure / cancelled screen
    await expect(page.locator("h3:has-text('Eksporten fejlede')")).toBeVisible();
    await expect(page.locator("p:has-text('Eksporten blev afbrudt.')")).toBeVisible();

    // Confirm that the DELETE route was triggered
    expect(deleteFired).toBe(true);

    // Query backend API directly using playwright request context to assert job status is indeed cancelled
    if (jobId) {
      console.log(`Directly querying backend status of job: ${jobId}`);
      const statusRes = await request.get(`/api/exports/${jobId}`);
      expect(statusRes.ok()).toBe(true);
      const statusJson = await statusRes.json();
      console.log("Direct status API response:", statusJson);
      expect(statusJson.status).toBe("cancelled");
    } else {
      throw new Error("Could not intercept a valid jobId to perform backend assertion.");
    }
  });
});
