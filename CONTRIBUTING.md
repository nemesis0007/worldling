# Contributing to Worldling

## Development

```bash
npm install
npm run dev
```

Before submitting a change:

```bash
npm run build
npm test
npm run lint
```

## Product rules

- Keep the primary loop walk → meet → speak → feedback.
- Preserve typed input whenever voice is unavailable.
- Never hide which AI provider produced a reply or when fallback was used.
- Do not let a language model directly mutate rewards or world state.
- Do not penalise regional accents in conversation grading.
- Keep secrets server-side and provide useful behavior when keys are absent.
- Make every interactive control keyboard accessible and touch usable.

## Adding a city

1. Add city metadata, scenes, prompts, locale, and centre coordinates.
2. Download and inspect its OpenStreetMap district.
3. Verify player and NPC positions are reachable.
4. Add an atmosphere and recognisable landmark treatment without copying restricted map imagery.
5. Test browser speech recognition and synthesis for the locale.
6. Add correct asset and data attribution.

## Asset policy

Only commit assets with clear redistribution rights. Add the author, source, and license to `THIRD_PARTY_NOTICES.md`; preserve any required license file next to the asset. Do not copy Google Street View imagery or unlicensed models.

## Documentation

Update the README when a user-facing capability or setup step changes. Update `docs/ARCHITECTURE.md` for runtime boundaries and `docs/CITY-PIPELINE.md` for map-data changes.

