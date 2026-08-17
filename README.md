# Worldling

Worldling is a voice-first language travel game. Choose a city, walk through a small 3D district, meet a local character, complete an everyday conversation mission, and receive practical feedback on how clearly you communicated.

**Live build:** [worldling-sadak-game.vercel.app](https://worldling-sadak-game.vercel.app/)

## Why Worldling

Most people do not need to master an entire language before a trip. They need enough confidence to greet someone, order food, ask for directions, confirm a detail, and recover when a conversation goes off script. Worldling turns those moments into short playable missions.

## Current experience

- 12 destinations covering the world's ten most spoken languages plus Marathi and Kannada
- Walkable Three.js districts generated from cached OpenStreetMap geometry
- Three local characters and conversation scenes per city
- Browser speech recognition, browser speech synthesis, and typed fallback
- Open-ended NPC conversations with recent-turn memory
- Beginner, intermediate, and advanced difficulty
- Transparent end-of-conversation grading and rewards
- Local Ollama, hosted API, and offline demo providers
- Local Whisper/phoneme or Azure pronunciation assessment
- Persistent XP, coins, passport stamps, mission progress, and character affinity
- Sadak-style district selector and full-screen street HUD
- Sprinting, pause menu, phrasebook, transcript, radar, keyboard controls, touch joystick, and a 360° orbit camera

## Quick start

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. Demo mode needs no keys, account, or model download.

Useful checks:

```bash
npm run build
npm test
npm run lint
```

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` or arrow keys | Walk |
| `Shift` + movement | Run |
| Click/tap the ground | Move to a point |
| Drag the 3D street | Orbit 360° around the player |
| Mouse wheel or pinch | Zoom the camera |
| `E` near a character | Focus the conversation input |
| `P` | Open or close pocket phrases |
| `Esc` | Pause, resume, or close the current overlay |
| Touch joystick | Move on phones and tablets |

## AI providers

### Demo

The default deterministic provider keeps the complete game loop playable without external services. It is intentionally simple and clearly labelled.

### Ollama on your device

Install a multilingual model, for example:

```bash
ollama pull qwen3:8b
```

Start Ollama, open **AI & voice settings**, select **Local model**, enter `http://127.0.0.1:11434`, and test the connection. The browser talks directly to Ollama's `/api/tags` and `/api/chat` endpoints.

When the hosted site calls a local Ollama instance, allow the Worldling origin through `OLLAMA_ORIGINS`. Running both Worldling and Ollama locally usually needs no extra origin configuration.

### Hosted API

Copy `.env.example` to `.env.local` and configure server-side values:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

Keys stay on the server. The client receives only the NPC response or evaluation result.

## Pronunciation assessment

Worldling separates conversation success from acoustic pronunciation. Conversation grading judges whether a player communicated; pronunciation mode evaluates a known recorded phrase.

- **Local:** run the service in `local-pronunciation/` for Whisper intelligibility and optional phoneme scoring.
- **Azure:** configure `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` for Azure Speech pronunciation assessment.

See [local-pronunciation/README.md](local-pronunciation/README.md) for installation details.

## How the world is built

The browser loads a cached district from `public/city-data/`. Road paths and building footprints come from OpenStreetMap. Building outlines are projected into local coordinates and extruded in Three.js; explicit height or level metadata is used when available. A richer OSM2World conversion is attempted when its runtime and textures are available, with a lightweight local renderer as the fallback.

The playable street then adds a Sadak-derived human-scale facade layer: recessed windows, shop bays, floor ledges, balconies, awnings, signboards, and rooftop tanks. Those details are merged into four geometries per building to keep the scene efficient while the OSM shapes provide the surrounding city mass.

New York additionally uses official NYC building footprints and roof heights. Its current playable street is an authored composition using those real shapes, not a survey-accurate digital twin.

Read [docs/CITY-PIPELINE.md](docs/CITY-PIPELINE.md) for the data flow, refresh commands, limitations, and licensing boundaries.

## Architecture

```text
Browser
  ├─ React game shell and local progression
  ├─ React Three Fiber district renderer
  ├─ Web Speech transcription / playback
  └─ Direct Ollama connection (optional)
          │
          ├─ /api/agent ───────── hosted conversation and grading
          ├─ /api/osm ─────────── live OpenStreetMap refresh
          └─ /api/pronunciation ─ Azure acoustic assessment
```

Application code owns world state, proximity, movement, goals, rewards, fallbacks, and UI. Language models are limited to in-character conversation and transcript-based evaluation.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project layout

```text
app/
  page.tsx                 Game shell, dialogue, progression, overlays
  World3D.tsx              Three.js district, characters, camera, map rendering
  SadakStreetBuilding.tsx  Merged street-facing building geometry
  VirtualJoystick.tsx      Touch movement control
  api/agent/               Provider-routed conversation and evaluation
  api/osm/                 OpenStreetMap district refresh
  api/pronunciation/       Azure pronunciation provider
public/
  city-data/               Cached playable map districts
  models/                  Licensed GLB characters and city props
local-pronunciation/       Optional local acoustic scoring service
scripts/                   City data preparation tools
tests/                     Rendered deployment checks
```

## Design provenance and permissions

Worldling's district selector, street HUD, interaction framing, virtual joystick, and street-building geometry are adapted from [Sadak](https://github.com/mittal-parth/sadak), created by Parth Mittal and contributors. On 17 August 2026, Parth Mittal explicitly granted permission in the Worldling development session to use and adapt Sadak's original code. Adapted source is identified in code comments where applicable. Third-party assets remain governed by their original licenses.

Worldling currently uses:

- Kenney City Kit assets — CC0
- Quaternius character assets — see `public/models/quaternius/LICENSE.txt`
- OpenStreetMap data — © OpenStreetMap contributors, ODbL
- NYC Open Data building footprints where noted

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

## Known limitations

- City quality depends on map coverage around the selected coordinates.
- The browser's built-in speech recognition support varies by browser and language.
- Browser speech synthesis voices vary by operating system.
- Most landmarks are stylised approximations rather than production models.
- Progress is device-local in the current prototype.
- This is not Google Street View, photogrammetry, or a survey-accurate city twin.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [City data pipeline](docs/CITY-PIPELINE.md)
- [Contribution guide](CONTRIBUTING.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
