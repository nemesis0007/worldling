# Worldling architecture

## Product boundary

Worldling is a browser-first game with optional local and hosted AI services. Deterministic application code owns gameplay. Models do not control movement, rewards, proximity, provider selection, or whether a mission is complete.

## Main runtime

`app/page.tsx` is the game shell. It owns:

- selected city, scene, difficulty, and provider
- transcript and conversation lifecycle
- player position and NPC proximity
- mission steps, affinity, XP, coins, and stamps
- district selector, phrasebook, pause, transcript, engine, and pronunciation overlays
- device-local preferences and progression

`app/World3D.tsx` renders the current district with React Three Fiber. It owns:

- loading cached city geometry
- optional OpenStreetMap refresh status
- roads and extruded building footprints
- Sadak-derived merged street facades with recessed windows, shops, ledges, balconies, awnings, and rooftop clutter
- characters, landmark approximations, props, lighting, fog, and camera follow
- pointer-to-ground movement targets

## Conversation flow

```text
player speech or text
        ↓
client adds user turn and updates deterministic mission steps
        ↓
demo / direct Ollama / server API provider
        ↓
structured NPC reply
        ↓
client appends transcript, raises affinity, and optionally speaks reply
```

If a configured model fails, the turn falls back to the deterministic demo response and the UI reports the provider change. The game remains playable.

## Evaluation flow

Evaluation is a separate action from NPC conversation. The evaluator receives the mission, level, language, and transcript. It returns communication, vocabulary, grammar, confidence, one strength, one improvement, and a useful phrase. Application code calculates rewards and prevents duplicate payouts.

## Provider contracts

- **Demo:** deterministic client-side reply and rubric.
- **Local:** browser calls an Ollama instance directly. Prompts and replies stay between that browser and the configured endpoint.
- **Hosted:** `/api/agent` calls the configured server-side provider.

Provider identity is shown in the HUD and engine settings so a fallback cannot silently masquerade as Ollama or a hosted model.

## Voice and pronunciation

Everyday conversation uses the Web Speech API when supported, with typing as the universal fallback. Browser speech synthesis reads NPC replies using the city's locale.

Pronunciation assessment records 16 kHz mono WAV audio and sends it to either the optional local service or Azure Speech. It is deliberately separate from conversation grading because pronunciation needs acoustic evidence, while communication success needs transcript and context.

## State and persistence

The current prototype stores provider preference, Ollama endpoint/model, pronunciation preference, XP, coins, and stamps in `localStorage`. Secrets are never stored there. A future account system can replace this seam with server persistence without changing the game model.

## Performance boundaries

- `World3D` is lazy-loaded so the title experience can render first.
- Canvas pixel density is capped.
- City data is cached as static JSON.
- OSM2World meshes are capped and disposed when the district changes.
- GLB models are preloaded and cloned for reuse.
