# Worldling

Worldling is a voice-first language travel game prototype. Players choose a city and local scene, talk freely with an AI character, and finish with a level-aware conversation score.

## What works

- Bengaluru, Tokyo, and Paris destination packs
- Three local scenes and characters per city
- Browser speech recognition and speech synthesis with typed fallback
- Beginner, intermediate, and advanced modes
- Open-ended NPC conversations
- End-of-conversation evaluation with evidence-based feedback
- Demo, local-model, and hosted-API provider modes
- Automatic demo fallback when a configured model is unavailable

## Run locally

```bash
npm install
npm run dev
```

The demo provider works without configuration.

## Local model

Copy `.env.example` to `.env.local`, then set an OpenAI-compatible endpoint and model. Ollama commonly exposes `http://127.0.0.1:11434/v1`; LM Studio commonly exposes `http://127.0.0.1:1234/v1`.

```env
LOCAL_AI_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_AI_MODEL=qwen3:8b
```

## Hosted API

Configure the key on the server, never in the browser:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.6-luna
```

The API route uses the Responses API for hosted requests and an OpenAI-compatible chat-completions contract for local models.

## Agent design

The prototype separates four responsibilities: world state, NPC conversation, provider routing, and evaluation. The model may respond in character, but deterministic application code owns city selection, level, scene goal, transcript, fallback behavior, and score presentation.
