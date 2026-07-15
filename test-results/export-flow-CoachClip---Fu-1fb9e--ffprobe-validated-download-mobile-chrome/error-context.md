# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: export-flow.spec.ts >> CoachClip - Full E2E Export Flow >> should complete the entire pipeline from stock video to ffprobe-validated download
- Location: e2e/export-flow.spec.ts:6:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.dragTo: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.absolute.inset-0.z-20.pointer-events-auto')
    - locator resolved to <div class="absolute inset-0 z-20 pointer-events-auto overflow-hidden select-none">…</div>
  - attempting move and down action
    - waiting for element to be visible and stable
    - element is visible and stable
    - scrolling into view if needed
    - done scrolling
    - performing move and down action
    - move and down action done
    - waiting for scheduled navigations to finish
    - navigations have finished
  - waiting for locator('.absolute.inset-0.z-20.pointer-events-auto')
    - locator resolved to <div class="absolute inset-0 z-20 pointer-events-auto overflow-hidden select-none">…</div>
  - attempting move and up action
    2 × waiting for element to be visible and stable
      - element is visible and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="flex lg:hidden items-center justify-around w-full max-w-md mt-4 bg-slate-900 border border-slate-800 p-2.5 rounded-xl gap-2 text-white shadow">…</div> intercepts pointer events
    - retrying move and up action
    - waiting 20ms
    2 × waiting for element to be visible and stable
      - element is visible and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="flex lg:hidden items-center justify-around w-full max-w-md mt-4 bg-slate-900 border border-slate-800 p-2.5 rounded-xl gap-2 text-white shadow">…</div> intercepts pointer events
    - retrying move and up action
      - waiting 100ms
    54 × waiting for element to be visible and stable
       - element is visible and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="flex lg:hidden items-center justify-around w-full max-w-md mt-4 bg-slate-900 border border-slate-800 p-2.5 rounded-xl gap-2 text-white shadow">…</div> intercepts pointer events
     - retrying move and up action
       - waiting 500ms

```

# Page snapshot

```yaml
- main [ref=e4]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - button "Gå tilbage" [ref=e9] [cursor=pointer]:
          - img [ref=e10]
        - generic [ref=e12]:
          - heading "Forklar situationen" [level=1] [ref=e13]
          - paragraph [ref=e14]: Tilføj fokuspunkter, pile, cirkler eller frysepunkter for at forklare din taktik.
      - 'button "Næste: Gennemse klip" [ref=e15] [cursor=pointer]':
        - img [ref=e16]
        - generic [ref=e18]: "Næste: Gennemse klip"
    - generic [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e22]:
          - generic [ref=e23]: "E2E Test: Gå dybt!"
          - generic:
            - img
        - generic [ref=e33]:
          - button "Tekst" [ref=e34] [cursor=pointer]:
            - img [ref=e35]
            - generic [ref=e37]: Tekst
          - button "Cirkel" [ref=e38] [cursor=pointer]:
            - img [ref=e39]
            - generic [ref=e41]: Cirkel
          - button "Pil" [active] [ref=e42] [cursor=pointer]:
            - img [ref=e43]
            - generic [ref=e46]: Pil
          - button "Frys" [ref=e47] [cursor=pointer]:
            - img [ref=e48]
            - generic [ref=e61]: Frys
        - generic [ref=e62]:
          - generic [ref=e63]:
            - button "2 sekunder tilbage" [ref=e64] [cursor=pointer]:
              - img [ref=e65]
            - button [ref=e68] [cursor=pointer]:
              - img [ref=e69]
            - button "2 sekunder frem" [ref=e71] [cursor=pointer]:
              - img [ref=e72]
          - generic [ref=e74]:
            - generic [ref=e75]: "Fart:"
            - button "0.5x" [ref=e76] [cursor=pointer]
            - button "1x" [ref=e77] [cursor=pointer]
            - button "2x" [ref=e78] [cursor=pointer]
          - generic [ref=e81]: 00:00.0
      - generic [ref=e84]:
        - generic [ref=e86]: Vis bevægelse (Pil)
        - generic [ref=e87]:
          - generic [ref=e88]: Farve
          - generic [ref=e89]:
            - button "Gul" [ref=e90]:
              - generic [ref=e92]: Gul
            - button "Rød" [ref=e93]:
              - generic [ref=e95]: Rød
            - button "Hvid" [ref=e96]:
              - generic [ref=e98]: Hvid
        - generic [ref=e99]:
          - generic [ref=e100]: Varighed
          - generic [ref=e101]:
            - button "2s" [ref=e102]
            - button "3s" [ref=e103]
            - button "5s" [ref=e104]
        - generic [ref=e105]:
          - button "Annuller" [ref=e106] [cursor=pointer]:
            - img [ref=e107]
            - text: Annuller
          - button "Gem" [ref=e110] [cursor=pointer]:
            - img [ref=e111]
            - text: Gem
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { execSync } from "child_process";
  3   | import fs from "fs";
  4   | 
  5   | test.describe("CoachClip - Full E2E Export Flow", () => {
  6   |   test("should complete the entire pipeline from stock video to ffprobe-validated download", async ({ page }) => {
  7   |     // 1. Open home page
  8   |     await page.goto("/");
  9   |     await expect(page.locator("h2").first()).toContainText("Find situationen.");
  10  | 
  11  |     // 2. Start a new clip analysis
  12  |     await page.locator("button:has-text('Nyt analyseklip')").first().click();
  13  |     await expect(page.locator("h3:has-text('Vælg kamp- eller træningsvideo')")).toBeVisible();
  14  | 
  15  |     // 3. Select stock/demo basketball video
  16  |     await page.locator("button:has-text('Prøv en demo basketball-video')").click();
  17  |     
  18  |     // 4. Clip Selection Screen (trim bounds)
  19  |     await expect(page.locator("h2:has-text('Find situationen')")).toBeVisible({ timeout: 10000 });
  20  |     await page.locator("button:has-text('Næste: Finjustering')").click();
  21  | 
  22  |     // 5. Fine-Tuning Screen
  23  |     await expect(page.locator("h2:has-text('Finjuster dit klip')")).toBeVisible();
  24  |     await page.locator("button:has-text('Klip er korrekt: Tegn')").click();
  25  | 
  26  |     // 6. Annotation / Drawing Workspace
  27  |     await expect(page.locator("h1:has-text('Forklar situationen')")).toBeVisible();
  28  | 
  29  |     // --- ADD TEXT ANNOTATION ---
  30  |     console.log("Placing Text Annotation...");
  31  |     await page.locator("button:has-text('Tekst')").first().click();
  32  |     await page.locator(".absolute.inset-0.z-20.pointer-events-auto").click({ position: { x: 300, y: 150 } });
  33  |     await page.fill("textarea", "E2E Test: Gå dybt!");
  34  |     await page.locator("button:has-text('Gem')").click();
  35  | 
  36  |     // --- ADD CIRCLE ANNOTATION ---
  37  |     console.log("Placing Circle Annotation...");
  38  |     await page.locator("button:has-text('Cirkel')").first().click();
  39  |     await page.locator(".absolute.inset-0.z-20.pointer-events-auto").click({ position: { x: 200, y: 200 } });
  40  |     await page.locator("button:has-text('Gem')").click();
  41  | 
  42  |     // --- ADD ARROW ANNOTATION ---
  43  |     console.log("Placing Arrow Annotation...");
  44  |     await page.locator("button:has-text('Pil')").first().click();
  45  |     // Simulate drawing by doing drag-and-drop on the interactive workspace overlay
> 46  |     await page.locator(".absolute.inset-0.z-20.pointer-events-auto").dragTo(
      |                                                                      ^ Error: locator.dragTo: Test timeout of 30000ms exceeded.
  47  |       page.locator(".absolute.inset-0.z-20.pointer-events-auto"),
  48  |       {
  49  |         sourcePosition: { x: 100, y: 100 },
  50  |         targetPosition: { x: 250, y: 250 }
  51  |       }
  52  |     );
  53  |     await page.locator("button:has-text('Gem')").click();
  54  | 
  55  |     // --- ADD FREEZE FRAME ---
  56  |     console.log("Placing Freeze Frame...");
  57  |     await page.locator("button:has-text('Frys')").first().click();
  58  |     await page.locator("button:has-text('Gem')").click();
  59  | 
  60  |     // Move to next step (Review)
  61  |     await page.locator("button:has-text('Næste: Gennemse klip')").click();
  62  | 
  63  |     // 7. Review Screen
  64  |     await expect(page.locator("h4:has-text('Gennemse:')")).toBeVisible();
  65  |     await page.locator("button:has-text('Ja, gem klip')").click();
  66  | 
  67  |     // 8. Save Screen
  68  |     await expect(page.locator("h3:has-text('Gem dit klip')")).toBeVisible();
  69  |     await page.locator("button:has-text('Gem og eksportér')").click();
  70  | 
  71  |     // 9. Privacy Warning Dialogue
  72  |     await expect(page.locator("h3:has-text('Beskyttelse af dine videoer')")).toBeVisible();
  73  |     await page.locator("button:has-text('Fortsæt og eksporter')").click();
  74  | 
  75  |     // 10. Export Screen (polling loop)
  76  |     await expect(page.locator("h3:has-text('Opretter dit taktikklip')")).toBeVisible();
  77  |     
  78  |     // Wait for compilation to complete (should render under 60s)
  79  |     await expect(page.locator("h3:has-text('Dit klip er klar!')")).toBeVisible({ timeout: 60000 });
  80  | 
  81  |     // 11. Download & Validate the MP4
  82  |     const [download] = await Promise.all([
  83  |       page.waitForEvent("download"),
  84  |       page.locator("a:has-text('Download MP4')").click()
  85  |     ]);
  86  | 
  87  |     const downloadPath = await download.path();
  88  |     console.log("Downloaded E2E video saved to Playwright temp path:", downloadPath);
  89  | 
  90  |     expect(fs.existsSync(downloadPath)).toBe(true);
  91  |     const stats = fs.statSync(downloadPath);
  92  |     console.log("Downloaded file size:", stats.size);
  93  |     expect(stats.size).toBeGreaterThan(0);
  94  | 
  95  |     // Run ffprobe to validate video parameters (ensure duration > 0 and codec is h264)
  96  |     console.log("Probing downloaded E2E output video with ffprobe...");
  97  |     const probeStr = execSync(
  98  |       `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of json "${downloadPath}"`
  99  |     ).toString();
  100 |     const probeData = JSON.parse(probeStr);
  101 |     const stream = probeData.streams?.[0];
  102 | 
  103 |     expect(stream).toBeDefined();
  104 |     expect(stream.codec_name).toBe("h264");
  105 |     console.log("E2E Probed Video Stream properties:", stream);
  106 |   });
  107 | });
  108 | 
```