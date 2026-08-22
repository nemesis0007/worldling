type Provider = "local" | "api";
type ApiProvider = "groq" | "openai" | "openrouter" | "gemini";

type ApiConfig = {
  provider: ApiProvider;
  model: string;
  apiKey: string;
};

type AgentRequest = {
  action: "turn" | "evaluate" | "test";
  provider: Provider;
  apiConfig?: ApiConfig;
  city: string;
  country?: string;
  language: string;
  level: string;
  character?: string;
  role?: string;
  location?: string;
  goal?: string;
  mission?: string;
  objective?: string;
  inventory?: string[];
  learnerMemory?: { focusWords?: string[]; knownPhrases?: string[] };
  completedObjectives?: number;
  userTurnCount?: number;
  input?: string;
  messages?: Array<{ role: string; content: string }>;
};

const evaluationShape = `{
  "overall": number 0-100,
  "communication": number 0-100,
  "vocabulary": number 0-100,
  "grammar": number 0-100,
  "confidence": number 0-100,
  "strength": "one evidence-based sentence",
  "improvement": "one specific next step",
  "phrase": "one useful phrase in the target language"
}`;

function levelConversationPolicy(level: string) {
  if (level === "Advanced") return "Use idioms, implied meaning, varied sentence structures, and realistic local detail. Do not simplify unless asked. Keep the reply under 65 words and do not provide an English translation unless required by the JSON contract.";
  if (level === "Intermediate") return "Use connected sentences, everyday past and future forms, and occasional local expressions understandable from context. Keep the reply under 45 words.";
  return "Use common words, short sentences, and one clear idea at a time. Gently model a corrected phrase when useful. Keep the reply under 28 words.";
}

function systemPrompt(body: AgentRequest) {
  if (body.action === "test") {
    return `You are checking an API connection. Return only this JSON object: {"ok":true}`;
  }
  if (body.action === "evaluate") {
    return `You are a strict but encouraging language-game evaluator. Evaluate only the player's messages in ${body.language} at ${body.level} level during a conversation in ${body.city}. The optional goal was: ${body.goal}. The player took ${body.userTurnCount ?? "an unknown number of"} turns and completed ${body.completedObjectives ?? 0} objectives. Reward communicative success and recovery. Do not punish a regional accent.
Score each category independently from transcript evidence. A short greeting or one-line answer must not score above 65. Scores above 90 require several substantive player turns, varied vocabulary, successful objective completion, and consistently clear language. A score of 100 is reserved for exceptional, near-native, error-free performance across at least six substantive turns. Never give every category the same score. The overall score must be a weighted synthesis, not an average copied into every field. The strength and improvement must cite something the player actually did or could change. Return only valid JSON matching: ${evaluationShape}`;
  }
  return `You are ${body.character}, a ${body.role} at ${body.location} in ${body.city}, ${body.country}. Speak naturally in ${body.language}. The player is at ${body.level} level. ${levelConversationPolicy(body.level)} Stay warmly in character, respond directly to the newest player message, and end with at most one natural follow-up question. Treat short replies such as yes, no, maybe, or I am as answers to your immediately preceding question. Never repeat or closely paraphrase your previous reply.
Connected mission: ${body.mission ?? "Street conversation"}.
Current objective: ${body.objective ?? body.goal ?? "Have a useful exchange"}.
World memory and inventory: ${(body.inventory ?? []).join(", ") || "none"}.
Learner focus words: ${(body.learnerMemory?.focusWords ?? []).join(", ") || "none"}.
Return only valid JSON: {"text":"reply in ${body.language}","translation":"concise English translation","actions":[{"tool":"remember_fact|give_item|complete_step|set_waypoint","value":"short value","reason":"short reason"}]}. Only use complete_step when the player's latest message meaningfully addresses the current objective. Do not grade or explain during the conversation.`;
}

function conversationMessages(body: AgentRequest) {
  const messages = (body.messages ?? []).map((message) => ({
    role: message.role === "npc" ? "assistant" : message.role,
    content: message.content,
  }));
  const last = messages.at(-1);
  if (body.action === "turn" && body.input && !(last?.role === "user" && last.content.trim() === body.input.trim())) {
    messages.push({ role: "user", content: body.input });
  }
  return messages;
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

async function callLocal(body: AgentRequest) {
  const base = process.env.LOCAL_AI_BASE_URL;
  const model = process.env.LOCAL_AI_MODEL;
  if (!base || !model) throw new Error("Local model is not configured on the server.");
  const endpoint = `${base.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: body.action === "turn" ? 0.8 : 0.2,
      messages: [
        { role: "system", content: systemPrompt(body) },
        ...conversationMessages(body),
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Local model returned ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return extractJson(payload.choices?.[0]?.message?.content ?? "");
}

const openAICompatibleEndpoints: Record<Exclude<ApiProvider, "gemini">, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

function validApiConfig(value: ApiConfig | undefined): value is ApiConfig {
  return Boolean(
    value
    && ["groq", "openai", "openrouter", "gemini"].includes(value.provider)
    && typeof value.model === "string"
    && value.model.trim().length > 0
    && value.model.length <= 160
    && typeof value.apiKey === "string"
    && value.apiKey.trim().length >= 8
    && value.apiKey.length <= 512,
  );
}

function resolveApiConfig(body: AgentRequest): ApiConfig {
  if (validApiConfig(body.apiConfig)) {
    return {
      provider: body.apiConfig.provider,
      model: body.apiConfig.model.trim(),
      apiKey: body.apiConfig.apiKey.trim(),
    };
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Enter and test a personal API key in Model Router.");
  return { provider: "openai", model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini", apiKey };
}

async function callOpenAICompatible(body: AgentRequest, config: ApiConfig) {
  if (config.provider === "gemini") throw new Error("Invalid OpenAI-compatible provider.");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://worldling.vercel.app";
    headers["X-Title"] = "Worldling";
  }
  const response = await fetch(openAICompatibleEndpoints[config.provider], {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: body.action === "turn" ? 0.75 : 0.15,
      max_tokens: body.action === "test" ? 24 : 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(body) },
        ...(body.action === "test" ? [{ role: "user", content: "Confirm the connection." }] : conversationMessages(body)),
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${config.provider} returned ${response.status}${detail ? `: ${detail.slice(0, 220)}` : ""}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return extractJson(payload.choices?.[0]?.message?.content ?? "");
}

async function callGemini(body: AgentRequest, config: ApiConfig) {
  const model = config.model.replace(/^models\//, "");
  const contents = body.action === "test"
    ? [{ role: "user", parts: [{ text: "Confirm the connection." }] }]
    : conversationMessages(body).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(body) }] },
      contents,
      generationConfig: {
        temperature: body.action === "turn" ? 0.75 : 0.15,
        maxOutputTokens: body.action === "test" ? 24 : 700,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`gemini returned ${response.status}${detail ? `: ${detail.slice(0, 220)}` : ""}`);
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return extractJson(text);
}

async function callHostedApi(body: AgentRequest) {
  const config = resolveApiConfig(body);
  const result = config.provider === "gemini"
    ? await callGemini(body, config)
    : await callOpenAICompatible(body, config);
  return { result, config };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AgentRequest;
    if (body.action === "test") {
      const { result, config } = await callHostedApi(body);
      return Response.json({ ok: Boolean((result as { ok?: boolean }).ok), provider: config.provider, model: config.model });
    }
    if (!body.action || !body.provider || !body.language || !body.city) {
      return Response.json({ error: "Missing required conversation fields." }, { status: 400 });
    }
    const hosted = body.provider === "api" ? await callHostedApi(body) : null;
    const result = hosted ? hosted.result : await callLocal(body);
    return body.action === "evaluate"
      ? Response.json({ evaluation: result })
      : Response.json({ ...result, source: hosted ? `${hosted.config.provider}:${hosted.config.model}` : body.provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model could not respond.";
    return Response.json({ error: message }, { status: 503 });
  }
}
