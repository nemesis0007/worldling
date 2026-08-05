"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, useEffect, useMemo, useRef, useState } from "react";

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
  mapX: number;
  mapY: number;
  rank?: number;
  india?: boolean;
  prompts: string[];
  demoText: string;
  demoTranslation: string;
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

type LocalStatus = "idle" | "checking" | "connected" | "error";

type Reward = {
  xp: number;
  coins: number;
  newStamp: boolean;
};

const questGoals = [
  "Greet a local, introduce yourself, and ask one natural follow-up question.",
  "Complete a useful everyday exchange and confirm one important detail.",
  "Ask for a local recommendation and respond to the character’s suggestion.",
];

function localScenes(labels: [string, string, string], characters: [string, string, string], avatars: [string, string, string]): Scene[] {
  return labels.map((label, index) => ({
    id: `scene-${index + 1}`,
    label,
    icon: ["◆", "◉", "✦"][index],
    character: characters[index],
    role: ["Local guide", "Neighbourhood regular", "Market host"][index],
    avatar: avatars[index],
    goal: questGoals[index],
  }));
}

const CITIES: City[] = [
  {
    id: "new-york", name: "New York", country: "United States", language: "English", nativeLanguage: "English", locale: "en-US", flag: "🇺🇸",
    coordinates: "40.71° N · 74.01° W", verified: true, sceneClass: "atlantic", mapX: 29.4, mapY: 27.4, rank: 1,
    greeting: "Hey! Welcome to New York. What brings you to the city?", translation: "A friendly local welcome.",
    prompts: ["What do you recommend nearby?", "How do I get to the subway?", "What do locals do on weekends?"],
    demoText: "You’re doing great. There’s a brilliant little place around the corner—what kind of experience are you looking for?", demoTranslation: "The local understood you and asked a follow-up question.",
    scenes: localScenes(["Brooklyn deli", "Subway platform", "Central Park"], ["Maya", "Theo", "Jordan"], ["👩🏽", "👨🏿", "🧑🏻"]),
  },
  {
    id: "beijing", name: "Beijing", country: "China", language: "Mandarin Chinese", nativeLanguage: "普通话", locale: "zh-CN", flag: "🇨🇳",
    coordinates: "39.90° N · 116.41° E", verified: true, sceneClass: "east", mapX: 82.3, mapY: 27.8, rank: 2,
    greeting: "你好！欢迎来到北京。你今天想去哪里？", translation: "Hello! Welcome to Beijing. Where would you like to go today?",
    prompts: ["你叫什么名字？", "附近有什么好吃的？", "地铁站怎么走？"], demoText: "说得很好！附近有一家很受欢迎的小店。你喜欢吃辣的吗？", demoTranslation: "Very good! There is a popular little restaurant nearby. Do you like spicy food?",
    scenes: localScenes(["Hutong tea house", "Metro entrance", "Morning market"], ["Xiaoyu", "Wei", "Lin"], ["👩🏻", "👨🏻", "🧑🏻"]),
  },
  {
    id: "delhi", name: "Delhi", country: "India", language: "Hindi", nativeLanguage: "हिन्दी", locale: "hi-IN", flag: "🇮🇳",
    coordinates: "28.61° N · 77.21° E", verified: true, sceneClass: "india", mapX: 71.4, mapY: 34.1, rank: 3, india: true,
    greeting: "नमस्ते! दिल्ली में आपका स्वागत है। आज आप कहाँ जाना चाहते हैं?", translation: "Hello! Welcome to Delhi. Where would you like to go today?",
    prompts: ["आपका नाम क्या है?", "यहाँ अच्छा खाना कहाँ मिलेगा?", "मेट्रो स्टेशन कितनी दूर है?"], demoText: "बहुत बढ़िया! पास में एक मशहूर जगह है। आपको मसालेदार खाना पसंद है?", demoTranslation: "Very good! There is a famous place nearby. Do you like spicy food?",
    scenes: localScenes(["Chai stall", "Metro concourse", "Chandni Chowk"], ["Aarav", "Naina", "Kabir"], ["👨🏽", "👩🏽", "🧑🏽"]),
  },
  {
    id: "madrid", name: "Madrid", country: "Spain", language: "Spanish", nativeLanguage: "Español", locale: "es-ES", flag: "🇪🇸",
    coordinates: "40.42° N · 3.70° W", verified: true, sceneClass: "europe", mapX: 49, mapY: 27.5, rank: 4,
    greeting: "¡Hola! Bienvenido a Madrid. ¿Qué te gustaría hacer hoy?", translation: "Hello! Welcome to Madrid. What would you like to do today?",
    prompts: ["¿Cómo te llamas?", "¿Qué comida recomiendas?", "¿Cómo llego al centro?"], demoText: "¡Muy bien! Hay un lugar estupendo muy cerca. ¿Prefieres algo dulce o salado?", demoTranslation: "Very good! There is a great place nearby. Do you prefer something sweet or savoury?",
    scenes: localScenes(["Tapas bar", "Metro plaza", "El Rastro"], ["Lucía", "Mateo", "Sofía"], ["👩🏻", "👨🏻", "🧑🏻"]),
  },
  {
    id: "paris", name: "Paris", country: "France", language: "French", nativeLanguage: "Français", locale: "fr-FR", flag: "🇫🇷",
    coordinates: "48.86° N · 2.35° E", verified: true, sceneClass: "europe", mapX: 50.7, mapY: 22.9, rank: 5,
    greeting: "Bonjour et bienvenue à Paris ! Qu’est-ce qui vous amène ici ?", translation: "Hello and welcome to Paris! What brings you here?",
    prompts: ["Comment vous appelez-vous ?", "Qu’est-ce que vous recommandez ?", "Où se trouve le métro ?"], demoText: "Très bien ! Je vous recommande un petit café tout près. Vous préférez le sucré ou le salé ?", demoTranslation: "Very good! I recommend a little café nearby. Do you prefer sweet or savoury?",
    scenes: localScenes(["Corner café", "Seine bookseller", "Street market"], ["Camille", "Luc", "Amélie"], ["👩🏼", "👨🏼", "🧑🏼"]),
  },
  {
    id: "cairo", name: "Cairo", country: "Egypt", language: "Arabic", nativeLanguage: "العربية", locale: "ar-EG", flag: "🇪🇬",
    coordinates: "30.04° N · 31.24° E", verified: true, sceneClass: "desert", mapX: 58.7, mapY: 33.3, rank: 6,
    greeting: "أهلاً وسهلاً بك في القاهرة! ماذا تريد أن تفعل اليوم؟", translation: "Welcome to Cairo! What would you like to do today?",
    prompts: ["ما اسمك؟", "أين أجد طعاماً جيداً؟", "كيف أذهب إلى السوق؟"], demoText: "ممتاز! يوجد مكان جميل قريب من هنا. هل تريد أن أريك الطريق؟", demoTranslation: "Excellent! There is a lovely place nearby. Would you like me to show you the way?",
    scenes: localScenes(["Ahwa café", "Nile promenade", "Khan market"], ["Layla", "Omar", "Nour"], ["👩🏽", "👨🏽", "🧑🏽"]),
  },
  {
    id: "dhaka", name: "Dhaka", country: "Bangladesh", language: "Bengali", nativeLanguage: "বাংলা", locale: "bn-BD", flag: "🇧🇩",
    coordinates: "23.81° N · 90.41° E", verified: true, sceneClass: "india", mapX: 75.1, mapY: 36.8, rank: 7,
    greeting: "নমস্কার! ঢাকায় স্বাগতম। আজ আপনি কোথায় যেতে চান?", translation: "Hello! Welcome to Dhaka. Where would you like to go today?",
    prompts: ["আপনার নাম কী?", "এখানে ভালো খাবার কোথায় পাব?", "বাজারে কীভাবে যাব?"], demoText: "খুব ভালো বলেছেন! কাছেই একটি জনপ্রিয় খাবারের দোকান আছে। আপনি ঝাল পছন্দ করেন?", demoTranslation: "Very well said! There is a popular food place nearby. Do you like spicy food?",
    scenes: localScenes(["Tea cabin", "Rickshaw stand", "New Market"], ["Asha", "Rafi", "Mitu"], ["👩🏽", "👨🏽", "🧑🏽"]),
  },
  {
    id: "sao-paulo", name: "São Paulo", country: "Brazil", language: "Portuguese", nativeLanguage: "Português", locale: "pt-BR", flag: "🇧🇷",
    coordinates: "23.55° S · 46.63° W", verified: true, sceneClass: "tropical", mapX: 37, mapY: 63.1, rank: 8,
    greeting: "Olá! Bem-vindo a São Paulo. O que você quer conhecer hoje?", translation: "Hello! Welcome to São Paulo. What would you like to discover today?",
    prompts: ["Como você se chama?", "O que você recomenda comer?", "Como chego ao metrô?"], demoText: "Muito bem! Tem um lugar ótimo aqui perto. Você quer uma recomendação mais tranquila ou animada?", demoTranslation: "Very good! There is a great place nearby. Would you like a relaxed or lively recommendation?",
    scenes: localScenes(["Padaria counter", "Metro station", "Street fair"], ["Beatriz", "Lucas", "Dani"], ["👩🏽", "👨🏽", "🧑🏽"]),
  },
  {
    id: "moscow", name: "Moscow", country: "Russia", language: "Russian", nativeLanguage: "Русский", locale: "ru-RU", flag: "🇷🇺",
    coordinates: "55.76° N · 37.62° E", verified: true, sceneClass: "east", mapX: 60.5, mapY: 19, rank: 9,
    greeting: "Здравствуйте! Добро пожаловать в Москву. Куда вы хотите пойти?", translation: "Hello! Welcome to Moscow. Where would you like to go?",
    prompts: ["Как вас зовут?", "Что вы посоветуете попробовать?", "Где находится метро?"], demoText: "Отлично! Недалеко есть интересное место. Вы хотите пойти пешком или на метро?", demoTranslation: "Excellent! There is an interesting place nearby. Would you like to walk or take the metro?",
    scenes: localScenes(["Coffee kiosk", "Metro hall", "Food market"], ["Anya", "Mikhail", "Sasha"], ["👩🏻", "👨🏻", "🧑🏻"]),
  },
  {
    id: "lahore", name: "Lahore", country: "Pakistan", language: "Urdu", nativeLanguage: "اردو", locale: "ur-PK", flag: "🇵🇰",
    coordinates: "31.52° N · 74.36° E", verified: true, sceneClass: "desert", mapX: 70.7, mapY: 32.5, rank: 10,
    greeting: "السلام علیکم! لاہور میں خوش آمدید۔ آج آپ کہاں جانا چاہتے ہیں؟", translation: "Hello! Welcome to Lahore. Where would you like to go today?",
    prompts: ["آپ کا نام کیا ہے؟", "اچھا کھانا کہاں ملے گا؟", "بازار کیسے جاؤں؟"], demoText: "بہت خوب! قریب ہی ایک مشہور جگہ ہے۔ کیا آپ کو مصالحے دار کھانا پسند ہے؟", demoTranslation: "Very good! There is a famous place nearby. Do you like spicy food?",
    scenes: localScenes(["Chai dhaba", "Bus stop", "Anarkali Bazaar"], ["Zara", "Hamza", "Noor"], ["👩🏽", "👨🏽", "🧑🏽"]),
  },
  {
    id: "mumbai", name: "Mumbai", country: "India", language: "Marathi", nativeLanguage: "मराठी", locale: "mr-IN", flag: "🇮🇳",
    coordinates: "19.08° N · 72.88° E", verified: true, sceneClass: "india", mapX: 70.2, mapY: 39.4, india: true,
    greeting: "नमस्कार! मुंबईत तुमचं स्वागत आहे. आज तुम्हाला कुठे जायचं आहे?", translation: "Hello! Welcome to Mumbai. Where would you like to go today?",
    prompts: ["तुमचं नाव काय आहे?", "इथे चांगलं जेवण कुठे मिळेल?", "स्टेशनला कसं जायचं?"], demoText: "छान बोललात! जवळच एक मस्त जागा आहे. तुम्हाला तिखट आवडतं का?", demoTranslation: "Well said! There is a great place nearby. Do you like spicy food?",
    scenes: localScenes(["Irani café", "Local platform", "Dadar market"], ["Ira", "Rohan", "Sahil"], ["👩🏽", "👨🏽", "🧑🏽"]),
  },
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
    sceneClass: "bengaluru", mapX: 71.5, mapY: 42.8, india: true,
    prompts: ["ನಿಮ್ಮ ಹೆಸರು ಏನು?", "ಇಲ್ಲಿ ಒಳ್ಳೆಯ ಊಟ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ?", "ಇಂದಿನ ಹವಾಮಾನ ಹೇಗಿದೆ?"],
    demoText: "ಇಲ್ಲಿ ಮಸಾಲೆ ದೋಸೆ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ. ನಿಮಗೆ ಖಾರ ಇಷ್ಟವೇ?", demoTranslation: "The masala dosa is very good here. Do you like spicy food?",
    scenes: localScenes(["Darshini café", "Auto stand", "KR Market"], ["Ananya", "Ravi", "Meera"], ["👩🏽", "👨🏾", "👩🏾"]),
  },
];

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
  void scene;
  void input;
  const reply = { text: city.demoText, translation: city.demoTranslation };
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
    phrase: city.prompts[1],
  };
}

function extractModelJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(fenced ?? (start >= 0 && end >= start ? text.slice(start, end + 1) : text));
}

function ollamaSystemPrompt(city: City, scene: Scene, level: Level, action: "turn" | "evaluate") {
  if (action === "evaluate") {
    return `You are a fair language-game evaluator. Judge whether the player communicated successfully in ${city.language} at ${level} level in ${city.name}. The optional quest was: ${scene.goal}. Reward communicative success and recovery. Do not punish a regional accent. Use only transcript evidence. Return only valid JSON with numeric fields overall, communication, vocabulary, grammar, confidence from 0 to 100, plus string fields strength, improvement, and phrase.`;
  }
  return `You are ${scene.character}, a ${scene.role} at ${scene.label} in ${city.name}, ${city.country}. Speak naturally in ${city.language}. The player is at ${level} level. Stay warmly in character, respond to anything appropriate, remember the recent transcript, and end with no more than one natural follow-up question. Keep beginner language simple. Return only valid JSON with fields text for the ${city.language} reply and translation for concise English.`;
}

export default function Home() {
  const [cityId, setCityId] = useState("bengaluru");
  const [sceneId, setSceneId] = useState("scene-1");
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
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://127.0.0.1:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen3:8b");
  const [localStatus, setLocalStatus] = useState<LocalStatus>("idle");
  const [localMessage, setLocalMessage] = useState("Not tested yet");
  const [xp, setXp] = useState(120);
  const [coins, setCoins] = useState(35);
  const [stamps, setStamps] = useState<string[]>([]);
  const [affinity, setAffinity] = useState(12);
  const [questProgress, setQuestProgress] = useState([false, false, false]);
  const [reward, setReward] = useState<Reward | null>(null);
  const [rewarded, setRewarded] = useState(false);
  const [globeLongitude, setGlobeLongitude] = useState(78);
  const [globeScale, setGlobeScale] = useState(1);
  const [globeDragging, setGlobeDragging] = useState(false);
  const [globeAutoSpin, setGlobeAutoSpin] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const messageId = useRef(1);
  const globeDragRef = useRef<{ x: number; longitude: number } | null>(null);

  const city = useMemo(() => CITIES.find((item) => item.id === cityId) ?? CITIES[0], [cityId]);
  const scene = useMemo(() => city.scenes.find((item) => item.id === sceneId) ?? city.scenes[0], [city, sceneId]);
  const userTurns = messages.filter((message) => message.role === "user").length;
  const playerLevel = Math.floor(xp / 100) + 1;
  const levelProgress = xp % 100;
  const completedQuests = questProgress.filter(Boolean).length;

  useEffect(() => {
    const saved = window.localStorage.getItem("worldling-provider") as Provider | null;
    if (saved && ["demo", "local", "api"].includes(saved)) setProvider(saved);
    try {
      const local = JSON.parse(window.localStorage.getItem("worldling-ollama") ?? "null") as { endpoint?: string; model?: string } | null;
      if (local?.endpoint) setOllamaEndpoint(local.endpoint);
      if (local?.model) setOllamaModel(local.model);
      const progress = JSON.parse(window.localStorage.getItem("worldling-progress") ?? "null") as { xp?: number; coins?: number; stamps?: string[] } | null;
      if (typeof progress?.xp === "number") setXp(progress.xp);
      if (typeof progress?.coins === "number") setCoins(progress.coins);
      if (Array.isArray(progress?.stamps)) setStamps(progress.stamps);
    } catch {
      // Ignore malformed device-local prototype state.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    setMessages([cityWelcome(city, level)]);
    setEvaluation(null);
    setInput("");
    setQuestProgress([false, false, false]);
    setAffinity(12);
    setReward(null);
    setRewarded(false);
    setEngineNote(provider === "demo" ? "Ready · no account or key required" : provider === "local" ? "Ollama selected · test the connection in Engine" : "API model selected · server connection checked on first message");
  }, [city, scene, level, provider]);

  useEffect(() => {
    window.localStorage.setItem("worldling-provider", provider);
  }, [provider]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("worldling-ollama", JSON.stringify({ endpoint: ollamaEndpoint, model: ollamaModel }));
  }, [hydrated, ollamaEndpoint, ollamaModel]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("worldling-progress", JSON.stringify({ xp, coins, stamps }));
  }, [hydrated, xp, coins, stamps]);

  useEffect(() => {
    if (!globeAutoSpin || globeDragging || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setGlobeLongitude((current) => ((current + .32 + 180) % 360) - 180);
    }, 40);
    return () => window.clearInterval(timer);
  }, [globeAutoSpin, globeDragging]);

  function speak(text: string) {
    if (!autoSpeak || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = city.locale;
    utterance.rate = level === "Beginner" ? 0.82 : level === "Advanced" ? 1.05 : 0.94;
    window.speechSynthesis.speak(utterance);
  }

  async function callOllama(action: "turn" | "evaluate", nextMessages: Message[]) {
    const base = ollamaEndpoint.trim().replace(/\/$/, "");
    if (!base || !ollamaModel.trim()) throw new Error("Enter an Ollama endpoint and model.");
    const transcript = nextMessages.slice(-10).map((message) => ({
      role: message.role === "npc" ? "assistant" : "user",
      content: message.text,
    }));
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel.trim(),
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: ollamaSystemPrompt(city, scene, level, action) },
          ...transcript,
        ],
        options: { temperature: action === "turn" ? 0.75 : 0.15 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
    const payload = await response.json() as { message?: { content?: string } };
    return extractModelJson(payload.message?.content ?? "");
  }

  async function testOllama() {
    setLocalStatus("checking");
    setLocalMessage("Looking for Ollama on this device…");
    try {
      const base = ollamaEndpoint.trim().replace(/\/$/, "");
      const response = await fetch(`${base}/api/tags`);
      if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
      const payload = await response.json() as { models?: Array<{ name?: string; model?: string }> };
      const available = (payload.models ?? []).map((item) => item.model ?? item.name ?? "").filter(Boolean);
      const modelReady = available.some((name) => name === ollamaModel || name.startsWith(`${ollamaModel}:`) || ollamaModel.startsWith(`${name}:`));
      if (!modelReady) {
        setLocalStatus("error");
        setLocalMessage(available.length ? `Ollama is online, but ${ollamaModel} is not installed. Available: ${available.slice(0, 3).join(", ")}.` : "Ollama is online, but it has no downloaded models.");
        return;
      }
      setLocalStatus("connected");
      setLocalMessage(`Connected · ${ollamaModel} is ready on this device`);
      setProvider("local");
      setEngineNote(`Ollama connected · using ${ollamaModel}`);
    } catch {
      setLocalStatus("error");
      setLocalMessage("Could not reach Ollama. Start Ollama, allow this site origin, or run Worldling locally.");
    }
  }

  async function askProvider(text: string, nextMessages: Message[]) {
    if (provider === "local") {
      return await callOllama("turn", nextMessages) as { text: string; translation?: string };
    }
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
    const asksQuestion = /[?？]|what|where|how|why|who|which|ಎಲ್ಲಿ|ಏನು|ಹೇಗೆ|どこ|何|どう|où|comment|pourquoi/i.test(clean);
    setQuestProgress((current) => [true, current[1] || asksQuestion, current[2] || userTurns + 1 >= 3]);
    setEngineNote(provider === "demo" ? "NPC considered intent · selected a follow-up" : `Contacting ${providerLabels[provider]}…`);

    let reply: { text: string; translation?: string };
    try {
      if (provider === "demo") {
        await new Promise((resolve) => window.setTimeout(resolve, 520));
        reply = demoReply(city, scene, clean, level);
        setEngineNote("Intent read · conversation memory updated · follow-up chosen");
      } else {
        reply = await askProvider(clean, nextMessages);
        if (provider === "local") {
          setLocalStatus("connected");
          setLocalMessage(`Connected · ${ollamaModel} generated this reply`);
        }
        setEngineNote(`${providerLabels[provider]} responded · memory updated`);
      }
    } catch {
      reply = demoReply(city, scene, clean, level);
      if (provider === "local") {
        setLocalStatus("error");
        setLocalMessage("Ollama did not respond. Demo fallback was used for this turn.");
      }
      setEngineNote(`${providerLabels[provider]} unavailable · demo fallback kept the conversation alive`);
    }

    const npcMessage: Message = {
      id: messageId.current++,
      role: "npc",
      text: reply.text,
      translation: level === "Advanced" ? undefined : reply.translation,
    };
    setMessages((current) => [...current, npcMessage]);
    setAffinity((current) => Math.min(100, current + (asksQuestion ? 14 : 9)));
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
        if (provider === "local") {
          result = await callOllama("evaluate", messages) as Evaluation;
          setLocalStatus("connected");
          setLocalMessage(`Connected · ${ollamaModel} evaluated this quest`);
        } else {
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
        }
        setEngineNote(`${providerLabels[provider]} completed a level-aware evaluation`);
      } catch {
        if (provider === "local") {
          setLocalStatus("error");
          setLocalMessage("Ollama could not grade this quest. The transparent demo rubric was used.");
        }
        setEngineNote(`${providerLabels[provider]} unavailable · transparent demo rubric used`);
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setEngineNote("Demo rubric complete · no audio was stored");
    }
    if (!rewarded) {
      const xpEarned = Math.max(20, Math.round(result.overall * 0.55) + completedQuests * 8);
      const coinsEarned = Math.max(5, Math.round(result.overall / 12));
      const newStamp = result.overall >= 70 && !stamps.includes(city.id);
      setXp((current) => current + xpEarned);
      setCoins((current) => current + coinsEarned);
      if (newStamp) setStamps((current) => [...current, city.id]);
      setReward({ xp: xpEarned, coins: coinsEarned, newStamp });
      setRewarded(true);
    }
    setEvaluation(result);
    setThinking(false);
  }

  function chooseCity(nextCity: City) {
    setCityId(nextCity.id);
    setSceneId(nextCity.scenes[0].id);
    setGlobeAutoSpin(false);
    setGlobeLongitude(nextCity.mapX * 3.6 - 180);
  }

  function globePoint(item: City) {
    const longitude = item.mapX * 3.6 - 180;
    const latitude = 90 - item.mapY * 1.8;
    const delta = (longitude - globeLongitude) * Math.PI / 180;
    const latitudeRadians = latitude * Math.PI / 180;
    const depth = Math.cos(latitudeRadians) * Math.cos(delta);
    return {
      x: 50 + 46 * Math.cos(latitudeRadians) * Math.sin(delta),
      y: 50 - 46 * Math.sin(latitudeRadians),
      depth,
      visible: depth > .04,
    };
  }

  function changeGlobeScale(delta: number) {
    setGlobeScale((current) => Math.min(1.3, Math.max(.84, Number((current + delta).toFixed(2)))));
  }

  function handleGlobeWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeGlobeScale(event.deltaY < 0 ? .08 : -.08);
  }

  function handleGlobePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    globeDragRef.current = { x: event.clientX, longitude: globeLongitude };
    setGlobeDragging(true);
    setGlobeAutoSpin(false);
  }

  function handleGlobePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = globeDragRef.current;
    if (!origin) return;
    const next = origin.longitude - (event.clientX - origin.x) * .75;
    setGlobeLongitude(((next + 180) % 360 + 360) % 360 - 180);
  }

  function stopGlobeDrag() {
    globeDragRef.current = null;
    setGlobeDragging(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#world" aria-label="Worldling home">
          <span className="brand-mark">W</span>
          <span>WORLDLING</span>
          <small>FREE ROAM / VOICE OPS</small>
        </a>
        <div className="top-actions">
          <div className="player-hud" aria-label={`Player level ${playerLevel}, ${levelProgress} percent to next level, ${coins} travel coins`}>
            <span className="level-medal">{playerLevel}</span>
            <div><small>TRAVELLER LEVEL {playerLevel}</small><i><b style={{ width: `${levelProgress}%` }} /></i></div>
            <strong>◈ {coins}</strong>
          </div>
          <div className="level-control" aria-label="Difficulty level">
            {(["Beginner", "Intermediate", "Advanced"] as Level[]).map((option) => (
              <button key={option} className={level === option ? "active" : ""} onClick={() => setLevel(option)}>{option}</button>
            ))}
          </div>
          <button className="engine-button" onClick={() => setShowEngine(true)}>
            <span className={`status-dot ${provider} ${provider === "local" ? localStatus : ""}`} />
            {providerLabels[provider]}
            <span aria-hidden="true">⌄</span>
          </button>
        </div>
      </header>

      <section className="experience-grid">
        <aside className="world-panel" id="world">
          <div className="section-kicker"><span>01</span> Global operations map</div>
          <h1>Choose your<br />territory.</h1>
          <p className="intro">Select a city, enter the street, and talk your way through a live language mission.</p>

          <div
            className={`world-map globe-viewport ${globeDragging ? "dragging" : ""}`}
            aria-label="Interactive spinning globe with available destinations"
            onWheel={handleGlobeWheel}
            onPointerDown={handleGlobePointerDown}
            onPointerMove={handleGlobePointerMove}
            onPointerUp={stopGlobeDrag}
            onPointerCancel={stopGlobeDrag}
          >
            <div className="globe-orbit globe-orbit-one" />
            <div className="globe-orbit globe-orbit-two" />
            <div className="globe-shell" style={{ transform: `scale(${globeScale})` }}>
              <div className="globe-surface" style={{ backgroundPosition: `${50 + globeLongitude / 3.6}% center` }} />
              <div className="globe-grid" />
              <div className="globe-shade" />
              {CITIES.map((item) => {
                const point = globePoint(item);
                return (
                  <button
                    key={item.id}
                    className={`map-pin globe-pin ${item.id === city.id ? "selected" : ""} ${point.visible ? "" : "backside"}`}
                    style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: point.visible ? Math.max(.38, point.depth) : 0 }}
                    onClick={() => chooseCity(item)}
                    tabIndex={point.visible ? 0 : -1}
                    aria-label={`Visit ${item.name} to practise ${item.language}`}
                  >
                    <span>{item.flag}</span>
                    <strong>{item.name}</strong>
                  </button>
                );
              })}
            </div>
            <div className="map-controls globe-controls" aria-label="Globe controls">
              <button onClick={() => changeGlobeScale(-.08)} disabled={globeScale <= .84} aria-label="Zoom globe out">−</button>
              <button className="spin-control" onClick={() => setGlobeAutoSpin((current) => !current)}>{globeAutoSpin ? "PAUSE" : "SPIN"}</button>
              <button onClick={() => changeGlobeScale(.08)} disabled={globeScale >= 1.3} aria-label="Zoom globe in">+</button>
            </div>
            <div className="globe-coordinate"><span>◉</span>{city.coordinates}</div>
            <div className="map-caption">Drag to spin · scroll to zoom · choose a live signal</div>
          </div>

          <div className="language-heading"><strong>LANGUAGE ATLAS</strong><span>Global top 10 + India</span></div>
          <div className="city-list">
            {CITIES.map((item) => (
              <button key={item.id} className={item.id === city.id ? "city-card active" : "city-card"} onClick={() => chooseCity(item)}>
                <span className="city-flag">{item.flag}</span>
                <span><strong>{item.language}</strong><small>{item.name} · {item.nativeLanguage}</small></span>
                <span className="language-rank">{item.rank ? `#${item.rank}${item.india ? " · IN" : ""}` : "INDIA"}</span>
              </button>
            ))}
          </div>
          <div className="passport-strip">
            <div><span>◆</span><p><strong>YOUR PASSPORT</strong><small>{stamps.length}/{CITIES.length} city stamps earned</small></p></div>
            <div className="stamp-row">
              {CITIES.map((item) => <span key={item.id} className={stamps.includes(item.id) ? "earned" : ""} title={`${item.name} stamp`}>{stamps.includes(item.id) ? item.flag : "·"}</span>)}
            </div>
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
            <span className="mission-icon">{completedQuests === 3 ? "✓" : "◎"}</span>
              <div><small>MISSION ACTIVE · {city.name.toUpperCase()}</small><strong>{scene.goal}</strong></div>
            <span className="quest-count">{completedQuests}/3</span>
            <div className="quest-objectives">
              {["Greet the local", "Ask a real question", "Complete 3 turns"].map((objective, index) => (
                <span key={objective} className={questProgress[index] ? "done" : ""}><i>{questProgress[index] ? "✓" : index + 1}</i>{objective}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="conversation-panel">
          <div className="conversation-head">
            <div>
              <div className="section-kicker"><span>03</span> Join the conversation</div>
              <h2>Talk with {scene.character}</h2>
              <div className="affinity-meter"><span>Bond with {scene.character}</span><i><b style={{ width: `${affinity}%` }} /></i><strong>{affinity}%</strong></div>
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
            {city.prompts.map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}
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
        <p><strong>WORLDLING / FREE ROAM BUILD 03</strong> · Browser voice recognition supplies the transcript.</p>
        <p>The selected model receives text, not raw microphone audio. · Map by <a href="https://commons.wikimedia.org/wiki/File:Blank_Map_of_The_World_Equirectangular_Projection.png" target="_blank" rel="noreferrer">FelixCountryBalls163, CC BY 4.0</a></p>
      </footer>

      {evaluation && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEvaluation(null)}>
          <section className="score-card" role="dialog" aria-modal="true" aria-labelledby="score-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setEvaluation(null)} aria-label="Close score">×</button>
            <div className="score-top">
              <div className="score-ring"><strong>{evaluation.overall}</strong><span>/100</span></div>
              <div><span className="score-kicker">CONVERSATION COMPLETE</span><h2 id="score-title">You were understood.</h2><p>{city.name} · {city.language} · {level}</p></div>
            </div>
            {reward && (
              <div className="reward-banner">
                <span><strong>+{reward.xp} XP</strong><small>Quest experience</small></span>
                <span><strong>+{reward.coins} ◈</strong><small>Travel coins</small></span>
                <span className={reward.newStamp ? "stamp-won" : ""}><strong>{reward.newStamp ? city.flag : `${completedQuests}/3`}</strong><small>{reward.newStamp ? "New passport stamp" : "Quest objectives"}</small></span>
              </div>
            )}
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
            <button className="replay-button" onClick={() => { setMessages([cityWelcome(city, level)]); setEvaluation(null); setReward(null); setRewarded(false); setQuestProgress([false, false, false]); setAffinity(12); }}>Play this scene again</button>
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
            {provider === "local" ? (
              <div className="ollama-config">
                <div className="ollama-title"><span className={`status-dot local ${localStatus}`} /><div><strong>Direct Ollama connection</strong><small>Conversation text goes from this browser to your local Ollama server.</small></div></div>
                <label>Ollama address<input value={ollamaEndpoint} onChange={(event) => { setOllamaEndpoint(event.target.value); setLocalStatus("idle"); }} placeholder="http://127.0.0.1:11434" /></label>
                <label>Installed model<input value={ollamaModel} onChange={(event) => { setOllamaModel(event.target.value); setLocalStatus("idle"); }} placeholder="qwen3:8b" /></label>
                <div className={`local-result ${localStatus}`}><span>{localStatus === "checking" ? "◌" : localStatus === "connected" ? "✓" : localStatus === "error" ? "!" : "·"}</span><p>{localMessage}</p></div>
                <button className="test-local" onClick={() => void testOllama()} disabled={localStatus === "checking"}>{localStatus === "checking" ? "Testing…" : "Test Ollama connection"}</button>
                <p className="origin-help">For the hosted version, Ollama must allow the Worldling site origin. Running Worldling locally is the simplest setup.</p>
              </div>
            ) : (
              <div className="config-note">
                <strong>{provider === "api" ? "API setup" : "Demo setup"}</strong>
                <p>{provider === "api" ? "Set OPENAI_API_KEY and OPENAI_MODEL on the server. Keys are never requested by or exposed to the browser." : "No setup. Responses and scores use transparent prototype rules so every interaction is testable."}</p>
              </div>
            )}
            <button className="sheet-done" onClick={() => setShowEngine(false)}>Continue with {providerLabels[provider]}</button>
          </section>
        </div>
      )}
    </main>
  );
}
