import { test, expect } from "@playwright/test";
import fs from "fs";
import { ALL_FORMATS, FilePathSource, Input } from "mediabunny";
import { countOpfsExportFiles, openEditorWithTestVideo, saveAndExport } from "./fixtures/appFlow";
import { TEST_VIDEO } from "./fixtures/testVideo";

const overlay = ".absolute.inset-0.z-20.pointer-events-auto";

test.describe("CoachClip - Full E2E Export Flow", () => {
  test("draws annotations, exports in the browser and downloads a valid MP4", async ({ page }) => {
    await openEditorWithTestVideo(page);

    const video = page.locator("video");
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).videoWidth))
      .toBe(TEST_VIDEO.width);

    await page.locator("button:has-text('Tilføj tekst')").first().click();
    await page.locator(overlay).click({ position: { x: 300, y: 150 } });
    await page.fill("textarea", "E2E Test: Gå dybt!");
    await page.locator("button:has-text('Gem')").click();

    await page.locator("button:has-text('Marker spiller')").first().click();
    await page.locator(overlay).click({ position: { x: 200, y: 200 } });
    await page.locator("button:has-text('Gem')").click();

    // The editor preview is drawn by the export's canvas renderer
    await expect
      .poll(() =>
        page.locator("[data-testid='annotation-canvas']").first().evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const ctx = canvas.getContext("2d");
          if (!ctx) return 0;
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let drawn = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
          return drawn;
        })
      )
      .toBeGreaterThan(500);

    await page.locator("button:has-text('Vis bevægelse')").first().click();
    const box = await page.locator(overlay).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 250, box!.y + 250);
    await page.mouse.up();
    await page.locator("button:has-text('Gem')").click();

    await page.locator("button:has-text('Frys billede')").first().click();
    await page.locator("button:has-text('Gem')").click();

    await saveAndExport(page);
    await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();
    await expect(page.locator("h3:has-text('Dit klip er klar!')")).toBeVisible({ timeout: 90_000 });

    // The success screen shows the planned length (clip + 3 s freeze); the file must match it
    const durationText = await page.getByText(/^\d+,\d sekunder$/).textContent();
    const shownDuration = parseFloat((durationText ?? "").replace(",", "."));
    expect(shownDuration).toBeGreaterThan(3);
    await expect(page.getByText(`MP4 / ${TEST_VIDEO.width}×${TEST_VIDEO.height}`)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("button:has-text('Download MP4')").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.mp4$/);
    const downloadPath = await download.path();
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);

    const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(downloadPath) });
    try {
      const track = await input.getPrimaryVideoTrack();
      expect(await track?.getCodec()).toBe("avc");
      expect(await track?.getDisplayWidth()).toBe(TEST_VIDEO.width);
      expect(Math.abs((await input.computeDuration()) - shownDuration)).toBeLessThan(0.15);
    } finally {
      input.dispose();
    }

    await page.locator("button:has-text('Gå til Mine projekter')").click();
    await expect.poll(() => countOpfsExportFiles(page)).toBe(0);
  });
});
