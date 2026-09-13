import { test, expect } from "@playwright/test";
import { countOpfsExportFiles, openEditorWithTestVideo, saveAndExport } from "./fixtures/appFlow";

test.describe("CoachClip - Export Cancellation", () => {
  test("cancelling a running export shows a neutral message and leaves no export files", async ({ page }) => {
    await openEditorWithTestVideo(page);

    // Slow the page down so the export is still running when cancel is clicked
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });

    await saveAndExport(page);
    await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();
    await page.locator("button:has-text('Afbryd eksport')").click();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    await expect(page.locator("h3:has-text('Eksporten blev afbrudt')")).toBeVisible();
    await expect(page.locator("h3:has-text('Eksporten fejlede')")).toHaveCount(0);
    await expect.poll(() => countOpfsExportFiles(page)).toBe(0);
  });
});
