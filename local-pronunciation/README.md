# Worldling local pronunciation service

This service receives a 16 kHz mono WAV recording and a known reference phrase.
It uses Faster Whisper for local transcription and word timing. When Allosaurus
and Epitran support the chosen locale, it also compares recognized phones with
the expected IPA sequence. Fluency is derived from timing, pace, and pauses.

From the project folder, run:

```powershell
.\start-local-pronunciation.ps1
```

The first run installs dependencies and downloads the selected Whisper model.
The service listens only on `127.0.0.1:8787` and permits requests from the
Worldling hosted origin and its local development origins.

Keep the PowerShell window open while using the pronunciation lab. You can
confirm the service is ready by opening `http://127.0.0.1:8787/health`, or by
clicking **Test service** in the game.

Environment variables:

- `WORLDLING_WHISPER_MODEL`: defaults to `small`
- `WORLDLING_WHISPER_DEVICE`: defaults to `cpu`
- `WORLDLING_WHISPER_COMPUTE`: defaults to `int8`
