# CoachClip – Pilotklar, visuelt valideret og produktionsnær MVP

Velkommen til CoachClip! Dette er den pilotklare version, som er optimeret og stabiliseret til kontrolleret pilotbrug med rigtige trænere. 

CoachClip er bygget som en strømlinet single-instance pilotapplikation uden ekstern database:
- **Ingen database eller registrering**: Ingen login eller brugerstyring kræves, hvilket sikrer øjeblikkelig adgang.
- **In-memory jobstatus**: Eksportjobs og deres tilstande styres udelukkende in-memory. Eventuelle aktive jobstatusser nulstilles ved servergenstart.
- **Lokal browserlagring**: Projekter, tidslinjemarkeringer og metadata gemmes direkte i trænerens egen browser via IndexedDB.
- **Automatisk oprydning med TTL (Time-To-Live)**: Kildevideoer og færdigbehandlede eksportfiler gemmes midlertidigt på serveren under transkodningen og slettes automatisk efter en konfigureret levetid (TTL). 

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
3. **Enhedstests (`vitest`)**: Tester de underliggende matematiske formler, concurrency-begrænsninger i job-køen, hastighedsgrænser og geometri-hjælpere.
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

## 🎯 Produktionsparathed & Backend-Hærdning

I denne opdatering er der foretaget en fokuseret og stringent hærdning af backend-arkitekturen til en kontrolleret pilotfase:

### 1. Robust CORS-politik
* **Udvikling**: Understøtter fleksibel adgang via konfigurerede origins.
* **Produktion**: Kræver en eksplicit defineret origin via miljøvariablen `CORS_ORIGIN` (f.eks. `https://coachclip.com`). Serveren nægter at starte i produktion, hvis `CORS_ORIGIN` ikke er sat, eller hvis den er sat til det usikre wildcard `*`.

### 2. Endpoint-specifik Rate Limiting med `Retry-After`
For at beskytte serverressourcerne mod misbrug og overbelastning (f.eks. fra aggressive webcrawlere eller DDOS):
* **Generel API rate limit**: 100 anmodninger per minut per IP.
* **POST /api/exports limit**: Maksimalt 5 eksportoprettelser per minut per IP for at beskytte de tunge transkodningsprocesser.
* **Retry-After Header**: Hvis en IP overskrider grænsen, afvises anmodningen med en HTTP 429-status, og der returneres en præcis `Retry-After` header med antallet af sekunder, klienten skal vente, før en ny anmodning kan behandles.

### 3. Graceful Shutdown Flow
Ved modtagelse af `SIGTERM` eller `SIGINT` (f.eks. under genstart eller skalering af Cloud Run-containere) udføres følgende sekvens:
1. `exportQueue.stopNewJobs()` kaldes omgående, hvilket stopper indtaget af nye anmodninger (der efterfølgende afvises med en HTTP 503-status).
2. HTTP-serveren stopper med at acceptere nye netværksforbindelser via `server.close()`.
3. Der oprettes en fallback-sikkerhedstimer på 30 sekunder, hvorefter processen tvinges til at lukke (for at undgå hængende servere).
4. Serveren venter aktivt på, at igangværende FFmpeg-processer færdiggør deres transkodning, hvorefter processen lukker rent med exit code 0.

### 4. Sikker, Struktureret Logger med Sensitivitets-Redigering
Der er implementeret en centraliseret JSON-logger (`/server/src/utils/logger.ts`) med følgende egenskaber:
* **JSON i produktion**: Sikrer nem log-aggregering og fejlovervågning.
* **Automatiske Redigeringsfiltre (Redaction)**: Loggeren fjerner automatisk følsomme oplysninger (såsom absolutte systemstier, rå filnavne, tokens og rå FFmpeg CLI-parametre) før logs skrives til konsollen for at forhindre utilsigtet datalækage.
* **Konsistente niveauer**: Understøtter `error`, `warn`, `info`, og `debug`.

### 5. Non-blocking Sundheds- og Parathedstjek (Health Checks)
* **Ingen Synkron Eksekvering**: Kaldet til `execSync("ffmpeg")` er fjernet fra `/api/ready` og `/api/health` for at undgå trådblokering ved hyppige sundhedstjek.
* **Boot-validering**: Tilgængeligheden af `ffmpeg` og `ffprobe` testes én gang ved serveropstart og caches derefter i hukommelsen.
* **Systemmetrikker**: `/api/health` returnerer nu ikke-blokerende asynkron information om ledig diskplads, ledig systemhukommelse samt aktiv og ventende jobkø-status.

### 6. Konsolideret CI/CD Pipeline
For at fjerne duplikeret kode og overhead i GitHub Actions, er den oprindelige `docker.yml` lagt sammen med `verify.yml` i en samlet to-job pipeline:
* **Job 1 (verify)**: Installerer afhængigheder, validerer kildekode (lint, typecheck), og afvikler alle enhedstests, smoke-tests og Playwright E2E-scenarier.
* **Job 2 (docker)**: Bygger Docker-containeren, kører den i baggrunden, og verificerer liveness, readiness samt kører en helbredstest via containerens `/api/ready` endpoint.

---

## 🎯 Pilotfasens Rammer & Bevidste Begrænsninger

CoachClip MVP er designet til at være en ultra-fokuseret, driftsstabil og lynhurtig løsning til taktisk videoanalyse. Følgende er en ærlig oversigt over systemets rammer og bevidste begrænsninger under pilotfasen:

1. **Ingen Brugerstyring eller Login**: Appen er 100% åben og klar til brug uden barriere. Der kræves ikke oprettelse eller adgangskode.
2. **Lokal Lagring (IndexedDB)**: Trænerens projekter, videoreferencer og markeringer gemmes udelukkende lokalt i browseren. Hvis browserdata ryddes, slettes projekterne ligeledes.
3. **Intet Cloud-videogalleri**: Kildevideoer uploades midlertidigt til serveren til transkodning, hvorefter de omgående slettes fra disk for at skåne hostens diskplads.
4. **Sekventiel Jobbehandling (Concurrency Limit)**: Serveren behandler eksportjobs i en stabil, begrænset køstruktur med en prædefineret kapacitetsgrænse (concurrency-begrænsning). Under tæt pilotbrug kan der opleves kortvarig køtid ved tunge eksport-anmodninger.
5. **Ingen Transitions, AI-analyser eller Musik**: Systemet fokuserer udelukkende på præcis, taktisk visualisering. Der er bevidst ikke tilføjet unødvendig kompleksitet som automatiske tracking-moduler, baggrundsmusik eller visuelle overgange.
