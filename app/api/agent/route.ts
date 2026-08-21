type Provider = "local" | "api";

type AgentRequest = {
  action: "turn" | "evaluate";
  provider: Provider;
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

function systemPrompt(body: AgentRequest) {
  if (body.action === "evaluate") {
    return `You are a fair language-game evaluator. Evaluate whether the player communicated successfully in ${body.language} at ${body.level} level during a conversation in ${body.city}. The optional goal was: ${body.goal}. Reward communicative success and recovery. Do not punish a regional accent. Judge only evidence in the transcript. Return only valid JSON matching: ${evaluationShape}`;
  }
  return `You are ${body.character}, a ${body.role} at ${body.location} in ${body.city}, ${body.country}. Speak naturally in ${body.language}. The player is at ${body.level} level. Stay warmly in character, respond to anything appropriate they say, and end with at most one natural follow-up question. For beginners, keep language simple.
Connected mission: ${body.mission ?? "Street conversation"}.
Current objective: ${body.objective ?? body.goal ?? "Have a useful exchange"}.
World memory and inventory: ${(body.inventory ?? []).join(", ") || "none"}.
Learner focus words: ${(body.learnerMemory?.focusWords ?? []).join(", ") || "none"}.
Return only valid JSON: {"text":"reply in ${body.language}","translation":"concise English translation","actions":[{"tool":"remember_fact|give_item|complete_step|set_waypoint","value":"short value","reason":"short reason"}]}. Only use complete_step when the player's latest message meaningfully addresses the current objective. Do not grade or explain during the conversation.`;
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
        ...(body.messages ?? []).map((message) => ({ role: message.role === "npc" ? "assistant" : "user", content: message.content })),
        ...(body.action === "turn" && body.input ? [{ role: "user", content: body.input }] : []),
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Local model returned ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return extractJson(payload.choices?.[0]?.message?.content ?? "");
}

async function callOpenAI(body: AgentRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  if (!apiKey) throw new Error("API model is not configured on the server.");
  const transcript = (body.messages ?? []).map((message) => `${message.role}: ${message.content}`).join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: systemPrompt(body),
      input: body.action === "turn" ? `${transcript}\nuser: ${body.input ?? ""}` : transcript,
      max_output_tokens: 700,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`API model returned ${response.status}.`);
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  return extractJson(text);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AgentRequest;
    if (!body.action || !body.provider || !body.language || !body.city) {
      return Response.json({ error: "Missing required conversation fields." }, { status: 400 });
    }
    const result = body.provider === "local" ? await callLocal(body) : await callOpenAI(body);
    return body.action === "evaluate"
      ? Response.json({ evaluation: result })
      : Response.json({ ...result, source: body.provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model could not respond.";
    return Response.json({ error: message }, { status: 503 });
  }
}
