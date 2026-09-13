# CoachClip

Taktiske videoklip til sportstrænere: vælg en video, find situationen, tegn tekst, cirkler,
pile og frysebilleder, og få en færdig MP4 med markeringerne brændt ind.

Alt sker i din browser. Videoen sendes ingen steder, og der er intet login. Projekter gemmes
lokalt i browseren (IndexedDB).

## Kom i gang

Kræver Node.js 20 eller 22 og Google Chrome (til testene).

```bash
npm ci
npm run dev
```

Åbn http://localhost:5173.

## Kvalitetskontrol

```bash
npm run verify
```

Kører lint, typecheck, enhedstests, build, eksportmotorens tests i Chrome og E2E-tests af den
byggede app i Chrome under produktionens sikkerheds-headers.

## Understøttede enheder

iPhone og iPad med iOS 26 eller nyere, samt Chrome, Edge og Safari på computer.

## Udrulning

Appen er et statisk site på Vercel (`vercel.json`). Se `CLAUDE.md` for arkitektur og regler.
