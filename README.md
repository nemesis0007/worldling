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
- Persistent traveller XP, coins, passport stamps, scene quests, and character affinity

## Run locally

```bash
npm install
npm run dev
```

The demo provider works without configuration.

## Local model with Ollama

Open **Engine → Local model** in the game, enter the Ollama address and an installed model, then use **Test Ollama connection**. The browser calls Ollama's native `/api/tags` and `/api/chat` endpoints directly; prompts and responses do not pass through the Worldling deployment.

The default address is `http://127.0.0.1:11434`. Download a multilingual model before connecting, for example:

```bash
ollama pull qwen3:8b
```

When using the hosted Worldling URL, add that exact site origin to Ollama's `OLLAMA_ORIGINS` configuration and restart Ollama. Running Worldling locally is simpler because Ollama allows loopback web origins by default.

The server-side OpenAI-compatible route remains available for local development. Copy `.env.example` to `.env.local`, then configure:

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
