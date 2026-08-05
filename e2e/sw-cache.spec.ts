import { test, expect } from "@playwright/test";

test.describe("CoachClip Service Worker & PWA Cache Strategy", () => {
  test("should update service worker, clear old coachclip-v1 cache, and render React homepage on normal reload", async ({ page }) => {
    // 1. Initial page load
    await page.goto("/");

    // 2. Seed an old 'coachclip-v1' cache in browser to simulate a user with old cache
    await page.evaluate(async () => {
      const oldCache = await window.caches.open("coachclip-v1");
      await oldCache.put(
        new Request("/stale-file.html"),
        new Response("<h1>Stale HTML Shell</h1>", { headers: { "Content-Type": "text/html" } })
      );
    });

    // Verify coachclip-v1 exists
    const hasOldCache = await page.evaluate(async () => {
      return await window.caches.has("coachclip-v1");
    });
    expect(hasOldCache).toBe(true);

    // 3. Register updated service worker script with version query parameter to trigger SW install & activate events
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`);
        const activeWorker = reg.installing || reg.waiting || reg.active;
        if (activeWorker && activeWorker.state !== "activated") {
          await new Promise<void>((resolve) => {
            activeWorker.addEventListener("statechange", () => {
              if (activeWorker.state === "activated") resolve();
            });
            setTimeout(resolve, 3000);
          });
        }
      }
    });

    // Wait for SW ready
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    // 4. Reload page without Ctrl+Shift+R
    await page.reload();

    // 5. Verify React app homepage renders successfully and is NOT blank
    const mainHeading = page.locator("h2");
    await expect(mainHeading).toContainText("Find situationen.");
    await expect(mainHeading).toContainText("Forklar den. Del den.");

    const newClipButton = page.locator("button:has-text('Nyt analyseklip')").first();
    await expect(newClipButton).toBeVisible();

    // 6. Verify old cache v1 was automatically deleted by activate listener and v2 cache exists
    await expect.poll(async () => {
      return await page.evaluate(async () => {
        const v1Exists = await window.caches.has("coachclip-v1");
        const v2Exists = await window.caches.has("coachclip-v2");
        return { v1Exists, v2Exists };
      });
    }, { timeout: 10000, intervals: [200, 500, 1000] }).toEqual({ v1Exists: false, v2Exists: true });
  });
});
