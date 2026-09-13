# Eksport i browseren – design

**Dato:** 2026-09-13
**Status:** Godkendt i dialog, afventer gennemlæsning
**Ejer:** Mads Dam (hobbyprojekt, ikke-kommercielt)

## 1. Baggrund og mål

CoachClip eksporterer i dag MP4 på en Express-server med FFmpeg: hele kildevideoen uploades,
et job køres i en kø, og træneren downloader resultatet. Det kræver en server, en
FFmpeg-build med librsvg og hosting, der kan tage store uploads og lange jobs.

**Mål:** Hele eksporten sker i trænerens browser. Appen hostes som et statisk site på Vercel
under `coachclip.coachapp.dk`. Der er ingen backend. Videoen forlader aldrig enheden.

**Ikke-mål (denne omgang):**
- Offline-brug (service worker med cache)
- At gemme det færdige klip i appen (man eksporterer igen for at dele igen)
- Understøttelse af iOS under 26 og Firefox på Android
- Login, cloud-galleri, AI, musik, overgange (uændret ude af scope, se CLAUDE.md)

## 2. Beslutninger

| Emne | Beslutning |
|---|---|
| Hvor eksporten kører | I trænerens browser |
| Hosting | Vercel (Hobby), statisk site, domæne `coachclip.coachapp.dk` |
| Enheder | iPhone/iPad med iOS 26+, samt Chrome/Edge/Safari på computer. Andre får en dansk besked |
| Levering | Del/Gem via delemenuen på telefon, download på computer. Klippet gemmes ikke i appen |
| Kvalitet | H.264, maks. 30 fps. Længste side maks. 1920, korteste maks. 1080 |
| Lodret video | Bevares lodret (fx 1080x1920) |
| Teknik | WebCodecs via Mediabunny 1.56.2 (fastlåst version) |
| Rækkefølge | Test på iPhone først (gennemført), derefter fuldt skift og sletning af serveren |

## 3. Resultater fra testen på iPhone

Testside på branch `spike/browser-export` (smides væk). iPhone, iOS 26.6.2, Chrome for iOS (WebKit).

| Kilde | Resultat |
|---|---|
| 960x720 H.264, 30 fps, mono AAC | 60 s klip + 2 s frys på 10,5 s (180 billeder/s) |
| 4K lodret 2160x3840 H.264 (rot 90), 30 fps, stereo AAC, 216 MB | 60 s klip + 2 s frys på 97,7 s (19 billeder/s), 58,7 MB |
| Første testvideo (ukendt format) | WebCodecs-lydafkodning fejlede: `InternalAudioDecoderCocoa decoding failed` |

- Output skrevet til OPFS via `StreamTarget`. Del/Gem via `navigator.share({ files })` virkede, både
  fra OPFS-fil og kopi i hukommelsen. Begge klip lå i Fotos. Klippet så rigtigt ud: lodret,
  markeringer, frys midt i, lyd.
- Lokal test (Chromium) bekræftede: frysbilleder er pixel-identiske, tone før/efter frys og
  stilhed under, begge lydveje (WebCodecs og Web Audio-fallback) giver korrekt lyd.
- **Ikke testet:** HEVC-kilde, skærmlås midt i eksport.

## 4. Arkitektur

```
src/export/                    Eksport-motoren (ny, ingen React)
  exportClip.ts                  orkestrering: læs → lyd → billeder → kod → fil
  planSegments.ts                klip + frys → tidslinje (ren logik)
  renderAnnotations.ts           tegner markeringer på canvas via shared/annotationGeometry
  decodeClipAudio.ts             WebCodecs, fallback Web Audio
  exportStorage.ts               OPFS-fil, fallback hukommelse, oprydning
  capabilities.ts                feature-detection
  deliverClip.ts                 Del/Gem eller download
  exportErrors.ts                ExportError + danske beskeder
shared/
  annotations.ts                 annotationstyper (som i dag)
  annotationGeometry.ts          geometri (udvides, se 5.5)
  videoGeometry.ts               computeOutputDimensions (tages i brug, ny regel)
  exportValidation.ts            valideringsregler (flyttet fra serverens route)
  exportSchema.ts                sanitizeExportFileName (som i dag)
src/features/annotations/
  AnnotationCanvas.tsx           ny: preview tegner med renderAnnotations
```

**Slettes:** `server/`, `server.ts`, `Dockerfile`, `.dockerignore`, FFmpeg-smoketests i
`scripts/`, E2E `api-contract`, `cors`, `export-expiry`, `sw-cache`, `public/sw.js` og
registreringen i `src/main.tsx`, `shared/exportJob.ts` (fra #4, jobstatus findes ikke længere),
død kode og AI Studio-rester (se CLAUDE.md).

## 5. Eksport-motoren

### 5.1 Interface

```ts
exportClip(options: {
  file: File;
  project: CoachClipProject;
  signal: AbortSignal;
  onProgress: (p: { stage: ExportStage; fraction: number }) => void;
}): Promise<ExportedClip>

type ExportStage = "preparing" | "decoding_audio" | "rendering" | "finalizing";
type ExportedClip = {
  file: File; fileName: string; durationSec: number; sizeBytes: number;
  width: number; height: number; hasAudio: boolean; audioWarning?: "AUDIO_UNREADABLE";
};
```

Danske stage-tekster: "Forbereder video…", "Afkoder lyd…", "Tegner klip… N %", "Gør filen klar…".
Vægtning af `fraction`: lyd 0–5 %, billeder 5–95 %, afslutning 95–100 %.

### 5.2 Validering (`shared/exportValidation.ts`)

Flyttet fra `server/src/routes/exportRoutes.ts`, med samme grænser:
- Klip: `startTime ≥ 0`, varighed 0,5–90 s, `endTime ≤ kildevarighed + 0,5`
- Højst 100 markeringer, højst 50 tekst, højst 50 cirkler+pile
- Tekst højst 120 tegn. Koordinater i 0–1. Radius i (0, 1]
- Frys: varighed 2, 3 eller 5 s, inden for klippet, mindst 0,05 s mellem to frys, samlet højst 30 s

Filendelse-tjekket (.mp4/.mov) erstattes af: Mediabunny kan læse containeren, og videosporet
kan afkodes.

### 5.3 Tidslinje (`planSegments`)

Alle tider i datamodellen er absolutte kildesekunder.
1. Frys inden for `[start, end]` sorteres efter tid.
2. For hvert frys: tilføj `video[currentPos, f.time]` hvis længere end 0,05 s, tilføj `freeze(f.time, f.duration)`,
   sæt `currentPos = f.time`. **Et frys indsætter tid, det bruger ikke kildetid.**
3. Tilføj `video[currentPos, end]` hvis længere end 0,05 s.
4. Tom liste er en fejl.

Ændring fra serveren: serveren droppede frys under 0,1 s fra det forrige, mens routen tillod 0,05 s.
Nu gælder 0,05 s begge steder.

### 5.4 Output-dimensioner (`computeOutputDimensions`)

Input er visningsdimensioner (rotation er anvendt).
`scale = min(1, 1920 / max(w, h), 1080 / min(w, h))`, derefter afrundet til nærmeste lige tal.
Eksempler: 3840x2160 → 1920x1080, 2160x3840 → 1080x1920, 640x360 → 640x360.

Videobitrate: `max(2_000_000, round(8_000_000 × w × h / (1920 × 1080)))`. Keyframe hvert 2. sekund.

### 5.5 Tegning af markeringer

`renderAnnotations(ctx, width, height, annotations, t, measureText)` tegner alle ikke-frys-markeringer
hvor `startTime ≤ t ≤ endTime`. Samme funktion bruges af preview og eksport.

Skala: `s = min(width, height) / 1080`. Alle pixelmål herunder er ved `s = 1`.

| Type | Tegning |
|---|---|
| Cirkel | Centrum `(x·W, y·H)`, radius `radius · min(W, H)`. Streg `#FFB020`/`#D64545`/`#FFFFFF` efter farve; 8·s (bold) eller 4·s med stiplet `8·s 8·s` (normal). Fyld `rgba(255,176,32,0.05)` |
| Pil | Linje fra start til slut, streg 6·s. Pilehoved: udfyldt trekant, længde 6×streg, bredde 4,8×streg, spidsen 2,4×streg forbi linjens ende (som SVG-markeren i dag) |
| Tekst | Skriftstørrelse `factor · min(W, H)` (small 0,03, normal 0,04, large 0,055). Bold, hvid, `Arial, Helvetica, sans-serif`, centreret. Ombrydning ved 22 tegn på mellemrum (langt ord brydes ikke). Boks: bredde = målt bredeste linje + 2·padX, højde = linjer·font·1,25 + 2·padY, `padX = 0,6·font`, `padY = 0,45·font`, hjørneradius 0,22·font, fyld `rgba(0,0,0,0.82)`, centreret om `(x·W, y·H)`. Første grundlinje `rectY + padY + 0,85·font`, derefter +1,25·font pr. linje |

**Bevidste ændringer i `annotationGeometry.ts`:**
- Tekstens skriftstørrelse regnes af `min(W, H)` i stedet for `H`, så lodret video ikke får kæmpe tekst.
- Tekstboksens bredde måles via en `measureText`-funktion i stedet for `0,52 · font` pr. tegn.
- Stregbredder skaleres med `s`. Eksisterende unit-tests i `server/tests/export.test.ts` flyttes og opdateres.

### 5.6 Forløb

1. **Forbered:** valider, åbn `Input` med `BlobSource(file)`, find video- og lydspor, beregn dimensioner, planlæg.
2. **Lyd** (`decodeClipAudio`), kun hvis kilden har lyd:
   - Prøv `AudioSampleSink.samples(start, end)`.
   - Ved fejl: `Conversion` med `trim`, `video.discard`, `audio.forceTranscode: false` til en m4a i hukommelsen,
     derefter `OfflineAudioContext.decodeAudioData` og `AudioSample.fromAudioBuffer`.
   - Fejler begge: fortsæt uden lyd og sæt `audioWarning`.
   - AAC-encoder: `canEncodeAudio("aac", …)`, ellers `registerAacEncoder()` fra `@mediabunny/aac-encoder`.
3. **Billeder**, konstant 30 fps:
   - Videostykke: for `k = 0 … round(varighed·30) − 1`, kildetid `seg.start + k/30`.
     Hent billedet med `VideoSampleSink.samplesAtTimestamps`, tegn skaleret direkte på encoder-canvas
     (`sample.draw`), luk samplen, tegn markeringer for kildetiden, `CanvasSource.add(outTime + k/30, 1/30)`.
     Mangler et billede, genbruges det forrige.
   - Frysstykke: billedet ved `f.time` med markeringer aktive ved `f.time`, gentaget `round(varighed·30)` gange.
   - Lyd for stykket tilføjes efter billederne: trimmede samples med tidsstempel flyttet til output-tid,
     og stilhed (f32-nuller, samme samplerate og kanaler) for frys.
4. **Afslut:** `output.finalize()`, returnér `ExportedClip`. Filnavn via `sanitizeExportFileName(project.title)`.

### 5.7 Filhåndtering (`exportStorage.ts`)

- Findes `FileSystemFileHandle.prototype.createWritable`: skriv til OPFS-filen
  `coachclip-export-<uuid>.mp4` via `StreamTarget` (`chunked: true`), `Mp4OutputFormat({ fastStart: false })`.
- Ellers: `BufferTarget` med `fastStart: "in-memory"`.
- **Oprydning:** alle `coachclip-export-*` slettes ved app-start, når en ny eksport starter, når man
  forlader skærmen med det færdige klip, og ved afbrudt eller fejlet eksport.

### 5.8 Afbryd, skærm og baggrund

- `signal` tjekkes før hvert billede. Ved afbryd: `output.cancel()`, slet filen, kast `CANCELLED`.
- Wake Lock anmodes ved start og frigives til sidst. Fejl ved Wake Lock ignoreres.
- Var siden skjult (`visibilitychange`) under eksporten, og eksporten fejler, bliver fejlen `INTERRUPTED`.

## 6. Skærme

**Eksportskærm (`ExportScreen.tsx`):**
- Kør `capabilities()` først. Mangler støtte: vis `UNSUPPORTED_BROWSER`-beskeden, ingen eksport.
- Privatlivs-popup fjernes. Kort linje: "Klippet laves på din enhed – videoen sendes ingen steder."
- Upload, polling og alle `/api`-kald erstattes af `exportClip`. "Afbryd" bruger `AbortController`.
- Fejl vises med beskeden for fejlkoden. "Prøv igen" og "Gå tilbage" som i dag.

**Færdig-skærm (`App.tsx`):**
- "Del klip": `navigator.share({ files: [file] })` hvis `canShare`, ellers download.
- "Download MP4": `<a download>` med objekt-URL til filen.
- Info-kort: faktisk opløsning og varighed inkl. frys. `audioWarning` vises som note.

**Projekter:**
- `CoachClipProject.export` beholder `status: "exported"`, `fileName`, `fileSize`, `duration`.
  `jobId`, `downloadUrl`, `expiresAt` og logikken for "Udløbet" fjernes.
- Gamle projekter i IndexedDB med de felter skal stadig kunne indlæses (felterne ignoreres).
- Redigering og preview bruger kildevideoen (genforbind som i dag), aldrig en eksporteret fil.

**Preview:**
- `AnnotationCanvas` ligger over videoen i dens faktiske viste område og tegner med `renderAnnotations`
  ud fra videoens rigtige dimensioner (i dag antages altid 1920x1080).
- Bruges i editor, gennemse-trin og `PreviewScreen` i stedet for de tre nuværende implementeringer.
- Frys i editoren: det stoppede billede med markeringer og en lille nedtællingsmærkat
  (ingen sløret overlay).
- "Klar til offline-brug" fjernes fra Indstillinger.

## 7. Fejlhåndtering

`ExportError { code, cause }` med én dansk besked pr. kode:

| Kode | Hvornår | Besked |
|---|---|---|
| `UNSUPPORTED_BROWSER` | Mangler WebCodecs eller H.264-kodning i output-størrelsen | "Din browser kan ikke lave klip. Opdatér til iOS 26 eller nyere, eller brug Chrome, Edge eller Safari på en computer." |
| `UNREADABLE_VIDEO` | Container kan ikke læses, eller videosporet kan ikke afkodes | "Videoen kan ikke læses i denne browser. Prøv en anden video eller en anden browser." |
| `INVALID_PROJECT` | Projektet fejler valideringen (klip, varighed eller markeringer) | Valideringens egen danske besked, fx "Det valgte klip skal være mindst 0,5 sekunder." |
| `STORAGE_FULL` | `QuotaExceededError` | "Der er ikke plads nok på enheden til klippet. Frigør plads, og prøv igen." |
| `INTERRUPTED` | Fejl efter at siden har været skjult | "Eksporten stoppede, fordi skærmen blev slukket eller appen lukket. Prøv igen, og hold skærmen tændt." |
| `CANCELLED` | Træneren trykkede Afbryd | "Eksporten blev afbrudt." (neutral visning) |
| `UNKNOWN` | Alt andet | "Klippet kunne ikke oprettes. Projektet og dine markeringer er dog stadig gemt." |

Lyd, der ikke kan læses, er en advarsel: "Klippet er lavet uden lyd, fordi lyden i videoen ikke kunne læses."

## 8. Test

1. **Unit (vitest):** `planSegments`, `computeOutputDimensions` (vandret, lodret, små, ulige), `exportValidation`,
   `annotationGeometry` (inkl. skala og målt tekstbredde), `sanitizeExportFileName`, mapping af fejl til koder.
2. **Browsertests (Playwright, `channel: "chrome"`):** en test-side under `e2e/harness/` (kun dev, ikke i build)
   kører `exportClip` på committede testvideoer i `e2e/fixtures/` (samlet under 1 MB):
   - vandret 640x360, 8 s, 30 fps, sinustone
   - lodret med rotationsmetadata, uden lyd
   Output kontrolleres med Mediabunny i siden:
   - varighed (klip + frys ±0,05 s), dimensioner, 30 fps, H.264 og AAC
   - lyd over tærskel før og efter frys, stilhed under frys
   - billeder inde i fryset er pixel-identiske
   - markeringer: forskel mod eksport uden markeringer er 0 uden for tidsvinduet og over 0 inden for
   Chrome på Linux mangler AAC-kodning, så CI dækker også wasm-encoderen.
   **Skal bekræftes i første CI-kørsel:** at Google Chrome i CI kan kode H.264.
3. **E2E (Playwright, Chrome):** `export-flow` (UI → download → filen kontrolleres), `cancel-export`
   (neutral besked, OPFS-fil slettet), `delete-projects`, `app`. Webserver: `vite preview`.
4. **CI:** lint → typecheck → unit → build → browsertests → E2E. Docker-jobbet slettes.
   Hele `npm run verify` skal kunne blive grøn lokalt på Windows.
5. **Manuel tjekliste i PR:** iPhone med 4K lodret video, Gem i Fotos, skærm slukket midt i eksport,
   HEVC-video hvis tilgængelig.

## 9. Deploy og domæne

- Vercel-projekt `coachclip` (importeret, forbundet til `websitesmadsdam/CoachClip`).
- Production Branch: `main`. Build: `vite build`. Output: `dist`. `package.json` `build` kun Vite.
- `vercel.json` headers (flyttet fra Express):
  `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:`,
  samt `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  Den endelige CSP bekræftes ved at køre eksport og preview på et Vercel-preview.
- Beskyttelse: previews kræver Vercel-login, production-domænet er offentligt (tjekkes i dashboardet).
- Domæne sidst, når appen virker på `main`:
  1. Mads tilføjer `coachclip.coachapp.dk` i Vercel → Settings → Domains.
  2. CNAME-posten `coachclip` oprettes hos Simply.com med den værdi, Vercel viser (efter godkendelse af den konkrete post).
  3. HTTPS og visning af appen på domænet kontrolleres.

## 10. Leverancer i rækkefølge

1. **PR A:** merge #4 (typer i `shared/`, rate limits). Allerede grøn.
2. **PR B – eksport-motoren:** `src/export/*`, ændringer i `shared/`, unit-tests, test-side og browsertests,
   Playwright med Chrome, testvideoer. Serveren står stadig, men bruges ikke af UI'et.
3. **PR C – skiftet:** skærme, `AnnotationCanvas`, projekter uden udløb, sletning af server, Docker,
   smoketests, service worker, E2E-tests der ikke gælder mere, AI Studio-rester og død kode.
   `vercel.json`, `package.json`-scripts, CI og `CLAUDE.md`.
4. **D – deploy:** Production Branch `main`, domæne og DNS, slet `spike/browser-export` og `public/spike`,
   slet `.claude/launch.json` i OneDrive-mappen.

## 11. Risici og åbne punkter

| Risiko | Afbødning |
|---|---|
| 4K-eksport er langsom (19 billeder/s målt) | Direkte `sample.draw` i stedet for mellem-canvas; mål igen i PR B. 90 s 4K ≈ 2½ min er acceptabelt |
| HEVC-kilder er ikke testet | Manuel test i PR C. `UNREADABLE_VIDEO` hvis browseren ikke kan afkode |
| Skærmlås midt i eksport er ikke testet | Wake Lock + `INTERRUPTED`-besked. Manuel test i PR C |
| Chrome i CI mangler måske H.264 | Bekræftes i første CI-kørsel af PR B; ellers kør browsertests lokalt og marker i CI |
| Mediabunny ændrer sig hurtigt | Fastlås `mediabunny@1.56.2` og `@mediabunny/aac-encoder@1.56.2` |
| Stor fil på lille enhed | OPFS i stedet for hukommelse; `STORAGE_FULL`-besked |
| Ældre iOS og Firefox Android | Uden for scope; `UNSUPPORTED_BROWSER` |

## 12. Accept

- En træner på iPhone (iOS 26+) kan på `coachclip.coachapp.dk` vælge en video, markere, eksportere og gemme klippet i Fotos uden server.
- Klippet har korrekt orientering, markeringer som i preview, frys der indsætter tid med stilhed, og lyd der passer.
- Der findes ingen server, Docker eller FFmpeg-afhængighed i repoet.
- `npm run verify` er grøn i CI og lokalt på Windows.
