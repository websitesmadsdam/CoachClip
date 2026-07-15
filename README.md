# CoachClip – Pilotklar, visuelt valideret og produktionsnær MVP

Velkommen til CoachClip! Dette er den pilotklare version, som er optimeret og stabiliseret til kontrolleret pilotbrug med rigtige trænere. 

MVP-arkitekturen bevarer CoachClips lette, intuitive flow, IndexedDB-lagring og stærke FFmpeg-motor, samtidig med at den sikrer en meget høj visuel overensstemmelse mellem web-previewet og det færdige, eksporterede videoklip via en fælles geometrimotor og automatiske pixel-regressions-smoke-tests.

---

## 🚀 Kom i gang

Projektet understøtter og er testet på følgende Node.js versioner:
* **Node.js**: `>=20 <23` (Testet og stabiliseret på Node.js v20/v22)

### 1. Installation af afhængigheder
For at foretage en ren installation af alle nødvendige pakker samt Playwright-browsere:
```bash
npm ci
npx playwright install chromium
```

### 2. Start i udviklingstilstand
Udviklingsserveren starter automatisk både den lynhurtige Vite frontend og Express-backend-serveren på port 3000:
```bash
npm run dev
```

### 3. Kørsel i produktion
For at bygge frontend og backend i en optimeret produktionspakke:
```bash
npm run build
npm run start
```

---

## 🛠️ Kvalitetskontrol & Fuld Verifikation

Projektet inkluderer en robust, automatiseret kvalitetssikringskæde (`verify`). Denne kommando udfører alt det nødvendige for at godkende en ny udgivelse:

```bash
npm run verify
```

Når du kører `verify`, afvikles følgende faser sekventielt:
1. **Linter (`eslint`)**: Sikrer streng kodekvalitet, korrekt typesikkerhed og syntaksmæssig præcision.
2. **Typecheck (`tsc`)**: Garanterer fuld type-sikkerhed på tværs af frontend og backend.
3. **Enhedstests (`vitest`)**: Tester de underliggende matematiske formler, concurrency-begrænsninger i job-køen og geometri-hjælpere.
4. **Produktions-Build**: Validerer at applikationen kan kompileres uden fejl.
5. **9x Fuldautomatiserede Smoke-tests**:
   - **`smoke:export:simple`**: Simpel video-trimning og transkodning.
   - **`smoke:export:no-audio`**: Transkodning af videoer uden lydspor uden backend-nedbrud.
   - **`smoke:export`**: Fuld transkodning med alle markeringstyper (tekst, cirkel, pil, freeze) kombineret.
   - **`smoke:export:text`**: Pixel-baseret visual regression test for tekst-markeringer.
   - **`smoke:export:circle`**: Pixel-baseret visual regression test for cirkel-markeringer.
   - **`smoke:export:arrow`**: Pixel-baseret visual regression test for pil-markeringer.
   - **`smoke:export:freeze`**: Tidsmæssig validering af frame-freeze varighed og frame-freeze præcision.
   - **`smoke:export:annotations`**: Validering af kombineret HD-transkodning (1280x720).
   - **`smoke:api:simple`**: Gennemtestning af det faktiske REST API (POST, statuspolling, timeout og download).
6. **Browser E2E-tests (`playwright`)**: Afvikler automatiske browser- og viewport-tests i både desktop- og mobil-viewports for at validere det faktiske brugerflow og responsive elementer uden nedbrud.

---

## 🎯 Visuel Overensstemmelse (Preview vs. Eksport)

For at sikre, at det træneren ser på skærmen svarer bedst muligt til det, der eksporteres i videoen, deler previewet og eksport-servicen en centraliseret geometrimotor (`/shared/annotationGeometry.ts`):

* **Cirkler**: Radii og tykkelser beregnes ud fra videoens faktiske højde, hvilket sikrer, at cirklen dækker det samme areal uanset skærmstørrelse.
* **Pile**: Start- og slutkoordinater normaliseres og konverteres til absolutte SVG-vektorer, hvilket forhindrer skævvridning.
* **Tekstbokse**: Tekststørrelser, baggrunds-paddings og rammer skaleres dynamisk i forhold til videoens højde, så der aldrig opstår uventede tekstombrydninger eller afskårne bogstaver.

Vores smoke-tests bruger et avanceret, pixel-baseret regressionsbibliotek (`pixelmatch`), som udtrækker rå videoframer via FFmpeg og sammenligner dem direkte for at garantere visuel og geometrisk konsistens. På grund af potentielle forskelle i font-rendering, hardware-acceleration og codecs mellem forskellige browsere og servermiljøer, garanterer vi en ekstremt høj overensstemmelse snarere end en absolut 100% teoretisk pixel-perfekt ensartethed på tværs af alle tænkelige browser-klienter.

---

## 🏛️ Systemarkitektur & Dataflow

CoachClip er opbygget som en robust, fuldstændig integreret fuldstændig-stak applikation, der overholder følgende fire-trins behandlingskæde:

```text
[ 1. FRONTEND WIZARD FLOW ]
  - Upload/Træk-og-slip -> IndexedDB
  - Trimning (Start/Slut) -> Tegneværktøjer
  - Annotationer: Tekst, Cirkel, Pil, Freeze (Frys)
        │
        ▼
[ 2. API ENDPOINT (POST /api/exports) ]
  - Multipart upload af kildevideo + JSON metadata
  - Strict input-validering af klip-længder og annotations-overlap
        │
        ▼
[ 3. JOB-KØ (ExportQueue) ]
  - Concurrency Limit (MAX_CONCURRENT_EXPORTS=2)
  - FIFO sequential processing af godkendte jobs
        │
        ▼
[ 4. FFMPEG RENDERING ENGINE ]
  - SVG-overlay generering for hver frame-annotation
  - Trimning -> Annotations-brænding -> Freeze-bygning -> Audio-remap
  - Rent og optimeret MP4 (H.264 / AAC) output gemt i ./tmp/exports
```

---

## ❄️ Freeze Frame & Lyd-Strategi (Lydbæring)

For at sikre, at videoen ikke mister sin lyd eller fejler under frame-frysnings-perioder, anvender CoachClip en intelligent og stringent lyd- og billedstrategi i FFmpeg-pipelinen:

1. **Undersøgelse af kildelyd**: Pipelinen analyserer først kildevideoen for at se, om der findes et lydspor. Hvis videoen ikke har noget lydspor, udelades lydsporet helt i eksporten for at forhindre transkodningsfejl.
2. **Standardisering**: Hvis der findes et lydspor, tvinges formatet til 48kHz stereo (`-ar 48000 -ac 2`) i AAC for optimal kompatibilitet på tværs af platforme (Messenger, holdsport, etc.).
3. **Fryse-behandling (Lyd-bæring)**: Under fryse-framer (hvor videoen fryses midlertidigt for at vise en annotation), splitter FFmpeg lyd og billede op. Videoen strækkes (frys), mens lyden enten pauses eller gøres lydløs under frysepunktet ved hjælp af præcise tidsbaserede filtre (`atrim`, `asetpts`, `concat`), hvilket sikrer, at lyden bagefter fortsætter synkront med videoafspilningen uden jitter eller codec-nedbrud.

---

## 🐳 Docker Deployment & Driftsvejledning

Applikationen er fuldt forberedt til container-baseret udrulning (f.eks. på Google Cloud Run) via den medfølgende multi-stage `Dockerfile`. 

### Container Sikkerhed & Drift:
* **Non-Root Bruger**: Containeren kører som den indbyggede, upriviligerede `node` bruger for at sikre højeste sikkerhedsniveau mod uautoriseret systemadgang.
* **Integreret Sundhedstjek (`HEALTHCHECK`)**: Docker-daemon eller orkestreringsværktøjet overvåger automatisk backendens status på `/api/health`.

### Driftskonfiguration via Miljøvariable (.env):
Du kan finjustere containerens performance og ressourceforbrug ved at konfigurere følgende variabler:
* `MAX_CONCURRENT_EXPORTS`: Standard er `2`. Angiver hvor mange FFmpeg processer, der må afvikles parallelt. Sæt til `1` under begrænsede CPU/RAM-forhold (f.eks. 1 vCPU Cloud Run) for at forebygge ressource-throttling.
* `FFMPEG_TIMEOUT_SECONDS`: Standard er `600` (10 minutter). Dræber automatisk hængende transkodninger.
* `OUTPUT_TTL_MINUTES`: Standard er `60` (1 time). Angiver hvor længe de færdige videoer ligger på disk, før de automatisk slettes.
* `LOG_LEVEL`: Understøtter `error`, `warn`, `info`, og `debug` (styres via `LOG_LEVEL=info`).

### Byg Docker-image:
```bash
docker build -t coachclip:mvp .
```

### Kør containeren lokalt:
```bash
docker run -p 3000:3000 -e LOG_LEVEL=debug -e MAX_CONCURRENT_EXPORTS=1 coachclip:mvp
```

---

## 🛠️ Kvalitetskontrol & Fuld Verifikation

Projektet inkluderer en robust, automatiseret kvalitetssikringskæde (`verify`). Denne kommando udfører alt det nødvendige for at godkende en ny udgivelse:

```bash
npm run verify
```

Når du kører `verify`, afvikles følgende faser sekventielt:
1. **Linter (`eslint`)**: Sikrer streng kodekvalitet, korrekt typesikkerhed og syntaksmæssig præcision.
2. **Typecheck (`tsc`)**: Garanterer fuld type-sikkerhed på tværs af frontend og backend.
3. **Enhedstests (`vitest`)**: Tester de underliggende matematiske formler, concurrency-begrænsninger i job-køen og geometri-hjælpere.
   * Kør kun enhedstests direkte med: `npm test`
4. **Produktions-Build**: Validerer at applikationen kan kompileres uden fejl (`npm run build`).
5. **9x Fuldautomatiserede Smoke-tests**:
   * Kør alle smoke-tests med: `npm run smoke` eller individuelle, f.eks.: `npx tsx scripts/smokeExportFreeze.ts`
6. **Browser E2E-tests (`playwright`)**:
   * Kør de nye end-to-end scenarier i Chromium (E2E Export, Cancellation, Expiry) via:
     ```bash
     npx playwright test
     ```
   * Visuel UI-rapportering: `npx playwright show-report`

---

## 🎯 Visuel Overensstemmelse (Preview vs. Eksport)

CoachClip MVP er designet til at være en ultra-fokuseret, driftsstabil og lynhurtig løsning til taktisk videoanalyse. Følgende er en ærlig oversigt over systemets rammer og bevidste begrænsninger under pilotfasen:

1. **Ingen Brugerstyring eller Login**: Appen er 100% åben og klar til brug uden barriere. Der kræves ikke oprettelse eller adgangskode.
2. **Lokal Lagring (IndexedDB)**: Trænerens projekter, videoreferencer og markeringer gemmes udelukkende lokalt i browseren. Hvis browserdata ryddes, slettes projekterne ligeledes.
3. **Intet Cloud-videogalleri**: Kildevideoer uploades midlertidigt til serveren til transkodning, hvorefter de omgående slettes fra disk for at skåne hostens diskplads.
4. **Sekventiel Jobbehandling (Concurrency Limit)**: Serveren behandler eksportjobs i en stabil, begrænset køstruktur med en prædefineret kapacitetsgrænse (concurrency-begrænsning). Under tæt pilotbrug kan der opleves kortvarig køtid ved tunge eksport-anmodninger.
5. **Ingen Transitions, AI-analyser eller Musik**: Systemet fokuserer udelukkende på præcis, taktisk visualisering. Der er bevidst ikke tilføjet unødvendig kompleksitet som automatiske tracking-moduler, baggrundsmusik eller visuelle overgange.
