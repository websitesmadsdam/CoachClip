import { test, expect } from "@playwright/test";

test.describe("CoachClip - Project Deletion & Demo Seeding Regression", () => {
  test("deleting all projects leaves DB empty and does not recreate mock projects on reload", async ({ page }) => {
    // 1. Navigate to home
    await page.goto("/");

    // 2. Seed 2 test projects directly in IndexedDB
    await page.evaluate(async () => {
      const openReq = indexedDB.open("CoachClipDB", 1);
      await new Promise<void>((resolve, reject) => {
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction("projects", "readwrite");
          const store = tx.objectStore("projects");
          store.put({
            id: "test_proj_1",
            title: "Test Projekt 1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sourceVideo: { fileName: "v1.mp4", duration: 10, size: 1000 },
            clip: { startTime: 0, endTime: 5 },
            annotations: [],
            exportStatus: "not_exported"
          });
          store.put({
            id: "test_proj_2",
            title: "Test Projekt 2",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sourceVideo: { fileName: "v2.mp4", duration: 10, size: 1000 },
            clip: { startTime: 0, endTime: 5 },
            annotations: [],
            exportStatus: "not_exported"
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        openReq.onerror = () => reject(openReq.error);
      });
    });

    // Reload page so app loads the 2 projects
    await page.reload();

    // Navigate to Mine projekter tab
    await page.locator("button:has-text('Mine projekter')").first().click();

    // Verify 2 project cards exist
    await expect(page.locator("h4:has-text('Test Projekt 1')")).toBeVisible();
    await expect(page.locator("h4:has-text('Test Projekt 2')")).toBeVisible();

    // Auto-accept confirm dialogs
    page.on("dialog", (dialog) => dialog.accept());

    // Slet det første projekt
    const deleteBtn1 = page.locator("button[title='Slet']").first();
    await deleteBtn1.click();

    // Slet det andet projekt
    const deleteBtn2 = page.locator("button[title='Slet']").first();
    await deleteBtn2.click();

    // Verify 0 projects in UI
    await expect(page.locator("h4:has-text('Test Projekt 1')")).not.toBeVisible();
    await expect(page.locator("h4:has-text('Test Projekt 2')")).not.toBeVisible();

    // Genindlæs siden normalt
    await page.reload();

    // Verify 0 projects remain in DB and mock_1 and mock_2 were not created
    const projectCount = await page.evaluate(async () => {
      const openReq = indexedDB.open("CoachClipDB", 1);
      return new Promise<number>((resolve) => {
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction("projects", "readonly");
          const store = tx.objectStore("projects");
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
        };
      });
    });

    expect(projectCount).toBe(0);

    // Verify mock_1 and mock_2 are not in DB
    const hasMocks = await page.evaluate(async () => {
      const openReq = indexedDB.open("CoachClipDB", 1);
      return new Promise<boolean>((resolve) => {
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction("projects", "readonly");
          const store = tx.objectStore("projects");
          const req1 = store.get("mock_1");
          req1.onsuccess = () => {
            if (req1.result) resolve(true);
            const req2 = store.get("mock_2");
            req2.onsuccess = () => resolve(!!req2.result);
          };
        };
      });
    });

    expect(hasMocks).toBe(false);
  });
});
