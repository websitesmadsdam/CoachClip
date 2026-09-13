/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, type Page } from "@playwright/test";
import { TEST_VIDEO } from "./testVideo";

export async function openEditorWithTestVideo(page: Page, videoPath: string = TEST_VIDEO.path): Promise<void> {
  await page.goto("/");
  // The sidebar button is hidden on phones; use whichever one is on screen
  await page.locator("button:has-text('Nyt analyseklip'):visible").first().click();
  await expect(page.locator("h3:has-text('Vælg kamp- eller træningsvideo')")).toBeVisible();
  await page.setInputFiles("input[type='file']", videoPath);
  await page.locator("button:has-text('Fortsæt til klip-trimning')").click();
  await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10_000 });
  await page.locator("button:has-text('Næste: Finjustering')").click();
  await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
  await page.locator("button:has-text('Klip er korrekt: Tegn')").click();
  await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
}

export async function saveAndExport(page: Page): Promise<void> {
  await page.locator("button:has-text('Næste: Gennemse klip')").click();
  await expect(page.locator("h3:has-text('Gennemse dit klip')")).toBeVisible();
  await page.locator("button:has-text('Ja, gem klip')").click();
  await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
  await page.locator("button:has-text('Gem og eksportér')").click();
}

export async function countOpfsExportFiles(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const root = (await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> };
    let count = 0;
    for await (const name of root.keys()) {
      if (name.startsWith("coachclip-export-")) count++;
    }
    return count;
  });
}
