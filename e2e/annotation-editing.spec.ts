import { test, expect, type Page } from "@playwright/test";
import { openEditorWithTestVideo } from "./fixtures/appFlow";

const overlay = ".absolute.inset-0.z-20.pointer-events-auto";
const PORTRAIT_VIDEO = "e2e/fixtures/media/portrait-rotated-silent.mp4";

type Point = { x: number; y: number };

async function centerOf(page: Page, selector: string): Promise<Point> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} is on screen`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test.describe("CoachClip - Annotation editing", () => {
  test("an arrow end point and a text can be dragged after they are placed", async ({ page }) => {
    await openEditorWithTestVideo(page);

    await page.locator("button:has-text('Vis bevægelse')").first().click();
    const box = await page.locator(overlay).boundingBox();
    expect(box).not.toBeNull();
    await drag(page, { x: box!.x + 150, y: box!.y + 250 }, { x: box!.x + 300, y: box!.y + 120 });

    const endBefore = await centerOf(page, "[data-testid='arrow-end-handle']");
    const endTarget = { x: endBefore.x - 80, y: endBefore.y + 100 };
    await drag(page, endBefore, endTarget);
    const endAfter = await centerOf(page, "[data-testid='arrow-end-handle']");
    expect(Math.abs(endAfter.x - endTarget.x)).toBeLessThan(6);
    expect(Math.abs(endAfter.y - endTarget.y)).toBeLessThan(6);
    await page.locator("button:has-text('Gem')").click();

    await page.locator("button:has-text('Tilføj tekst')").first().click();
    await page.locator(overlay).click({ position: { x: 300, y: 150 } });
    await page.fill("textarea", "Luk midten");

    const textBefore = await centerOf(page, "[data-testid='text-annotation']");
    await drag(page, textBefore, { x: textBefore.x + 60, y: textBefore.y + 40 });
    const textAfter = await centerOf(page, "[data-testid='text-annotation']");
    expect(Math.abs(textAfter.x - (textBefore.x + 60))).toBeLessThan(6);
    expect(Math.abs(textAfter.y - (textBefore.y + 40))).toBeLessThan(6);
  });

  test("a portrait video fills the phone screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openEditorWithTestVideo(page, PORTRAIT_VIDEO);

    const canvas = page.locator("[data-testid='annotation-canvas']").first();
    await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(812 * 0.5);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
