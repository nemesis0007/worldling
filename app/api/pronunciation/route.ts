type AzureWord = {
  Word?: string;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
  Phonemes?: Array<{ Phoneme?: string; PronunciationAssessment?: { AccuracyScore?: number } }>;
};

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function feedbackFor(scores: { accuracy: number; fluency: number; completeness: number }) {
  const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0]?.[0];
  if (weakest === "accuracy") return "Slow down and shape each highlighted sound before joining the words together.";
  if (weakest === "fluency") return "Repeat the phrase in short groups, then connect them with fewer long pauses.";
  return "Read the whole phrase once more and make every word audible.";
}

export async function POST(request: Request) {
  try {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      return Response.json({ error: "Azure pronunciation assessment is not configured." }, { status: 503 });
    }

    const form = await request.formData();
    const audio = form.get("audio");
    const referenceText = String(form.get("referenceText") ?? "").trim();
    const locale = String(form.get("locale") ?? "en-US").trim();
    if (!(audio instanceof File) || !referenceText) {
      return Response.json({ error: "Audio and reference text are required." }, { status: 400 });
    }
    if (audio.size > 8 * 1024 * 1024) {
      return Response.json({ error: "Pronunciation recordings must be under 8 MB." }, { status: 413 });
    }

    const config = {
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      ...(locale === "en-US" ? { EnableProsodyAssessment: true } : {}),
    };
    const endpoint = `https://${encodeURIComponent(region)}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Pronunciation-Assessment": encodeBase64(JSON.stringify(config)),
        Accept: "application/json",
      },
      body: await audio.arrayBuffer(),
      signal: AbortSignal.timeout(30000),
    });

    const payload = await response.json() as {
      RecognitionStatus?: string;
      DisplayText?: string;
      NBest?: Array<{
        Display?: string;
        Lexical?: string;
        PronunciationAssessment?: {
          AccuracyScore?: number;
          FluencyScore?: number;
          CompletenessScore?: number;
          ProsodyScore?: number;
          PronScore?: number;
        };
        Words?: AzureWord[];
      }>;
      Message?: string;
    };
    if (!response.ok || !payload.NBest?.[0]) {
      throw new Error(payload.Message || `Azure Speech returned ${response.status}.`);
    }

    const best = payload.NBest[0];
    const assessment = best.PronunciationAssessment ?? {};
    const accuracy = Math.round(assessment.AccuracyScore ?? 0);
    const fluency = Math.round(assessment.FluencyScore ?? 0);
    const completeness = Math.round(assessment.CompletenessScore ?? 0);
    const overall = Math.round(assessment.PronScore ?? (accuracy * .55 + fluency * .25 + completeness * .2));
    const words = (best.Words ?? []).map((word) => ({
      word: word.Word ?? "",
      accuracy: Math.round(word.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: word.PronunciationAssessment?.ErrorType ?? "None",
      phonemes: (word.Phonemes ?? []).map((phoneme) => ({
        phoneme: phoneme.Phoneme ?? "",
        accuracy: Math.round(phoneme.PronunciationAssessment?.AccuracyScore ?? 0),
      })),
    }));

    return Response.json({
      provider: "azure",
      overall,
      accuracy,
      fluency,
      completeness,
      prosody: typeof assessment.ProsodyScore === "number" ? Math.round(assessment.ProsodyScore) : null,
      recognizedText: best.Display ?? best.Lexical ?? payload.DisplayText ?? "",
      words,
      feedback: feedbackFor({ accuracy, fluency, completeness }),
      phonemeScoring: words.some((word) => word.phonemes.length > 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pronunciation assessment failed.";
    return Response.json({ error: message }, { status: 503 });
  }
}
