from __future__ import annotations

import difflib
import math
import os
import re
import tempfile
import unicodedata
import wave
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

try:
    import epitran
except Exception:
    epitran = None

try:
    from allosaurus.app import read_recognizer
except Exception:
    read_recognizer = None


app = FastAPI(title="Worldling Local Pronunciation", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://worldling-voice-lab.niraj-khumkar24.chatgpt.site",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

WHISPER_LANGUAGE = {
    "en-US": "en", "zh-CN": "zh", "hi-IN": "hi", "es-ES": "es",
    "fr-FR": "fr", "ar-EG": "ar", "bn-BD": "bn", "pt-BR": "pt",
    "ru-RU": "ru", "ur-PK": "ur", "mr-IN": "mr", "kn-IN": "kn",
}
ALLOSAURUS_LANGUAGE = {
    "en-US": "eng", "zh-CN": "cmn", "hi-IN": "hin", "es-ES": "spa",
    "fr-FR": "fra", "ar-EG": "ara", "bn-BD": "ben", "pt-BR": "por",
    "ru-RU": "rus", "ur-PK": "urd", "mr-IN": "mar", "kn-IN": "kan",
}
EPITRAN_LANGUAGE = {
    "en-US": "eng-Latn", "zh-CN": "cmn-Hans", "hi-IN": "hin-Deva", "es-ES": "spa-Latn",
    "fr-FR": "fra-Latn", "ar-EG": "ara-Arab", "bn-BD": "ben-Beng", "pt-BR": "por-Latn",
    "ru-RU": "rus-Cyrl", "ur-PK": "urd-Arab", "mr-IN": "mar-Deva", "kn-IN": "kan-Knda",
}

_whisper: WhisperModel | None = None
_phone_recognizer: Any = None


def whisper_model() -> WhisperModel:
    global _whisper
    if _whisper is None:
        _whisper = WhisperModel(
            os.getenv("WORLDLING_WHISPER_MODEL", "small"),
            device=os.getenv("WORLDLING_WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WORLDLING_WHISPER_COMPUTE", "int8"),
        )
    return _whisper


def phone_recognizer() -> Any:
    global _phone_recognizer
    if _phone_recognizer is None and read_recognizer is not None:
        _phone_recognizer = read_recognizer()
    return _phone_recognizer


def normalized_words(text: str) -> list[str]:
    normalized = "".join(
        character.casefold() if unicodedata.category(character)[:1] in {"L", "M", "N"} else " "
        for character in text
    )
    return normalized.split()


def similarity(left: list[str], right: list[str]) -> float:
    return difflib.SequenceMatcher(None, left, right).ratio()


def word_results(reference: list[str], recognized: list[str]) -> list[dict[str, Any]]:
    matcher = difflib.SequenceMatcher(None, reference, recognized)
    results: list[dict[str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            results.extend({"word": word, "accuracy": 96, "errorType": "None", "phonemes": []} for word in reference[i1:i2])
        elif tag == "replace":
            replacements = recognized[j1:j2]
            for offset, word in enumerate(reference[i1:i2]):
                heard = replacements[offset] if offset < len(replacements) else ""
                score = round(difflib.SequenceMatcher(None, word, heard).ratio() * 72)
                results.append({"word": word, "accuracy": score, "errorType": "Mispronunciation", "phonemes": []})
        elif tag == "delete":
            results.extend({"word": word, "accuracy": 0, "errorType": "Omission", "phonemes": []} for word in reference[i1:i2])
    return results


def wav_metrics(path: Path, word_count: int, word_timings: list[tuple[float, float]]) -> tuple[float, float]:
    with wave.open(str(path), "rb") as source:
        frames = source.readframes(source.getnframes())
        rate = source.getframerate()
        channels = source.getnchannels()
        width = source.getsampwidth()
    if width != 2:
        return 50.0, 0.0
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    duration = max(len(samples) / max(rate, 1), .1)
    window = max(1, int(rate * .025))
    usable = samples[: len(samples) - (len(samples) % window)]
    if usable.size:
        rms = np.sqrt(np.mean(usable.reshape(-1, window) ** 2, axis=1))
        threshold = max(180.0, float(np.percentile(rms, 65)) * .16)
        silence_ratio = float(np.mean(rms < threshold))
    else:
        silence_ratio = 1.0
    wpm = word_count / duration * 60
    pace_penalty = max(0.0, 78 - wpm) * .45 + max(0.0, wpm - 190) * .28
    pause_penalty = max(0.0, silence_ratio - .3) * 80
    if len(word_timings) > 1:
        long_gaps = sum(1 for (_, end), (start, _) in zip(word_timings, word_timings[1:]) if start - end > .8)
        pause_penalty += min(20, long_gaps * 5)
    return max(0.0, min(100.0, 100 - pace_penalty - pause_penalty)), duration


def phoneme_score(path: Path, reference_text: str, locale: str) -> tuple[float | None, str | None, str | None]:
    if epitran is None or read_recognizer is None:
        return None, None, None
    epi_code = EPITRAN_LANGUAGE.get(locale)
    phone_code = ALLOSAURUS_LANGUAGE.get(locale)
    if not epi_code or not phone_code:
        return None, None, None
    try:
        expected = epitran.Epitran(epi_code).transliterate(reference_text)
        observed = phone_recognizer().recognize(str(path), lang_id=phone_code)
        expected_units = [unit for unit in re.split(r"\s+", expected.strip()) if unit]
        observed_units = [unit for unit in re.split(r"\s+", observed.strip()) if unit]
        if len(expected_units) <= 2:
            expected_units = list(expected.replace(" ", ""))
        score = similarity(expected_units, observed_units) * 100
        return round(score, 1), expected, observed
    except Exception:
        return None, None, None


def feedback(accuracy: float, fluency: float, completeness: float, phonemes_available: bool) -> str:
    weakest = min(("accuracy", accuracy), ("fluency", fluency), ("completeness", completeness), key=lambda item: item[1])[0]
    if weakest == "fluency":
        return "Keep the phrase in two or three smooth chunks and reduce the longest pauses."
    if weakest == "completeness":
        return "Repeat the full phrase and make the omitted words clearly audible."
    if phonemes_available:
        return "Repeat the lowest-scoring words slowly, then blend their sounds back into the full phrase."
    return "Slow down slightly and make each target word distinct; phoneme tooling is not available for this locale yet."


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ready",
        "whisperModel": os.getenv("WORLDLING_WHISPER_MODEL", "small"),
        "phonemeRecognizerInstalled": read_recognizer is not None,
        "g2pInstalled": epitran is not None,
    }


@app.post("/assess")
async def assess(
    audio: UploadFile = File(...),
    referenceText: str = Form(...),
    locale: str = Form("en-US"),
) -> dict[str, Any]:
    if not referenceText.strip():
        raise HTTPException(400, "Reference text is required.")
    payload = await audio.read()
    if not payload or len(payload) > 8 * 1024 * 1024:
        raise HTTPException(400, "Audio must be a non-empty WAV file under 8 MB.")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp:
            temp.write(payload)
            temp_path = Path(temp.name)

        segments, _ = whisper_model().transcribe(
            str(temp_path),
            language=WHISPER_LANGUAGE.get(locale),
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
        )
        segment_list = list(segments)
        recognized_text = " ".join(segment.text.strip() for segment in segment_list).strip()
        timings = [
            (word.start or 0.0, word.end or 0.0)
            for segment in segment_list
            for word in (segment.words or [])
        ]
        expected_words = normalized_words(referenceText)
        heard_words = normalized_words(recognized_text)
        text_accuracy = similarity(expected_words, heard_words) * 100
        matched = sum(block.size for block in difflib.SequenceMatcher(None, expected_words, heard_words).get_matching_blocks())
        completeness = min(100.0, matched / max(1, len(expected_words)) * 100)
        fluency, duration = wav_metrics(temp_path, len(heard_words), timings)
        phone_accuracy, expected_ipa, observed_ipa = phoneme_score(temp_path, referenceText, locale)
        accuracy = text_accuracy if phone_accuracy is None else phone_accuracy * .65 + text_accuracy * .35
        overall = accuracy * .55 + fluency * .25 + completeness * .2

        return {
            "provider": "local",
            "overall": round(overall),
            "accuracy": round(accuracy),
            "fluency": round(fluency),
            "completeness": round(completeness),
            "prosody": None,
            "recognizedText": recognized_text,
            "words": word_results(expected_words, heard_words),
            "feedback": feedback(accuracy, fluency, completeness, phone_accuracy is not None),
            "phonemeScoring": phone_accuracy is not None,
            "phonemeAccuracy": round(phone_accuracy) if phone_accuracy is not None else None,
            "expectedIpa": expected_ipa,
            "observedIpa": observed_ipa,
            "durationSeconds": round(duration, 2),
        }
    except wave.Error as error:
        raise HTTPException(400, f"Invalid WAV recording: {error}") from error
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
