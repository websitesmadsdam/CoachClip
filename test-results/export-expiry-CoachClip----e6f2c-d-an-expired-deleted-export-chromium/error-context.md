# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: export-expiry.spec.ts >> CoachClip - Export Expiry TTL >> should return HTTP 410 Gone when trying to download an expired/deleted export
- Location: e2e/export-expiry.spec.ts:6:3

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
  2  | import fs from "fs";
  3  | import path from "path";
  4  | 
  5  | test.describe("CoachClip - Export Expiry TTL", () => {
  6  |   test("should return HTTP 410 Gone when trying to download an expired/deleted export", async ({ page, request }) => {
  7  |     // 1. Navigate to home
  8  |     await page.goto("/");
  9  |     await page.locator("button:has-text('Nyt analyseklip')").first().click();
  10 | 
  11 |     // 2. Select demo video
  12 |     await page.locator("button:has-text('Prøv en demo basketball-video')").click();
  13 | 
  14 |     // 3. Wizard Trimming -> Next
  15 |     await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10000 });
  16 |     await page.locator("button:has-text('Næste: Finjustering')").click();
  17 | 
  18 |     // 4. Fine-Tune -> Next
  19 |     await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
  20 |     await page.locator("button:has-text('Klip er korrekt: Tegn')").click();
  21 | 
  22 |     // 5. Drawing Workspace -> Go next
  23 |     await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
  24 |     await page.locator("button:has-text('Næste: Gennemse klip')").click();
  25 | 
  26 |     // 6. Review -> Save
> 27 |     await expect(page.locator("h4:has-text('Gennemse:')")).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  28 |     await page.locator("button:has-text('Ja, gem klip')").click();
  29 | 
  30 |     // 7. Save Settings -> Export
  31 |     await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
  32 |     await page.locator("button:has-text('Gem og eksportér')").click();
  33 | 
  34 |     // 8. Privacy Dialogue -> Start
  35 |     await expect(page.locator("h3:has-text('Beskyttelse af dine videoer')")).toBeVisible();
  36 | 
  37 |     let jobId: string | null = null;
  38 |     page.on("response", async (response) => {
  39 |       const url = response.url();
  40 |       if (url.endsWith("/api/exports") && response.request().method() === "POST") {
  41 |         try {
  42 |           const body = await response.json();
  43 |           jobId = body.jobId;
  44 |           console.log("Intercepted created jobId:", jobId);
  45 |         } catch (e) {
  46 |           // ignore
  47 |         }
  48 |       }
  49 |     });
  50 | 
  51 |     await page.locator("button:has-text('Fortsæt og eksporter')").click();
  52 | 
  53 |     // 9. Wait for completion
  54 |     await expect(page.locator("h3:has-text('Dit klip er klar!')")).toBeVisible({ timeout: 60000 });
  55 | 
  56 |     if (!jobId) {
  57 |       throw new Error("Could not intercept a valid jobId.");
  58 |     }
  59 | 
  60 |     // 10. Verify job is completed on backend first
  61 |     console.log(`Querying job status for: ${jobId}`);
  62 |     const statusRes = await request.get(`/api/exports/${jobId}`);
  63 |     expect(statusRes.ok()).toBe(true);
  64 |     const statusData = await statusRes.json();
  65 |     expect(statusData.status).toBe("completed");
  66 | 
  67 |     // 11. Simulate Expiration/TTL by deleting the output file from the server's `./tmp/exports` folder
  68 |     const exportsDir = path.resolve("./tmp/exports");
  69 |     const files = fs.readdirSync(exportsDir);
  70 |     const matchingFile = files.find(f => f.startsWith(jobId!));
  71 | 
  72 |     if (!matchingFile) {
  73 |       throw new Error(`Expected to find a matching output file for jobId ${jobId} in ${exportsDir}`);
  74 |     }
  75 | 
  76 |     const outputFilePath = path.join(exportsDir, matchingFile);
  77 |     console.log(`Simulating TTL expiry by deleting output file: ${outputFilePath}`);
  78 |     fs.unlinkSync(outputFilePath);
  79 | 
  80 |     // 12. Attempt to download and verify the server returns HTTP 410 (Gone)
  81 |     const downloadUrl = `/api/exports/${jobId}/download`;
  82 |     console.log(`Testing download URL: ${downloadUrl}`);
  83 |     const downloadRes = await request.get(downloadUrl);
  84 |     
  85 |     expect(downloadRes.status()).toBe(410);
  86 |     const errorJson = await downloadRes.json();
  87 |     console.log("Expired download API response:", errorJson);
  88 |     expect(errorJson.error?.code).toBe("EXPORT_EXPIRED");
  89 |   });
  90 | });
  91 | 
```