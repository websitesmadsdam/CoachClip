import { test, expect } from "@playwright/test";

test.describe("CoachClip App - E2E Tests", () => {
  test("should successfully load the homepage with Danish content", async ({ page }) => {
    // Navigate to base URL (Vite + Express on 3000)
    await page.goto("/");

    // 1. Verify primary branding / title
    const mainHeading = page.locator("h2");
    await expect(mainHeading).toContainText("Find situationen.");
    await expect(mainHeading).toContainText("Forklar den. Del den.");

    // 2. Verify "Nyt analyseklip" action button is present and visible
    const newClipButton = page.locator("button:has-text('Nyt analyseklip')").first();
    await expect(newClipButton).toBeVisible();

    // 3. Verify tactical guide steps are rendered on screen
    const guideSection = page.locator("h3:has-text('Sådan fungerer det')");
    await expect(guideSection).toBeVisible();

    const steps = ["Vælg din video", "Isoler det vigtige", "Forklar med tegninger"];
    for (const step of steps) {
      await expect(page.locator(`h4:has-text('${step}')`)).toBeVisible();
    }

    // 4. Verify Danish intro paragraph is present and informative
    const introText = page.locator("p:has-text('Det behøver ikke være svært')");
    await expect(introText).toBeVisible();
  });

  test("should open the video select stage on clicking 'Nyt analyseklip'", async ({ page }) => {
    await page.goto("/");

    const newClipButton = page.locator("button:has-text('Nyt analyseklip')").first();
    await newClipButton.click();

    // Verify we transitioned to the upload/video select screen
    const uploadHeadline = page.locator("h3:has-text('Vælg kamp- eller træningsvideo')");
    await expect(uploadHeadline).toBeVisible();
  });
});
