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

## 🐳 Docker Deployment

Applikationen er fuldt forberedt til container-baseret udrulning (f.eks. på Google Cloud Run) via den medfølgende multi-stage `Dockerfile`. 

### Container Sikkerhed & Drift:
* **Non-Root Bruger**: Containeren kører som den indbyggede, upriviligerede `node` bruger for at sikre højeste sikkerhedsniveau mod uautoriseret systemadgang.
* **Integreret Sundhedstjek (`HEALTHCHECK`)**: Docker-daemon eller orkestreringsværktøjet overvåger automatisk backendens status på `/api/health`.

### Byg Docker-image:
```bash
docker build -t coachclip:mvp .
```

### Kør containeren lokalt:
```bash
docker run -p 3000:3000 coachclip:mvp
```

---

## ⚠️ Ærlig Dokumentation af MVP'ens Begrænsninger

CoachClip MVP er designet til at være en ultra-fokuseret, driftsstabil og lynhurtig løsning til taktisk videoanalyse. Følgende er en ærlig oversigt over systemets rammer og bevidste begrænsninger under pilotfasen:

1. **Ingen Brugerstyring eller Login**: Appen er 100% åben og klar til brug uden barriere. Der kræves ikke oprettelse eller adgangskode.
2. **Lokal Lagring (IndexedDB)**: Trænerens projekter, videoreferencer og markeringer gemmes udelukkende lokalt i browseren. Hvis browserdata ryddes, slettes projekterne ligeledes.
3. **Intet Cloud-videogalleri**: Kildevideoer uploades midlertidigt til serveren til transkodning, hvorefter de omgående slettes fra disk for at skåne hostens diskplads.
4. **Sekventiel Jobbehandling (Concurrency Limit)**: Serveren behandler eksportjobs i en stabil, begrænset køstruktur med en prædefineret kapacitetsgrænse (concurrency-begrænsning). Under tæt pilotbrug kan der opleves kortvarig køtid ved tunge eksport-anmodninger.
5. **Ingen Transitions, AI-analyser eller Musik**: Systemet fokuserer udelukkende på præcis, taktisk visualisering. Der er bevidst ikke tilføjet unødvendig kompleksitet som automatiske tracking-moduler, baggrundsmusik eller visuelle overgange.
