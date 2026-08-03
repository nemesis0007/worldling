"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Provider = "demo" | "local" | "api";
type Level = "Beginner" | "Intermediate" | "Advanced";
type Role = "npc" | "user" | "system";

type Message = {
  id: number;
  role: Role;
  text: string;
  translation?: string;
  viaVoice?: boolean;
};

type Scene = {
  id: string;
  label: string;
  icon: string;
  character: string;
  role: string;
  avatar: string;
  goal: string;
};

type City = {
  id: string;
  name: string;
  country: string;
  language: string;
  nativeLanguage: string;
  locale: string;
  flag: string;
  coordinates: string;
  verified: boolean;
  greeting: string;
  translation: string;
  sceneClass: string;
  scenes: Scene[];
};

type Evaluation = {
  overall: number;
  communication: number;
  vocabulary: number;
  grammar: number;
  confidence: number;
  strength: string;
  improvement: string;
  phrase: string;
};

const CITIES: City[] = [
  {
    id: "bengaluru",
    name: "Bengaluru",
    country: "India",
    language: "Kannada",
    nativeLanguage: "ಕನ್ನಡ",
    locale: "kn-IN",
    flag: "🇮🇳",
    coordinates: "12.97° N · 77.59° E",
    verified: true,
    greeting: "ನಮಸ್ಕಾರ! ಬೆಂಗಳೂರಿಗೆ ಸ್ವಾಗತ. ಇಂದು ಹೇಗಿದ್ದೀರಿ?",
    translation: "Hello! Welcome to Bengaluru. How are you today?",
    sceneClass: "bengaluru",
    scenes: [
      { id: "darshini", label: "Darshini café", icon: "☕", character: "Ananya", role: "Café regular", avatar: "👩🏽", goal: "Have a friendly chat and ask for a local recommendation." },
      { id: "auto", label: "Auto stand", icon: "🛺", character: "Ravi", role: "Auto driver", avatar: "👨🏾", goal: "Explain where you want to go and ask about the fare." },
      { id: "market", label: "KR Market", icon: "🌼", character: "Meera", role: "Flower seller", avatar: "👩🏾", goal: "Ask about the flowers, price, or life in the market." },
    ],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    language: "Japanese",
    nativeLanguage: "日本語",
    locale: "ja-JP",
    flag: "🇯🇵",
    coordinates: "35.68° N · 139.65° E",
    verified: true,
    greeting: "こんにちは！東京へようこそ。今日は何をしてみたいですか？",
    translation: "Hello! Welcome to Tokyo. What would you like to do today?",
    sceneClass: "tokyo",
    scenes: [
      { id: "station", label: "Shibuya station", icon: "🚉", character: "Aiko", role: "University student", avatar: "👩🏻", goal: "Ask for directions and keep the conversation going." },
      { id: "ramen", label: "Ramen counter", icon: "🍜", character: "Ren", role: "Ramen chef", avatar: "👨🏻", goal: "Order naturally and ask the chef a question." },
      { id: "park", label: "Ueno park", icon: "🌳", character: "Emi", role: "Local photographer", avatar: "🧑🏻", goal: "Talk about the park, weather, or photography." },
    ],
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    language: "French",
    nativeLanguage: "Français",
    locale: "fr-FR",
    flag: "🇫🇷",
    coordinates: "48.86° N · 2.35° E",
    verified: false,
    greeting: "Bonjour et bienvenue à Paris ! Qu’est-ce qui vous amène ici ?",
    translation: "Hello and welcome to Paris! What brings you here?",
    sceneClass: "paris",
    scenes: [
      { id: "cafe", label: "Corner café", icon: "🥐", character: "Camille", role: "Café owner", avatar: "👩🏼", goal: "Start a natural conversation and ask for a recommendation." },
      { id: "books", label: "Seine bookseller", icon: "📚", character: "Luc", role: "Bookseller", avatar: "👨🏼", goal: "Describe what you enjoy reading and ask a follow-up." },
      { id: "market", label: "Street market", icon: "🍓", character: "Amélie", role: "Market vendor", avatar: "🧑🏼", goal: "Ask about local produce, prices, or the neighbourhood." },
    ],
  },
];

const PROMPTS: Record<string, string[]> = {
  bengaluru: ["ನಿಮ್ಮ ಹೆಸರು ಏನು?", "ಇಲ್ಲಿ ಒಳ್ಳೆಯ ಊಟ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ?", "ಇಂದಿನ ಹವಾಮಾನ ಹೇಗಿದೆ?"],
  tokyo: ["お名前は何ですか？", "おすすめの食べ物は何ですか？", "駅はどこですか？"],
  paris: ["Comment vous appelez-vous ?", "Qu’est-ce que vous recommandez ?", "Vous aimez vivre à Paris ?"],
};

const providerLabels: Record<Provider, string> = {
  demo: "Demo brain",
  local: "Local model",
  api: "API model",
};

function cityWelcome(city: City, level: Level): Message {
  return {
    id: Date.now(),
    role: "npc",
    text: city.greeting,
    translation: level === "Advanced" ? undefined : city.translation,
  };
}

function demoReply(city: City, scene: Scene, input: string, level: Level): { text: string; translation: string } {
  const lowered = input.toLocaleLowerCase();
  const asksName = /name|ಹೆಸರು|名前|appelle/.test(lowered);
  const asksFood = /food|eat|restaurant|ಊಟ|ತಿಂಡಿ|食|ラーメン|manger|recommand/.test(lowered);
  const asksDirection = /where|direction|go|ಎಲ್ಲಿ|ಹೋಗ|どこ|駅|où|aller/.test(lowered);
  const thanks = /thank|ಧನ್ಯವಾದ|ありがとう|merci/.test(lowered);

  const replies: Record<string, Array<{ text: string; translation: string }>> = {
    bengaluru: asksName
      ? [{ text: `ನನ್ನ ಹೆಸರು ${scene.character}. ನಿಮ್ಮ ಹೆಸರು ಏನು?`, translation: `My name is ${scene.character}. What is your name?` }]
      : asksFood
        ? [{ text: "ಇಲ್ಲಿ ಮಸಾಲೆ ದೋಸೆ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ. ನಿಮಗೆ ಖಾರ ಇಷ್ಟವೇ?", translation: "The masala dosa is very good here. Do you like spicy food?" }]
        : asksDirection
          ? [{ text: "ನೇರವಾಗಿ ಹೋಗಿ, ಎರಡನೇ ಬಲ ತಿರುಗಿ. ನೀವು ಒಬ್ಬರೇ ಹೋಗುತ್ತಿದ್ದೀರಾ?", translation: "Go straight and take the second right. Are you going alone?" }]
          : thanks
            ? [{ text: "ಪರವಾಗಿಲ್ಲ! ಇನ್ನೇನಾದರೂ ಸಹಾಯ ಬೇಕೇ?", translation: "You’re welcome! Do you need any other help?" }]
            : [{ text: "ಚೆನ್ನಾಗಿದೆ! ಅದರ ಬಗ್ಗೆ ಇನ್ನಷ್ಟು ಹೇಳಿ. ನೀವು ಬೆಂಗಳೂರಿಗೆ ಮೊದಲ ಬಾರಿ ಬಂದಿದ್ದೀರಾ?", translation: "Nice! Tell me more about that. Is this your first time in Bengaluru?" }],
    tokyo: asksName
      ? [{ text: `私は${scene.character}です。あなたのお名前は？`, translation: `I’m ${scene.character}. What is your name?` }]
      : asksFood
        ? [{ text: "この近くのラーメンがおすすめです。辛いものは好きですか？", translation: "I recommend the ramen nearby. Do you like spicy food?" }]
        : asksDirection
          ? [{ text: "駅はこの道をまっすぐ行って右です。どこまで行きますか？", translation: "The station is straight ahead and to the right. Where are you going?" }]
          : thanks
            ? [{ text: "どういたしまして！ほかに聞きたいことはありますか？", translation: "You’re welcome! Is there anything else you want to ask?" }]
            : [{ text: "面白いですね。もう少し詳しく教えてください。東京は初めてですか？", translation: "That’s interesting. Tell me a little more. Is this your first time in Tokyo?" }],
    paris: asksName
      ? [{ text: `Je m’appelle ${scene.character}. Et vous, comment vous appelez-vous ?`, translation: `My name is ${scene.character}. And what is your name?` }]
      : asksFood
        ? [{ text: "Je vous recommande la tarte du jour. Vous préférez le sucré ou le salé ?", translation: "I recommend today’s tart. Do you prefer sweet or savoury?" }]
        : asksDirection
          ? [{ text: "Continuez tout droit, puis tournez à gauche. Vous cherchez un endroit précis ?", translation: "Continue straight, then turn left. Are you looking for somewhere specific?" }]
          : thanks
            ? [{ text: "Avec plaisir ! Vous voulez savoir autre chose ?", translation: "My pleasure! Would you like to know anything else?" }]
            : [{ text: "C’est intéressant ! Racontez-moi un peu plus. C’est votre première fois à Paris ?", translation: "That’s interesting! Tell me a little more. Is this your first time in Paris?" }],
  };

  const reply = replies[city.id][0];
  return level === "Beginner" ? reply : { ...reply, translation: level === "Advanced" ? "" : reply.translation };
}

function demoEvaluation(messages: Message[], city: City, level: Level): Evaluation {
  const userMessages = messages.filter((message) => message.role === "user");
  const words = userMessages.flatMap((message) => message.text.trim().split(/\s+/).filter(Boolean));
  const unique = new Set(words.map((word) => word.toLocaleLowerCase())).size;
  const voiceTurns = userMessages.filter((message) => message.viaVoice).length;
  const levelPenalty = level === "Advanced" ? 8 : level === "Intermediate" ? 3 : 0;
  const communication = Math.min(96, 56 + userMessages.length * 9 + Math.min(words.length, 18)) - levelPenalty;
  const vocabulary = Math.min(94, 48 + unique * 3) - levelPenalty;
  const grammar = Math.min(91, 60 + Math.min(userMessages.length * 5, 20)) - levelPenalty;
  const confidence = Math.min(96, 62 + voiceTurns * 9 + userMessages.length * 4);
  const overall = Math.max(50, Math.round((communication + vocabulary + grammar + confidence) / 4));
  return {
    overall,
    communication,
    vocabulary,
    grammar,
    confidence,
    strength: userMessages.length >= 2 ? "You kept the exchange moving and responded to follow-up questions." : "Your meaning was clear enough for the character to respond.",
    improvement: words.length < 12 ? "Try adding one detail and one follow-up question in your next attempt." : `Use a more natural connector in ${city.language} instead of pausing between ideas.`,
    phrase: PROMPTS[city.id][1],
  };
}

export default function Home() {
  const [cityId, setCityId] = useState("bengaluru");
  const [sceneId, setSceneId] = useState("darshini");
  const [provider, setProvider] = useState<Provider>("demo");
  const [level, setLevel] = useState<Level>("Beginner");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [engineNote, setEngineNote] = useState("Ready · no account or key required");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [showEngine, setShowEngine] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const messageId = useRef(1);

  const city = useMemo(() => CITIES.find((item) => item.id === cityId) ?? CITIES[0], [cityId]);
  const scene = useMemo(() => city.scenes.find((item) => item.id === sceneId) ?? city.scenes[0], [city, sceneId]);
  const userTurns = messages.filter((message) => message.role === "user").length;

  useEffect(() => {
    const saved = window.localStorage.getItem("worldling-provider") as Provider | null;
    if (saved && ["demo", "local", "api"].includes(saved)) setProvider(saved);
  }, []);

  useEffect(() => {
    setMessages([cityWelcome(city, level)]);
    setEvaluation(null);
    setInput("");
    setEngineNote(provider === "demo" ? "Ready · no account or key required" : `${providerLabels[provider]} selected · server connection checked on first message`);
  }, [city, scene, level, provider]);

  useEffect(() => {
    window.localStorage.setItem("worldling-provider", provider);
  }, [provider]);

  function speak(text: string) {
    if (!autoSpeak || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = city.locale;
    utterance.rate = level === "Beginner" ? 0.82 : level === "Advanced" ? 1.05 : 0.94;
    window.speechSynthesis.speak(utterance);
  }

  async function askProvider(text: string, nextMessages: Message[]) {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "turn",
        provider,
        city: city.name,
        country: city.country,
        language: city.language,
        level,
        character: scene.character,
        role: scene.role,
        location: scene.label,
        goal: scene.goal,
        input: text,
        messages: nextMessages.slice(-8).map(({ role, text: content }) => ({ role, content })),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { text: string; translation?: string; source?: string };
  }

  async function submitText(text: string, viaVoice = false) {
    const clean = text.trim();
    if (!clean || thinking) return;
    const userMessage: Message = { id: messageId.current++, role: "user", text: clean, viaVoice };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    setEngineNote(provider === "demo" ? "NPC considered intent · selected a follow-up" : `Contacting ${providerLabels[provider]}…`);

    let reply: { text: string; translation?: string };
    try {
      if (provider === "demo") {
        await new Promise((resolve) => window.setTimeout(resolve, 520));
        reply = demoReply(city, scene, clean, level);
        setEngineNote("Intent read · conversation memory updated · follow-up chosen");
      } else {
        reply = await askProvider(clean, nextMessages);
        setEngineNote(`${providerLabels[provider]} responded · memory updated`);
      }
    } catch {
      reply = demoReply(city, scene, clean, level);
      setEngineNote(`${providerLabels[provider]} unavailable · demo fallback kept the conversation alive`);
    }

    const npcMessage: Message = {
      id: messageId.current++,
      role: "npc",
      text: reply.text,
      translation: level === "Advanced" ? undefined : reply.translation,
    };
    setMessages((current) => [...current, npcMessage]);
    setThinking(false);
    speak(reply.text);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitText(input);
  }

  function startListening() {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setEngineNote("Voice recognition is not available in this browser · type your reply below");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = city.locale;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setEngineNote("I couldn’t hear that clearly · try again or type your reply");
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setInput(transcript);
      void submitText(transcript, true);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function finishConversation() {
    if (userTurns === 0) {
      setEngineNote("Say or type at least one reply before grading the conversation");
      return;
    }
    setThinking(true);
    setEngineNote("Evaluator is reviewing meaning, range, and confidence…");
    let result = demoEvaluation(messages, city, level);
    if (provider !== "demo") {
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "evaluate",
            provider,
            city: city.name,
            language: city.language,
            level,
            goal: scene.goal,
            messages: messages.map(({ role, text: content }) => ({ role, content })),
          }),
        });
        if (!response.ok) throw new Error("evaluation failed");
        result = (await response.json()).evaluation as Evaluation;
        setEngineNote(`${providerLabels[provider]} completed a level-aware evaluation`);
      } catch {
        setEngineNote(`${providerLabels[provider]} unavailable · transparent demo rubric used`);
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setEngineNote("Demo rubric complete · no audio was stored");
    }
    setEvaluation(result);
    setThinking(false);
  }

  function chooseCity(nextCity: City) {
    setCityId(nextCity.id);
    setSceneId(nextCity.scenes[0].id);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#world" aria-label="Worldling home">
          <span className="brand-mark">W</span>
          <span>worldling</span>
          <small>voice travel lab</small>
        </a>
        <div className="top-actions">
          <div className="level-control" aria-label="Difficulty level">
            {(["Beginner", "Intermediate", "Advanced"] as Level[]).map((option) => (
              <button key={option} className={level === option ? "active" : ""} onClick={() => setLevel(option)}>{option}</button>
            ))}
          </div>
          <button className="engine-button" onClick={() => setShowEngine(true)}>
            <span className={`status-dot ${provider}`} />
            {providerLabels[provider]}
            <span aria-hidden="true">⌄</span>
          </button>
        </div>
      </header>

      <section className="experience-grid">
        <aside className="world-panel" id="world">
          <div className="section-kicker"><span>01</span> Choose your corner of Earth</div>
          <h1>The world is<br />waiting to talk.</h1>
          <p className="intro">Drop into a local scene. Say anything. Your AI character listens, adapts, and remembers.</p>

          <div className="world-map" aria-label="Available destinations">
            <div className="map-grid" />
            <div className="land land-one" />
            <div className="land land-two" />
            <div className="land land-three" />
            {CITIES.map((item) => (
              <button
                key={item.id}
                className={`map-pin pin-${item.id} ${item.id === city.id ? "selected" : ""}`}
                onClick={() => chooseCity(item)}
                aria-label={`Visit ${item.name}`}
              >
                <span>{item.flag}</span>
                <strong>{item.name}</strong>
              </button>
            ))}
            <div className="map-caption">3 cities live · a world-shaped system</div>
          </div>

          <div className="city-list">
            {CITIES.map((item) => (
              <button key={item.id} className={item.id === city.id ? "city-card active" : "city-card"} onClick={() => chooseCity(item)}>
                <span className="city-flag">{item.flag}</span>
                <span><strong>{item.name}</strong><small>{item.country} · {item.nativeLanguage}</small></span>
                <span className={item.verified ? "verified" : "beta"}>{item.verified ? "Verified" : "Beta"}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={`scene-panel scene-${city.sceneClass}`}>
          <div className="scene-heading">
            <div>
              <div className="section-kicker light"><span>02</span> Step into the scene</div>
              <h2>{city.name}</h2>
              <p>{city.coordinates} · Speaking {city.language}</p>
            </div>
            <div className="weather"><span>26°</span><small>LOCAL TIME<br />08:42</small></div>
          </div>

          <div className="scene-tabs" role="tablist" aria-label={`${city.name} locations`}>
            {city.scenes.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={scene.id === item.id}
                className={scene.id === item.id ? "active" : ""}
                onClick={() => setSceneId(item.id)}
              >
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>

          <div className="scenery" aria-label={`Stylised local scene: ${scene.label}`}>
            <div className="sun" />
            <div className="cloud cloud-one" />
            <div className="cloud cloud-two" />
            <div className="skyline skyline-one" />
            <div className="skyline skyline-two" />
            <div className="awning"><span>{scene.label}</span></div>
            <div className="street-line" />
            <div className="plant"><span>✦</span></div>
            <div className="character-card">
              <div className="avatar" aria-hidden="true">{scene.avatar}</div>
              <div><strong>{scene.character}</strong><span>{scene.role}</span></div>
              <span className="online">ready</span>
            </div>
            <div className="scene-stamp">LIVE SCENE<br /><strong>{city.flag} {city.name.toUpperCase()}</strong></div>
          </div>

          <div className="mission-strip">
            <span className="mission-icon">◎</span>
            <div><small>OPTIONAL CONVERSATION GOAL</small><strong>{scene.goal}</strong></div>
            <span className="free-badge">Say anything</span>
          </div>
        </section>

        <section className="conversation-panel">
          <div className="conversation-head">
            <div>
              <div className="section-kicker"><span>03</span> Join the conversation</div>
              <h2>Talk with {scene.character}</h2>
            </div>
            <label className="audio-toggle">
              <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
              <span>Voice replies</span>
            </label>
          </div>

          <div className="messages" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <span className="speaker">{message.role === "npc" ? scene.avatar : message.viaVoice ? "◉" : "You"}</span>
                <div>
                  <p>{message.text}</p>
                  {message.translation && <small>{message.translation}</small>}
                </div>
              </article>
            ))}
            {thinking && (
              <article className="message npc thinking"><span className="speaker">{scene.avatar}</span><div><i /><i /><i /></div></article>
            )}
          </div>

          <div className="prompt-chips">
            {PROMPTS[city.id].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <button
              type="button"
              className={listening ? "mic listening" : "mic"}
              onClick={() => listening ? recognitionRef.current?.stop() : startListening()}
              aria-label={listening ? "Stop listening" : `Speak in ${city.language}`}
            >
              <span className="mic-icon">●</span>
              <span>{listening ? "Listening…" : "Tap to speak"}</span>
            </button>
            <div className="text-entry">
              <label htmlFor="reply">Or type your reply</label>
              <div><input id="reply" value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Say something in ${city.language}…`} /><button type="submit" disabled={!input.trim() || thinking}>↑</button></div>
            </div>
          </form>

          <div className="agent-trace">
            <span className={`trace-pulse ${thinking ? "busy" : ""}`} />
            <p>{engineNote}</p>
            <button onClick={() => setShowEngine(true)}>Engine</button>
          </div>

          <button className="grade-button" disabled={thinking} onClick={() => void finishConversation()}>
            <span>Finish & grade conversation</span><strong>{userTurns} turn{userTurns === 1 ? "" : "s"} ↗</strong>
          </button>
        </section>
      </section>

      <footer>
        <p><strong>WORLDLING / PROTOTYPE 01</strong> · Voice stays on this device in demo mode.</p>
        <p>Designed for communication, not perfect accents.</p>
      </footer>

      {evaluation && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEvaluation(null)}>
          <section className="score-card" role="dialog" aria-modal="true" aria-labelledby="score-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setEvaluation(null)} aria-label="Close score">×</button>
            <div className="score-top">
              <div className="score-ring"><strong>{evaluation.overall}</strong><span>/100</span></div>
              <div><span className="score-kicker">CONVERSATION COMPLETE</span><h2 id="score-title">You were understood.</h2><p>{city.name} · {city.language} · {level}</p></div>
            </div>
            <div className="score-bars">
              {(["communication", "vocabulary", "grammar", "confidence"] as const).map((key) => (
                <div key={key}><span>{key}</span><i><b style={{ width: `${evaluation[key]}%` }} /></i><strong>{evaluation[key]}</strong></div>
              ))}
            </div>
            <div className="feedback-grid">
              <article><span>✓ WHAT WORKED</span><p>{evaluation.strength}</p></article>
              <article><span>↗ TRY NEXT</span><p>{evaluation.improvement}</p></article>
            </div>
            <div className="takeaway"><span>Phrase to keep</span><strong>{evaluation.phrase}</strong></div>
            <button className="replay-button" onClick={() => { setMessages([cityWelcome(city, level)]); setEvaluation(null); }}>Try this scene again</button>
          </section>
        </div>
      )}

      {showEngine && (
        <div className="modal-backdrop engine-backdrop" role="presentation" onClick={() => setShowEngine(false)}>
          <section className="engine-sheet" role="dialog" aria-modal="true" aria-labelledby="engine-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setShowEngine(false)} aria-label="Close engine settings">×</button>
            <span className="score-kicker">MODEL ROUTER</span>
            <h2 id="engine-title">Choose the brain.</h2>
            <p className="engine-intro">The game uses one provider contract, so you can test cheaply and switch models without rebuilding the world.</p>
            <div className="provider-options">
              {(["demo", "local", "api"] as Provider[]).map((option) => (
                <button key={option} className={provider === option ? "active" : ""} onClick={() => setProvider(option)}>
                  <span className={`provider-icon ${option}`}>{option === "demo" ? "◎" : option === "local" ? "⌂" : "✦"}</span>
                  <span><strong>{providerLabels[option]}</strong><small>{option === "demo" ? "Built in · free · always works" : option === "local" ? "Ollama / LM Studio · keyless" : "Hosted model · best quality"}</small></span>
                  <i>{provider === option ? "Selected" : "Choose"}</i>
                </button>
              ))}
            </div>
            <div className="engine-flow">
              <div><span>1</span><p><strong>Listen</strong>Browser speech recognition</p></div>
              <b>→</b>
              <div><span>2</span><p><strong>Act</strong>NPC + memory + scene goal</p></div>
              <b>→</b>
              <div><span>3</span><p><strong>Judge</strong>Level-aware rubric</p></div>
            </div>
            <div className="config-note">
              <strong>{provider === "local" ? "Local setup" : provider === "api" ? "API setup" : "Demo setup"}</strong>
              <p>{provider === "local" ? "Run an OpenAI-compatible local server and set LOCAL_AI_BASE_URL plus LOCAL_AI_MODEL. The server keeps the endpoint private." : provider === "api" ? "Set OPENAI_API_KEY and OPENAI_MODEL on the server. Keys are never requested by or exposed to the browser." : "No setup. Responses and scores use transparent prototype rules so every interaction is testable."}</p>
            </div>
            <button className="sheet-done" onClick={() => setShowEngine(false)}>Continue with {providerLabels[provider]}</button>
          </section>
        </div>
      )}
    </main>
  );
}
