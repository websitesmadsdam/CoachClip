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
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text(\'Tekst\')').first()
    - locator resolved to <button class="flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] text-slate-400 hover:text-white hover:bg-slate-800">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    55 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
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
      - generic [ref=e23]:
        - generic [ref=e24]:
          - button "2 sekunder tilbage" [ref=e25] [cursor=pointer]:
            - img [ref=e26]
          - button [ref=e29] [cursor=pointer]:
            - img [ref=e30]
          - button "2 sekunder frem" [ref=e32] [cursor=pointer]:
            - img [ref=e33]
        - generic [ref=e35]:
          - generic [ref=e36]: "Fart:"
          - button "0.5x" [ref=e37] [cursor=pointer]
          - button "1x" [ref=e38] [cursor=pointer]
          - button "2x" [ref=e39] [cursor=pointer]
        - generic [ref=e42]: 00:00.0
      - generic [ref=e44]:
        - generic [ref=e46]:
          - generic [ref=e47]:
            - heading "Vælg tegneværktøj" [level=3] [ref=e48]
            - paragraph [ref=e49]: Vælg et værktøj og klik derefter direkte på videoen for at placere det.
          - generic [ref=e50]:
            - button "Tilføj tekst Indtast en forklaring på banen" [ref=e51] [cursor=pointer]:
              - img [ref=e52]
              - generic [ref=e54]:
                - paragraph [ref=e55]: Tilføj tekst
                - paragraph [ref=e56]: Indtast en forklaring på banen
            - button "Marker spiller Placer en gul cirkel på videoen" [ref=e57] [cursor=pointer]:
              - img [ref=e58]
              - generic [ref=e60]:
                - paragraph [ref=e61]: Marker spiller
                - paragraph [ref=e62]: Placer en gul cirkel på videoen
            - button "Vis bevægelse Tegn en gul pil på banen" [ref=e63] [cursor=pointer]:
              - img [ref=e64]
              - generic [ref=e67]:
                - paragraph [ref=e68]: Vis bevægelse
                - paragraph [ref=e69]: Tegn en gul pil på banen
            - button "Frys billede Sæt videoen på pause i et øjeblik" [ref=e70] [cursor=pointer]:
              - img [ref=e71]
              - generic [ref=e84]:
                - paragraph [ref=e85]: Frys billede
                - paragraph [ref=e86]: Sæt videoen på pause i et øjeblik
        - generic [ref=e88]:
          - generic [ref=e89]:
            - heading "Markeringsoverblik (0)" [level=3] [ref=e90]
            - paragraph [ref=e91]: Her ses alle dine tilføjede fokuspunkter på videoen. Klik på et punkt for at springe dertil.
          - generic [ref=e92]:
            - img [ref=e93]
            - paragraph [ref=e96]: Ingen markeringer endnu.
            - paragraph [ref=e97]: Brug værktøjerne til at forklare din taktik.
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
> 31  |     await page.locator("button:has-text('Tekst')").first().click();
      |                                                            ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  46  |     await page.locator(".absolute.inset-0.z-20.pointer-events-auto").dragTo(
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