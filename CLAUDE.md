# CoachClip

Taktisk videoklip-værktøj til sportstrænere. Træneren vælger en videofil, finder
situationen, tilføjer markeringer (tekst, cirkel, pil, frysebillede) og eksporterer en
færdig MP4 hvor markeringerne er brændt ind i billedet.

Full-stack: React 19 + Vite 6 + Tailwind 4 frontend, Express 5 backend, FFmpeg som
rendering-motor. Projekter gemmes i browserens IndexedDB. **Intet login, ingen
serverdatabase, ingen AI-analyse** — det er bevidste valg for pilotfasen, ikke mangler
der skal udfyldes.

## Kommandoer

```bash
npm run dev        # Vite + Express på http://localhost:3000 (samme port)
npm run verify     # HELE porten: lint → typecheck → unit → build → 9 smoke → E2E
npm test           # kun vitest
npm run smoke:export:freeze   # enkelt smoke-test, se package.json for resten
npm run build && npm run start # produktion
```

**Forudsætninger:** Node 20 eller 22 (`engines: >=20 <23`). `ffmpeg` og `ffprobe` skal
ligge i PATH — serveren bliver ikke `ready` uden dem, og både `verify:smoke` og
`verify:e2e` dør uden dem. CI og Dockerfile kører **Node 20**, så kører du en nyere Node
lokalt, betyder grøn `verify` lokalt ikke nødvendigvis grøn CI.

`npm run verify` skal være grøn før commit. Den kører rigtige FFmpeg-eksporter og
sammenligner pixels, så den tager nogle minutter — det er meningen.

## Arkitektur

```
src/          React-frontend. App.tsx er én state machine for hele flowet (editorStep).
              screens/ = flowets trin. features/annotations/ = markeringseditoren.
              components/ = navigation, eksport-UI, samlinger, brugerguide.
shared/       Fælles kontrakt mellem frontend og backend. Typer og geometri hører HER.
server/src/   Express: routes/ (validering), services/ (kø, job, FFmpeg, oprydning).
server.ts     Opsætning: CORS, rate limits, health/ready, graceful shutdown.
scripts/      Smoke-tests der kører FFmpeg og pixel-sammenligner output.
e2e/          Playwright-scenarier (eksport, annullering, udløb, CORS, sw-cache).
```

### Eksport-pipelinen

`POST /api/exports` (multipart: `video` + `metadata`) validerer grundigt, opretter et job,
svarer **202** med `jobId`, og lægger jobbet i `exportQueue`. Frontend poller
`GET /api/exports/:jobId` og viser stage på dansk. `GET /api/exports/:jobId/download`
henter filen indtil TTL udløber (så 410).

`ffmpegExportService.executeExport` bygger en **kronologisk segmentliste** af `video`- og
`freeze`-stykker, renderer hvert segment for sig (én SVG-overlay pr. aktiv annotation med
`enable='between(t,...)'`), og samler til sidst med `concat -c copy`.

Jobstatus er **in-memory** og nulstilles ved servergenstart. Det er et pilotvalg.

## Regler der skal holdes

**Dansk til brugeren.** Al brugervendt tekst er på dansk — også fejlbeskeder fra backend.
De skrives til en træner, ikke til en udvikler: "Klippet kunne ikke oprettes. Projektet og
dine markeringer er dog stadig gemt." Kode, kommentarer og commits er på engelsk.

**`shared/` er eneste kilde til typer.** Definér typer og geometri i `shared/` og importér
derfra i både `src/` og `server/`. Backend må **ikke** importere fra `src/`.
`shared/annotations.ts` er annotationstyperne, `shared/exportJob.ts` er jobstatus og
svaret fra `GET /api/exports/:jobId`, `shared/exportSchema.ts` er upload-metadata.
`src/types.ts` re-eksporterer annotationstyperne og ejer kun frontend-modeller (projekt,
samling). Bemærk: projektets gemte status hedder `"exported"`, jobbets hedder
`"completed"` — de er bevidst forskellige, og `ExportScreen` oversætter i én typet funktion.

**Koordinater er altid relative (0–1).** Aldrig pixels i datamodellen. Det er hele grunden
til at preview og eksport kan gengive samme markering i forskellige opløsninger.

**Geometri må kun findes ét sted.** `shared/annotationGeometry.ts` bruges af både
browser-preview og FFmpeg-render. Kopierer du en formel ind i den ene side, holder de op
med at stemme — og det er præcis det projektets pixel-tests findes for at fange.

**FFmpeg kaldes med `spawn` og argument-array.** Aldrig strengkonkatenering, aldrig shell.
Det er bevidst injection-sikring, fordi brugerinput (annotationstekst, filnavne) ender i
nærheden af kommandoen.

**Ændrer du rendering, kør smoke-testene og se på pixel-diffs.** Enhedstests fanger ikke
at et klip pludselig ser forkert ud.

**Ryd altid op efter jobs.** Kildevideoen slettes i `finally`, delvist output slettes ved
fejl/annullering, og `fileCleanupService` rydder efter TTL. Ny kode der skriver til
`tmp/` skal have en tilsvarende oprydning.

**CORS i produktion.** `validateConfig()` nægter at starte hvis `CORS_ORIGIN` mangler
eller er `*` når `NODE_ENV=production`. Lad den regel stå.

## Ude af scope

Login og brugerstyring, cloud-videogalleri, AI-analyse eller tracking, baggrundsmusik,
visuelle overgange. Foreslå det ikke som "forbedringer" — det er aktivt fravalgt for at
holde appen enkel.

## Kendte problemer

Rettet i prioriteret rækkefølge:

0. **Pipelinen kræver en FFmpeg bygget med librsvg.** `generateSvgOverlay` skriver hver
   annotation som en `.svg`-fil og lader FFmpeg dekode den som input til `overlay`. Det er
   en udokumenteret afhængighed af en bestemt FFmpeg-build. Ubuntus apt-ffmpeg har
   `--enable-librsvg` (derfor er CI grøn); gængse Windows-builds har det ikke.
   Robust rettelse: rasterisér SVG til PNG i Node (fx `@resvg/resvg-js`, ren Rust med
   prebuilt binaries) og giv FFmpeg en PNG. Så virker pipelinen på enhver FFmpeg-build,
   og renderingen bliver ens på alle platforme i stedet for at afhænge af hvilken
   librsvg-version maskinen har. **Afklaret:** Dockerfilens `node:20-slim` +
   `apt-get install ffmpeg` har librsvg. CI's docker-job verificerer det nu mod den
   kørende container (librsvg i build-config, svg-decoder registreret, og en rigtig
   SVG-overlay renderes). Produktion er dermed ikke i stykker; resvg-rettelsen er kun
   for at gøre lokal udvikling på Windows og font-rendering platformsuafhængig.
   Bemærk også: tekstannotationer bruger Arial/Helvetica, så rendering afhænger af hvilke
   fonte der er på maskinen — det gælder allerede i dag.

5. **PWA-ikonerne kan ikke indlæses.** `public/manifest.json` peger på Unsplash-URL'er,
   men CSP'en sætter `img-src 'self' data:`. Læg rigtige PNG'er i `public/`.
6. **Service workeren er network-only** og gør intet — men kommentaren i `main.tsx` siger
   "offline support". Appen virker ikke offline.

Løst (numrene bruges i PR'er og commits, derfor er de ikke omnummereret):
1. Filnavn var altid `CoachClip.mp4` — `ExportScreen` sender nu `projectTitle`.
2. Typerne var dubleret tre steder — samlet i `shared/`, polling-svaret er typet.
3. `ffprobe`-varighed kun fra stream — `format=duration` er fallback (iPhone-MOV).
4. Polling kunne ramme rate limit — alle grænser ligger i `config` (`RATE_LIMIT_GENERAL`
   m.fl.), limiterne deler `server/src/middleware/rateLimiter.ts`, og en test sikrer at
   standardgrænserne tillader polling af to eksporter pr. IP (`EXPORT_POLL_INTERVAL_MS`).
7. Annullering blev vist som fejl — vises nu neutralt som "Eksporten blev afbrudt".

## Død kode — ret ikke i disse filer

Ikke importeret nogen steder. Slet dem, eller brug dem bevidst, men lad dig ikke narre
til at rette i dem:

- `src/components/EditorScreen.tsx` (46 KB) — den rigtige er `features/annotations/AnnotationEditor.tsx`
- `src/components/TrimScreen.tsx` (20 KB) — de rigtige er `screens/ClipSelectScreen.tsx` + `ClipFineTuneScreen.tsx`
- `src/hooks/useAutosave.ts`, `src/hooks/usePointerDrag.ts`
- `shared/videoGeometry.ts` — `computeOutputDimensions` er i stedet kopieret inline tre
  steder i `ffmpegExportService.ts`

`exportSimpleClip` i `ffmpegExportService.ts` bruges kun af smoke-scripts, ikke af det
rigtige flow, og har sin egen skaleringslogik.

## Rester fra Google AI Studio

Projektet blev bygget i AI Studio. Følgende er scaffolding uden funktion og kan fjernes:

- `package.json`: `"name": "react-example"`, `"version": "0.0.0"`
- `metadata.json`: erklærer Gemini-capability og beder om kamera/mikrofon — intet af det bruges
- `.env.example`: `GEMINI_API_KEY` og `APP_URL` bruges ingen steder
- `vite.config.ts`: `DISABLE_HMR`-logikken og kommentaren om "agent edits"

## Windows-noter

Udvikles på Windows (E:\Projekter\CoachClip).

- Playwright spawner webServer via `cmd.exe` på Windows. Sæt derfor aldrig env-variabler
  som prefiks i `command` (`PORT=3001 npm run dev` fejler) — de hører til i `env`-blokken.
  `> e2e-server.log 2>&1` er gyldig cmd-syntaks og skal blive.
- `verify:e2e` kræver `npx playwright install chromium` (`npm ci` henter dem ikke) og at
  port 3001 er fri — `reuseExistingServer: false` afviser at starte hvis en anden
  dev-server har taget porten.
- WinGet installerer ffmpeg i `%LOCALAPPDATA%\Microsoft\WinGet\Links`, som er i Windows'
  PATH men ikke i Git Bash'. Kør E2E/smoke fra PowerShell, eller tilføj mappen til PATH.
- `npm run clean` bruger `rm -rf`.
- `getFreeDiskSpace()` kalder `df -h /` og returnerer pænt "unknown" på Windows — kosmetisk.
- **`verify:smoke` kan ikke blive grøn på Windows.** Pipelinen kræver en FFmpeg bygget
  med librsvg (se "Kendte problemer" punkt 0). Ubuntus apt-ffmpeg har
  `--enable-librsvg`; Gyan 9.0.1 full_build har det ikke, og der findes ikke et
  udbredt Windows-build der har. Jag den ikke — brug i stedet:

  | Lokalt på Windows | Kun i CI (eller Docker) |
  |---|---|
  | `verify:lint`, `verify:typecheck`, `verify:unit`, `verify:build` | smoke 3–8 (text, circle, arrow, freeze, combined, annotations) |
  | smoke 1, 2 og `smoke:api:simple` (ingen annotationer) | |
  | `verify:e2e` uden `export-flow` (`npx playwright test --grep-invert "Full E2E Export Flow"`) | `export-flow` (renderer markeringer) |

  Kører du hele `verify:e2e` lokalt, fejler `export-flow`, og det kan trække
  `cancel-export` og `sw-cache` med i den samme kørsel. Kørt alene er de grønne.

  Tjek din binær med `ffmpeg -decoders | findstr svg`. Fejler en annotations-eksport med
  `Decoding requested, but no decoder found for: svg`, er det dit FFmpeg-build og ikke koden.
  CI er porten for rendering-ændringer, indtil punkt 0 er rettet.

## Deployment

Dockerfile er multi-stage Node 20-slim, installerer ffmpeg, kører som non-root `node`,
HEALTHCHECK mod `/api/ready`. Klar til Cloud Run.

Skalerer du til mere end én instans: jobstatus og filer ligger lokalt i instansen, så en
download skal ramme samme instans — ellers skal jobstore og filer flyttes ud
(fx Redis + object storage).
