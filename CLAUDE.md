# CoachClip

Taktisk videoklip-værktøj til sportstrænere. Træneren vælger en videofil, finder
situationen, tilføjer markeringer (tekst, cirkel, pil, frysebillede) og eksporterer en
færdig MP4 hvor markeringerne er brændt ind i billedet.

Statisk web-app: React 19 + Vite 6 + Tailwind 4. **Hele eksporten sker i trænerens
browser** med Mediabunny (WebCodecs). Der er ingen server. Projekter gemmes i browserens
IndexedDB; videoer gemmes aldrig. **Intet login, ingen serverdatabase, ingen AI-analyse**
— det er bevidste valg, ikke mangler der skal udfyldes.

## Kommandoer

```bash
npm run dev          # Vite på http://localhost:5173
npm run verify       # HELE porten: lint → typecheck → unit → build → engine → E2E
npm test             # kun vitest
npm run test:engine  # eksportmotoren i Chrome mod testvideoer (e2e/engine)
npm run test:e2e     # hele appen bygget, i Chrome, under produktions-CSP
```

**Forudsætninger:** Node 20 eller 22 (`engines: >=20 <23`). **Google Chrome** skal være
installeret: både engine- og E2E-tests kører Playwright med `channel: "chrome"`, fordi
Playwrights egen Chromium ikke kan H.264-encode. CI kører Node 20. FFmpeg bruges kun til at
genskabe testvideoerne (`npx tsx scripts/generateExportFixtures.ts`), ikke af appen.

`npm run verify` skal være grøn før commit.

## Arkitektur

```
src/export/        Eksportmotoren (ingen React): exportClip, planSegments, renderAnnotations,
                   decodeClipAudio, exportStorage (OPFS), capabilities, deliverClip, exportErrors
src/               React-app. App.tsx er én state machine for flowet (editorStep).
                   screens/ = flowets trin. features/annotations/ = editor + AnnotationCanvas.
shared/            Typer, geometri, validering, filnavn. Bruges af app og motor.
e2e/engine/        Motoren i Chrome via harness (e2e/harness, kun dev) mod e2e/fixtures/media
e2e/               App-scenarier (eksport, annullering, sletning) på den byggede app
vercel.json        Build + sikkerheds-headers (CSP). vite preview bruger de samme headers.
```

### Eksport-pipelinen

`ExportScreen` kalder `exportClip({ file, project, signal, onProgress })`. Motoren validerer
(`shared/exportValidation.ts`), planlægger en tidslinje af video- og frysstykker
(`planSegments`), afkoder lyden først (WebCodecs, ellers Web Audio), tegner hvert billede i
konstant 30 fps på et canvas med `renderAnnotations`, koder H.264/AAC og skriver MP4 til
OPFS. Fejl er altid `ExportError` med dansk besked. Succesiden deler filen med
`deliverClip` (delemenu eller download).

## Regler der skal holdes

**Dansk til brugeren.** Al brugervendt tekst er på dansk, skrevet til en træner. Kode,
kommentarer og commits er på engelsk.

**Én tegnemotor.** `renderAnnotations` bruges af både eksport og al forhåndsvisning
(`AnnotationCanvas`). DOM-elementerne i editoren er kun usynlige træk-håndtag. Tegn aldrig
en markering med egen SVG/CSS — så holder preview og klip op med at ligne hinanden.

**Geometri og typer i `shared/`.** Formler hører i `shared/annotationGeometry.ts`, typer i
`shared/annotations.ts`. `src/types.ts` ejer kun app-modeller (projekt, samling).

**Koordinater er altid relative (0–1), tider er kildesekunder.** Aldrig pixels i datamodellen.

**Ryd op i OPFS.** Eksportfiler (`coachclip-export-*`) slettes ved app-start, når en ny
eksport starter, når man forlader succesiden, og ved afbrudt/fejlet eksport.

**Mediabunny er fastlåst til 1.56.2.** Opdatér kun bevidst og kør `npm run test:engine`.

**Ingen inline- eller eksterne scripts.** CSP'en i `vercel.json` tillader dem ikke.

**Understøttet:** iPhone/iPad med iOS 26+ og Chrome/Edge/Safari på computer. Motoren
sniffer ikke brugeragent; mangler browseren WebCodecs, vises `UNSUPPORTED_BROWSER`.

## Ude af scope

Login og brugerstyring, cloud-videogalleri, AI-analyse eller tracking, baggrundsmusik,
visuelle overgange, offline-brug. Foreslå det ikke som "forbedringer".

## Åbne punkter

- **iPhone-tjekliste før udrulning:** 4K lodret eksport (hastighed), HEVC-video, skærm slukket
  midt i eksport, Gem i Fotos via delemenuen.
- **Skærm slukket kan få eksporten til at hænge** i stedet for at fejle med `INTERRUPTED`
  (iOS kan pause encoderen). En watchdog er ikke lavet.
- **Lydkodning der fejler** (usædvanlig samplerate) giver `UNKNOWN` i stedet for et klip uden lyd.
- **Afbryd mærkes mellem trin**, ikke midt i lydafkodning eller når filen afsluttes.
- **Afkodningsfejl midt i videoen** (fx HEVC) giver `UNKNOWN`, ikke `UNREADABLE_VIDEO`.
- **iOS 17–18** kan virke, men er ikke understøttet eller testet.
- **PWA-ikonerne** i `public/manifest.json` peger på Unsplash og blokeres af CSP'en.

## Windows-noter

Udvikles på Windows (E:\Projekter\CoachClip).

- Playwright spawner webServer via `cmd.exe`: sæt aldrig env-variabler som prefiks i `command`.
- E2E bruger port 3001 og engine-tests port 3002; de skal være frie.
- WinGet installerer ffmpeg i `%LOCALAPPDATA%\Microsoft\WinGet\Links`, som ikke er i Git
  Bash' PATH. Kun relevant for `scripts/generateExportFixtures.ts`.

## Deployment

Vercel-projektet `coachclip` er forbundet til GitHub-repoet. Production branch skal være
`main`, og domænet `coachclip.coachapp.dk` peges til Vercel med en CNAME hos Simply.com.
Previews kræver Vercel-login; production er offentlig.
