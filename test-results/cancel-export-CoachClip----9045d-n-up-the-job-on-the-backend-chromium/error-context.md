# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cancel-export.spec.ts >> CoachClip - Export Cancellation >> should successfully cancel an active export and clean up the job on the backend
- Location: e2e/cancel-export.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h4:has-text(\'Gennemse:\')')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h4:has-text(\'Gennemse:\')')

```

```yaml
- main:
  - heading "Gennemse dit klip" [level=3]
  - paragraph: Se det færdige analyseklip igennem med start, slut og markeringer.
  - text: Klar til godkendelse
  - img
  - text: Er klippet klar til at blive gemt?
  - button "Ret start/slut"
  - button "Ret markeringer"
  - button "Ja, gem klip"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("CoachClip - Export Cancellation", () => {
  4  |   test("should successfully cancel an active export and clean up the job on the backend", async ({ page, request }) => {
  5  |     // 1. Open home page and proceed to video select screen
  6  |     await page.goto("/");
  7  |     await page.locator("button:has-text('Nyt analyseklip')").first().click();
  8  | 
  9  |     // 2. Click "Prøv en demo basketball-video"
  10 |     await page.locator("button:has-text('Prøv en demo basketball-video')").click();
  11 | 
  12 |     // 3. Clip Selection (Choose / Trim) -> Click next
  13 |     await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10000 });
  14 |     await page.locator("button:has-text('Næste: Finjustering')").click();
  15 | 
  16 |     // 4. Fine-Tuning Screen -> Click next
  17 |     await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
  18 |     await page.locator("button:has-text('Klip er korrekt: Tegn')").click();
  19 | 
  20 |     // 5. Drawing Workspace -> Go next
  21 |     await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
  22 |     await page.locator("button:has-text('Næste: Gennemse klip')").click();
  23 | 
  24 |     // 6. Review -> Click save
> 25 |     await expect(page.locator("h4:has-text('Gennemse:')")).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  26 |     await page.locator("button:has-text('Ja, gem klip')").click();
  27 | 
  28 |     // 7. Save Settings -> Click export
  29 |     await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
  30 |     await page.locator("button:has-text('Gem og eksportér')").click();
  31 | 
  32 |     // 8. Privacy Warning Dialogue
  33 |     await expect(page.locator("h3:has-text('Beskyttelse af dine videoer')")).toBeVisible();
  34 | 
  35 |     // Setup listener to intercept the export job creation and cancellation
  36 |     let jobId: string | null = null;
  37 |     page.on("response", async (response) => {
  38 |       const url = response.url();
  39 |       if (url.endsWith("/api/exports") && response.request().method() === "POST") {
  40 |         try {
  41 |           const body = await response.json();
  42 |           jobId = body.jobId;
  43 |           console.log("Intercepted created jobId:", jobId);
  44 |         } catch (e) {
  45 |           // ignore
  46 |         }
  47 |       }
  48 |     });
  49 | 
  50 |     let deleteFired = false;
  51 |     page.on("request", (req) => {
  52 |       if (req.url().includes("/api/exports/") && req.method() === "DELETE") {
  53 |         deleteFired = true;
  54 |         console.log("Intercepted DELETE request to:", req.url());
  55 |       }
  56 |     });
  57 | 
  58 |     // Start real export
  59 |     await page.locator("button:has-text('Fortsæt og eksporter')").click();
  60 | 
  61 |     // Wait until progress loader starts (progress >= 0%)
  62 |     await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();
  63 | 
  64 |     // Wait 1 second to let some rendering happen, then click cancellation
  65 |     await page.waitForTimeout(1000);
  66 |     console.log("Clicking 'Afbryd eksport' button...");
  67 |     await page.locator("button:has-text('Afbryd eksport')").click();
  68 | 
  69 |     // Verify UI updates back to the failure / cancelled screen
  70 |     await expect(page.locator("h3:has-text('Eksporten fejlede')")).toBeVisible();
  71 |     await expect(page.locator("p:has-text('Eksporten blev afbrudt.')")).toBeVisible();
  72 | 
  73 |     // Confirm that the DELETE route was triggered
  74 |     expect(deleteFired).toBe(true);
  75 | 
  76 |     // Query backend API directly using playwright request context to assert job status is indeed cancelled
  77 |     if (jobId) {
  78 |       console.log(`Directly querying backend status of job: ${jobId}`);
  79 |       const statusRes = await request.get(`/api/exports/${jobId}`);
  80 |       expect(statusRes.ok()).toBe(true);
  81 |       const statusJson = await statusRes.json();
  82 |       console.log("Direct status API response:", statusJson);
  83 |       expect(statusJson.status).toBe("cancelled");
  84 |     } else {
  85 |       throw new Error("Could not intercept a valid jobId to perform backend assertion.");
  86 |     }
  87 |   });
  88 | });
  89 | 
```