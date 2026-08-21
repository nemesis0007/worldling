"use client";

import { FormEvent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import VirtualJoystick from "./VirtualJoystick";
import { AgentAction, FLAGSHIP_MISSIONS, genericMission } from "./mission-data";

const World3D = lazy(() => import("./World3D"));

type Provider = "demo" | "local" | "api";
type Level = "Beginner" | "Intermediate" | "Advanced";
type Role = "npc" | "user" | "system";

type Message = {
  id: number;
  role: Role;
  text: string;
  translation?: string;
  viaVoice?: boolean;
  speaker?: string;
};

type AgentEvent = {
  id: number;
  tool: AgentAction["tool"] | "model";
  label: string;
};

type LearnerMemory = {
  attempts: number;
  knownPhrases: string[];
  focusWords: string[];
  completedMissions: string[];
};

type AgentReply = {
  text: string;
  translation?: string;
  actions?: AgentAction[];
  source?: string;
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

const CITY_CENTERS: Record<string, [number, number]> = {
  "New York": [40.7580, -73.9855],
  Beijing: [39.9163, 116.3972],
  Delhi: [28.6129, 77.2295],
  Madrid: [40.4200, -3.6880],
  Paris: [48.8584, 2.2945],
  Cairo: [29.9792, 31.1342],
  Dhaka: [23.8103, 90.4125],
  "São Paulo": [-23.5614, -46.6559],
  Moscow: [55.7525, 37.6231],
  Lahore: [31.5925, 74.3095],
  Mumbai: [18.9220, 72.8347],
  Bengaluru: [12.9796, 77.5907],
};

type PronunciationProvider = "local" | "azure";
type PronunciationResult = {
  provider: PronunciationProvider;
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody?: number | null;
  recognizedText: string;
  feedback: string;
  phonemeScoring: boolean;
  phonemeAccuracy?: number | null;
  expectedIpa?: string | null;
  observedIpa?: string | null;
  words: Array<{
    word: string;
    accuracy: number;
    errorType: string;
    phonemes?: Array<{ phoneme: string; accuracy: number }>;
  }>;
};

type WavCapture = { stop: () => Promise<Blob> };

const PLAYABLE_STREET_BOUNDS = { minX: 33, maxX: 67, minY: 22, maxY: 96 } as const;
const STREET_NPC_POSITIONS = [
  { x: 35, y: 72 },
  { x: 65, y: 55 },
  { x: 35, y: 32 },
];

function clampToPlayableStreet(point: { x: number; y: number }) {
  return {
    x: Math.min(PLAYABLE_STREET_BOUNDS.maxX, Math.max(PLAYABLE_STREET_BOUNDS.minX, point.x)),
    y: Math.min(PLAYABLE_STREET_BOUNDS.maxY, Math.max(PLAYABLE_STREET_BOUNDS.minY, point.y)),
  };
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results?: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
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
    scenes: localScenes(["Times Square deli", "42 St subway", "Bryant Park"], ["Maya", "Theo", "Jordan"], ["👩🏽", "👨🏿", "🧑🏻"]),
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

function encodeWav(samples: Float32Array, sourceRate: number) {
  const targetRate = 16000;
  const targetLength = Math.max(1, Math.round(samples.length * targetRate / sourceRate));
  const resampled = new Float32Array(targetLength);
  for (let index = 0; index < targetLength; index++) {
    const position = index * sourceRate / targetRate;
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = position - left;
    resampled[index] = samples[left] * (1 - mix) + samples[right] * mix;
  }
  const buffer = new ArrayBuffer(44 + resampled.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + resampled.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, resampled.length * 2, true);
  for (let index = 0; index < resampled.length; index++) {
    const sample = Math.max(-1, Math.min(1, resampled[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function beginWavCapture(): Promise<WavCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  const chunks: Float32Array[] = [];
  mute.gain.value = 0;
  processor.onaudioprocess = (event) => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);
  return {
    stop: async () => {
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close();
      const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const samples = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      return encodeWav(samples, context.sampleRate);
    },
  };
}

function cityWelcome(city: City, level: Level): Message {
  return {
    id: Date.now(),
    role: "npc",
    text: city.greeting,
    translation: level === "Advanced" ? undefined : city.translation,
    speaker: city.scenes[0].character,
  };
}

const FLAGSHIP_DEMO_REPLIES: Record<string, Array<{ text: string; translation: string }>> = {
  "new-york": [
    { text: "Good call. Get the pastrami on rye, then walk over to Bryant Park—tell Theo at the subway entrance that Maya sent you. Do you want mustard on that?", translation: "Maya completed your order and passed a local recommendation to the next character." },
    { text: "Maya sent you? Bryant Park is one block east, so walking is faster from here. If you take the train later, use the downtown platform. Want me to point you toward Jordan?", translation: "Theo used Maya's handoff and confirmed the route." },
    { text: "You made it! After work, locals grab a chair by the lawn or catch the free events. The useful phrase here is: ‘Is there anything happening tonight?’", translation: "Jordan completed your connected Midtown plan." },
  ],
  paris: [
    { text: "Bien sûr. Je vous conseille un café crème et un croissant. Pour un petit cadeau, demandez à Luc près des bouquinistes. Vous désirez autre chose ?", translation: "Of course. I recommend a cafe creme and a croissant. For a small gift, ask Luc by the booksellers." },
    { text: "Camille vous envoie ? Suivez la Seine, puis tournez à gauche au panneau du métro. Le marché est juste après. Vous voulez que je répète plus lentement ?", translation: "Camille sent you? Follow the Seine, then turn left at the Metro sign. The market is just after it." },
    { text: "Cette petite affiche coûte huit euros. Vous pouvez payer par carte ou en espèces. C’est un joli souvenir de Paris, n’est-ce pas ?", translation: "This small print costs eight euros. You can pay by card or cash. It is a lovely Paris souvenir." },
  ],
  mumbai: [
    { text: "छान! आधी बन-मस्का आणि चहा घ्या. दादरला जायचं असेल तर रोहनला विचारा. अजून काही हवं आहे का?", translation: "Great! Start with bun maska and tea. If you are going to Dadar, ask Rohan. Would you like anything else?" },
    { text: "दादरसाठी प्लॅटफॉर्म दोनवरची फास्ट लोकल घ्या. पुढच्या थांब्यानंतर घोषणा नीट ऐका. मी पुन्हा सांगू का?", translation: "For Dadar, take the fast local from platform two. Listen for the announcement after the next stop. Shall I repeat it?" },
    { text: "हा हार दोनशे रुपयांचा आहे. थोडा कमी करतो—एकशे ऐंशी चालेल. रोख की यूपीआय?", translation: "This garland is 200 rupees. I can make it 180. Cash or UPI?" },
  ],
};

function demoReply(city: City, scene: Scene, input: string, level: Level): { text: string; translation: string } {
  const sceneIndex = Math.max(0, city.scenes.findIndex((item) => item.id === scene.id));
  const normalized = input.toLocaleLowerCase();
  let reply = FLAGSHIP_DEMO_REPLIES[city.id]?.[sceneIndex] ?? { text: city.demoText, translation: city.demoTranslation };
  if (city.id === "new-york") {
    if (sceneIndex === 0 && /^(hi|hey|hello)\b/.test(normalized)) {
      reply = { text: "Hey! I’m Maya. If you’re hungry, I can help you order like a regular or point you toward a good deli. What are you in the mood for?", translation: "Maya introduced herself and offered help with a deli order." };
    } else if (sceneIndex === 0 && /chill|relax|hang|walk|explor|nothing much|vacation|tour/.test(normalized)) {
      reply = { text: "Nice—then don’t over-plan it. Bryant Park is good for people-watching, and you can grab something from a deli on the way. Do you want a food recommendation or a quiet spot?", translation: "Maya matched your relaxed mood and offered two relevant local options." };
    } else if (sceneIndex === 0 && /deli|place|recommend|food/.test(normalized)) {
      reply = { text: "For the classic New York experience, try the pastrami on rye with mustard. Afterward, Bryant Park is an easy walk east. Want the walking directions?", translation: "Maya recommended a deli order and offered directions to Bryant Park." };
    } else if (sceneIndex === 1 && /^(yes|yeah|sure|okay|ok)\b/.test(normalized)) {
      reply = { text: "Sure. Leave the subway entrance, walk east toward Sixth Avenue, and Bryant Park will be beside the library. Jordan is near the park entrance.", translation: "Theo gave a clear walking route and identified the next character." };
    } else if (sceneIndex === 1 && /where|road|route|direction|bryant|brayan/.test(normalized)) {
      reply = { text: "Bryant Park is one block east from here, beside the New York Public Library. Walking is faster than taking the train. Do you want me to repeat the landmarks?", translation: "Theo located Bryant Park and confirmed that walking is the fastest option." };
    } else if (sceneIndex === 2 && /after work|evening|tonight|do/.test(normalized)) {
      reply = { text: "After work, people grab food, sit by the lawn, or catch a free event. Ask, ‘Is there anything happening tonight?’ and you’ll sound completely natural.", translation: "Jordan shared a local after-work activity and a useful phrase." };
    }
  }
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

function ollamaSystemPrompt(city: City, scene: Scene, level: Level, action: "turn" | "evaluate", missionContext = "") {
  if (action === "evaluate") {
    return `You are a fair language-game evaluator. Judge whether the player communicated successfully in ${city.language} at ${level} level in ${city.name}. The objective was: ${scene.goal}. ${missionContext} Reward communicative success and recovery. Do not punish a regional accent. Use only transcript evidence. Return only valid JSON with numeric fields overall, communication, vocabulary, grammar, confidence from 0 to 100, plus string fields strength, improvement, and phrase.`;
  }
  return `You are ${scene.character}, a ${scene.role} at ${scene.label} in ${city.name}, ${city.country}. Speak naturally in ${city.language}. The player is at ${level} level. Stay warmly in character, respond to anything appropriate, remember the recent transcript, and end with no more than one natural follow-up question. Keep beginner language simple. ${missionContext} Return only valid JSON with fields text for the ${city.language} reply, translation for concise English, and actions as an array of zero or more objects shaped {"tool":"remember_fact|give_item|complete_step|set_waypoint","value":"short value","reason":"short reason"}. Only use complete_step when the player's latest message meaningfully addresses the current objective.`;
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
  const [pendingCityId, setPendingCityId] = useState<string | null>(null);
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
  const [playerPosition, setPlayerPosition] = useState({ x: 50, y: 82 });
  const [showTranscript, setShowTranscript] = useState(false);
  const [showWorldPicker, setShowWorldPicker] = useState(true);
  const [showPhrasebook, setShowPhrasebook] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [pronunciationProvider, setPronunciationProvider] = useState<PronunciationProvider>("local");
  const [pronunciationPrompt, setPronunciationPrompt] = useState(0);
  const [pronunciationRecording, setPronunciationRecording] = useState(false);
  const [pronunciationBusy, setPronunciationBusy] = useState(false);
  const [pronunciationNote, setPronunciationNote] = useState("Choose a phrase and record one clear attempt.");
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationResult | null>(null);
  const [pronunciationBest, setPronunciationBest] = useState<Record<string, number>>({});
  const [lastAttemptUrl, setLastAttemptUrl] = useState("");
  const [localPronunciationEndpoint, setLocalPronunciationEndpoint] = useState("http://127.0.0.1:8787");
  const [missionStepIndex, setMissionStepIndex] = useState(0);
  const [missionStepTurns, setMissionStepTurns] = useState(0);
  const [missionInventory, setMissionInventory] = useState<string[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [lastHeard, setLastHeard] = useState("");
  const [learnerMemory, setLearnerMemory] = useState<LearnerMemory>({ attempts: 0, knownPhrases: [], focusWords: [], completedMissions: [] });
  const [hydrated, setHydrated] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const messageId = useRef(1);
  const pronunciationCaptureRef = useRef<WavCapture | null>(null);
  const pronunciationTimerRef = useRef<number | null>(null);
  const worldInputRef = useRef<HTMLInputElement | null>(null);
  const cameraDirectionRef = useRef({ x: 0, z: -1 });

  const updateCameraDirection = useCallback((direction: { x: number; z: number }) => {
    cameraDirectionRef.current = direction;
  }, []);

  const city = useMemo(() => CITIES.find((item) => item.id === cityId) ?? CITIES[0], [cityId]);
  const mission = useMemo(() => FLAGSHIP_MISSIONS[city.id] ?? genericMission(city.id, city.name, city.scenes.map((item) => item.goal)), [city]);
  const missionStep = mission.steps[Math.min(missionStepIndex, mission.steps.length - 1)];
  const scene = useMemo(() => city.scenes.find((item) => item.id === sceneId) ?? city.scenes[0], [city, sceneId]);
  const userTurns = messages.filter((message) => message.role === "user").length;
  const completedQuests = questProgress.filter(Boolean).length;
  const cityCenter = CITY_CENTERS[city.name] ?? [90 - city.mapY * 1.8, city.mapX * 3.6 - 180];
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${cityCenter[0].toFixed(4)},${cityCenter[1].toFixed(4)}`)}`;
  const activeNpcIndex = missionStep.npcIndex;
  const npcPositions = STREET_NPC_POSITIONS;
  const activeNpcPosition = npcPositions[activeNpcIndex];
  const nearCharacter = Math.hypot((playerPosition.x - activeNpcPosition.x) / 3.1, (playerPosition.y - activeNpcPosition.y) / 2.2) < 3.4;
  const currentNpcMessage = [...messages].reverse().find((message) => message.role === "npc" && message.speaker === scene.character);
  const waypointDistance = Math.round(Math.hypot(playerPosition.x - activeNpcPosition.x, playerPosition.y - activeNpcPosition.y));
  const weakestWord = pronunciationResult?.words.length
    ? [...pronunciationResult.words].sort((a, b) => a.accuracy - b.accuracy)[0]
    : null;

  const addAgentEvent = useCallback((tool: AgentEvent["tool"], label: string) => {
    setAgentEvents((current) => [{ id: Date.now() + Math.random(), tool, label }, ...current].slice(0, 4));
  }, []);

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
      const pronunciation = JSON.parse(window.localStorage.getItem("worldling-pronunciation") ?? "null") as { provider?: PronunciationProvider; endpoint?: string } | null;
      if (pronunciation?.provider === "local" || pronunciation?.provider === "azure") setPronunciationProvider(pronunciation.provider);
      if (pronunciation?.endpoint) setLocalPronunciationEndpoint(pronunciation.endpoint);
      const memory = JSON.parse(window.localStorage.getItem("worldling-learner-memory") ?? "null") as Partial<LearnerMemory> | null;
      if (memory) setLearnerMemory({
        attempts: typeof memory.attempts === "number" ? memory.attempts : 0,
        knownPhrases: Array.isArray(memory.knownPhrases) ? memory.knownPhrases.slice(0, 8) : [],
        focusWords: Array.isArray(memory.focusWords) ? memory.focusWords.slice(0, 8) : [],
        completedMissions: Array.isArray(memory.completedMissions) ? memory.completedMissions : [],
      });
      const best = JSON.parse(window.localStorage.getItem("worldling-pronunciation-best") ?? "null") as Record<string, number> | null;
      if (best) setPronunciationBest(best);
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
    setMissionStepIndex(0);
    setMissionStepTurns(0);
    setMissionInventory([]);
    setAgentEvents([{ id: Date.now(), tool: "set_waypoint", label: `Director marked ${city.scenes[0].character}` }]);
    setAffinity(12);
    setReward(null);
    setRewarded(false);
    setPronunciationPrompt(0);
    setPronunciationResult(null);
    setPronunciationNote("Choose a phrase and record one clear attempt.");
    setEngineNote(provider === "demo" ? "Ready · no account or key required" : provider === "local" ? "Ollama selected · test the connection in Engine" : "API model selected · server connection checked on first message");
  }, [city, level, provider]);

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
    if (!hydrated) return;
    window.localStorage.setItem("worldling-pronunciation", JSON.stringify({ provider: pronunciationProvider, endpoint: localPronunciationEndpoint }));
  }, [hydrated, pronunciationProvider, localPronunciationEndpoint]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("worldling-learner-memory", JSON.stringify(learnerMemory));
  }, [hydrated, learnerMemory]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("worldling-pronunciation-best", JSON.stringify(pronunciationBest));
  }, [hydrated, pronunciationBest]);

  useEffect(() => () => {
    if (lastAttemptUrl) URL.revokeObjectURL(lastAttemptUrl);
  }, [lastAttemptUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleGameShortcuts(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("input, textarea")) return;
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        setShowPhrasebook((current) => !current);
        setShowPause(false);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (showPhrasebook) setShowPhrasebook(false);
        else setShowPause((current) => !current);
        return;
      }
      if ((event.key === "e" || event.key === "E") && nearCharacter) {
        event.preventDefault();
        worldInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleGameShortcuts);
    return () => window.removeEventListener("keydown", handleGameShortcuts);
  }, [nearCharacter, showPhrasebook]);

  useEffect(() => {
    const pressed = new Set<string>();
    const movementKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);
    const movementBlocked = showPause || showPhrasebook || showWorldPicker || showEngine || showPronunciation;
    let animationFrame = 0;
    let previousTime = performance.now();

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "shift") {
        if (movementBlocked) return;
        pressed.add(key);
        return;
      }
      if (movementBlocked || !movementKeys.has(key) || (event.target as HTMLElement).closest("input, textarea, button")) return;
      event.preventDefault();
      pressed.add(key);
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearPressed() {
      pressed.clear();
    }

    function moveFromHeldKeys(time: number) {
      const elapsed = Math.min((time - previousTime) / 1000, .05);
      previousTime = time;
      const forwardInput = Number(pressed.has("w") || pressed.has("arrowup")) - Number(pressed.has("s") || pressed.has("arrowdown"));
      const rightInput = Number(pressed.has("d") || pressed.has("arrowright")) - Number(pressed.has("a") || pressed.has("arrowleft"));

      if (forwardInput || rightInput) {
        const inputLength = Math.hypot(forwardInput, rightInput);
        const forward = cameraDirectionRef.current;
        const right = { x: -forward.z, z: forward.x };
        const speed = (pressed.has("shift") ? 42 : 24) * elapsed / inputLength;
        const xDelta = (forward.x * forwardInput + right.x * rightInput) * speed;
        const yDelta = (forward.z * forwardInput + right.z * rightInput) * speed;
        setPlayerPosition((current) => clampToPlayableStreet({ x: current.x + xDelta, y: current.y + yDelta }));
      }

      animationFrame = window.requestAnimationFrame(moveFromHeldKeys);
    }

    animationFrame = window.requestAnimationFrame(moveFromHeldKeys);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearPressed);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearPressed);
      pressed.clear();
    };
  }, [city.id, showEngine, showPause, showPhrasebook, showPronunciation, showWorldPicker]);

  function speak(text: string, force = false) {
    if ((!autoSpeak && !force) || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = city.locale;
    utterance.rate = level === "Beginner" ? 0.82 : level === "Advanced" ? 1.05 : 0.94;
    window.speechSynthesis.speak(utterance);
  }

  async function callOllama(action: "turn" | "evaluate", nextMessages: Message[]) {
    const base = ollamaEndpoint.trim().replace(/\/$/, "");
    if (!base || !ollamaModel.trim()) throw new Error("Enter an Ollama endpoint and model.");
    const transcript = nextMessages.slice(-6).map((message) => ({
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
        think: false,
        keep_alive: "30m",
        messages: [
          { role: "system", content: ollamaSystemPrompt(city, scene, level, action, `Current connected mission: ${mission.title}. Objective: ${missionStep.instruction}. Items and facts already carried: ${missionInventory.join(", ") || "none"}. Learner focus words: ${learnerMemory.focusWords.join(", ") || "none"}.`) },
          ...transcript,
        ],
        options: {
          temperature: action === "turn" ? 0.65 : 0.15,
          num_ctx: 4096,
          num_predict: action === "turn" ? 96 : 180,
        },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(failure?.error ?? `Ollama returned ${response.status}.`);
    }
    const payload = await response.json() as { message?: { content?: string } };
    return extractModelJson(payload.message?.content ?? "");
  }

  async function testOllama() {
    setLocalStatus("checking");
    setLocalMessage("Looking for Ollama on this device…");
    try {
      const base = ollamaEndpoint.trim().replace(/\/$/, "");
      const response = await fetch(`${base}/api/tags`);
      if (response.status === 403) {
        setLocalStatus("error");
        setLocalMessage(`Ollama blocked ${window.location.origin}. Add this exact site to OLLAMA_ORIGINS, restart Ollama, then test again.`);
        return;
      }
      if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
      const payload = await response.json() as { models?: Array<{ name?: string; model?: string }> };
      const available = (payload.models ?? []).map((item) => item.model ?? item.name ?? "").filter(Boolean);
      const modelReady = available.some((name) => name === ollamaModel || name.startsWith(`${ollamaModel}:`) || ollamaModel.startsWith(`${name}:`));
      if (!modelReady) {
        setLocalStatus("error");
        setLocalMessage(available.length ? `Ollama is online, but ${ollamaModel} is not installed. Available: ${available.slice(0, 3).join(", ")}.` : "Ollama is online, but it has no downloaded models.");
        return;
      }
      setLocalMessage(`${ollamaModel} found · warming the model for faster replies…`);
      const warmResponse = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel.trim(),
          prompt: "",
          stream: false,
          keep_alive: "30m",
          options: { num_ctx: 4096 },
        }),
      });
      if (!warmResponse.ok) {
        const failure = await warmResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error ?? `Model warm-up returned ${warmResponse.status}.`);
      }
      setLocalStatus("connected");
      setLocalMessage(`Connected · ${ollamaModel} is warm and ready in fast mode`);
      setProvider("local");
      setEngineNote(`Ollama connected · using ${ollamaModel}`);
      const pendingCity = CITIES.find((item) => item.id === pendingCityId);
      if (pendingCity) {
        enterCity(pendingCity);
        setPendingCityId(null);
        setShowEngine(false);
      }
    } catch (error) {
      setLocalStatus("error");
      const base = ollamaEndpoint.trim().replace(/\/$/, "") || "the configured address";
      const detail = error instanceof Error && !/Failed to fetch|Load failed|NetworkError/i.test(error.message)
        ? ` ${error.message}`
        : "";
      setLocalMessage(`Could not start ${ollamaModel} at ${base}.${detail} Confirm Ollama is running, then test again.`);
    }
  }

  async function askProvider(text: string, nextMessages: Message[]): Promise<AgentReply> {
    if (provider === "local") {
      return await callOllama("turn", nextMessages) as AgentReply;
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
        mission: mission.title,
        objective: missionStep.instruction,
        inventory: missionInventory,
        learnerMemory: { focusWords: learnerMemory.focusWords, knownPhrases: learnerMemory.knownPhrases.slice(0, 4) },
        input: text,
        messages: nextMessages.slice(-8).map(({ role, text: content }) => ({ role, content })),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as AgentReply;
  }

  async function submitText(text: string, viaVoice = false) {
    const clean = text.trim();
    if (!clean || thinking) return;
    const startedAt = performance.now();
    const userMessage: Message = { id: messageId.current++, role: "user", text: clean, viaVoice, speaker: "You" };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    const asksQuestion = /[?？]|what|where|how|why|who|which|ಎಲ್ಲಿ|ಏನು|ಹೇಗೆ|どこ|何|どう|où|comment|pourquoi/i.test(clean);
    setEngineNote(provider === "demo" ? "NPC considered intent · selected a follow-up" : `Contacting ${providerLabels[provider]}…`);

    let reply: AgentReply;
    try {
      if (provider === "demo") {
        await new Promise((resolve) => window.setTimeout(resolve, 520));
        reply = demoReply(city, scene, clean, level);
        setEngineNote("Demo director · intent read · world state updated");
      } else {
        reply = await askProvider(clean, nextMessages);
        if (provider === "local") {
          setLocalStatus("connected");
          setLocalMessage(`Connected · ${ollamaModel} generated this reply`);
        }
        setEngineNote(`${providerLabels[provider]} responded in ${((performance.now() - startedAt) / 1000).toFixed(1)}s · actions validated`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Ollama error";
      if (provider === "local") {
        setLocalStatus("error");
        setLocalMessage(`Ollama generation failed · ${detail}`);
      }
      const connectionMessage = provider === "local"
        ? `${ollamaModel} could not generate this turn: ${detail}`
        : "The hosted API model did not respond. Check the server model configuration and try again.";
      setMessages((current) => [...current, { id: messageId.current++, role: "system", text: connectionMessage, speaker: "System" }]);
      setEngineNote(`${providerLabels[provider]} unavailable · no scripted reply used`);
      addAgentEvent("model", `${providerLabels[provider]} connection failed`);
      setThinking(false);
      return;
    }

    const npcMessage: Message = {
      id: messageId.current++,
      role: "npc",
      text: reply.text,
      translation: level === "Advanced" ? undefined : reply.translation,
      speaker: scene.character,
    };
    setMessages((current) => [...current, npcMessage]);
    setAffinity((current) => Math.min(100, current + (asksQuestion ? 14 : 9)));
    setLearnerMemory((current) => ({
      ...current,
      attempts: current.attempts + 1,
      knownPhrases: [clean, ...current.knownPhrases.filter((phrase) => phrase !== clean)].slice(0, 8),
    }));

    const validTools = new Set(["set_waypoint", "remember_fact", "give_item", "complete_step"]);
    (reply.actions ?? []).filter((action) => validTools.has(action.tool)).slice(0, 2).forEach((action) => {
      addAgentEvent(action.tool, `${scene.character}: ${action.value}`);
    });

    const nextTurnCount = missionStepTurns + 1;
    const completesObjective = clean.length >= 8 && (asksQuestion || nextTurnCount >= 2);
    if (completesObjective && !questProgress[missionStepIndex]) {
      const completedStep = missionStep;
      const nextIndex = missionStepIndex + 1;
      setQuestProgress((current) => current.map((done, index) => index === missionStepIndex ? true : done));
      setMissionInventory((current) => Array.from(new Set([...current, completedStep.handoff, completedStep.reward])));
      addAgentEvent("complete_step", `Objective complete: ${completedStep.title}`);
      addAgentEvent("give_item", `Added ${completedStep.reward}`);
      if (nextIndex < mission.steps.length) {
        const nextStep = mission.steps[nextIndex];
        setMissionStepIndex(nextIndex);
        setMissionStepTurns(0);
        setSceneId(city.scenes[nextStep.npcIndex].id);
        addAgentEvent("set_waypoint", `Waypoint set: ${city.scenes[nextStep.npcIndex].character}`);
      } else {
        setMissionStepTurns(nextTurnCount);
        setLearnerMemory((current) => ({
          ...current,
          completedMissions: Array.from(new Set([...current.completedMissions, mission.id])),
        }));
        addAgentEvent("remember_fact", mission.finale);
      }
    } else {
      setMissionStepTurns(nextTurnCount);
      addAgentEvent("remember_fact", `Learner said: ${clean.slice(0, 52)}`);
    }
    setThinking(false);
    speak(reply.text);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitText(input);
  }

  function startListening() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
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
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setLastHeard(transcript);
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
              goal: `${mission.title}: ${mission.summary}. Completed ${completedQuests}/3 connected encounters.`,
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

  async function assessPronunciation(audio: Blob) {
    const phrase = city.prompts[pronunciationPrompt];
    const form = new FormData();
    form.append("audio", audio, "worldling-attempt.wav");
    form.append("referenceText", phrase);
    form.append("locale", city.locale);
    const endpoint = pronunciationProvider === "azure"
      ? "/api/pronunciation"
      : `${localPronunciationEndpoint.trim().replace(/\/$/, "")}/assess`;
    const response = await fetch(endpoint, { method: "POST", body: form });
    const payload = await response.json() as PronunciationResult & { error?: string; detail?: string };
    if (!response.ok) throw new Error(payload.error || payload.detail || "Pronunciation assessment failed.");
    setPronunciationResult(payload);
    setPronunciationBest((current) => ({ ...current, [phrase]: Math.max(current[phrase] ?? 0, payload.overall) }));
    const retryWords = payload.words.filter((word) => word.accuracy < 65).map((word) => word.word);
    setLearnerMemory((current) => ({
      ...current,
      focusWords: Array.from(new Set([...retryWords, ...current.focusWords])).slice(0, 8),
    }));
    addAgentEvent("remember_fact", retryWords.length ? `Coach saved focus: ${retryWords.slice(0, 3).join(", ")}` : "Coach marked this phrase secure");
    setPronunciationNote(payload.phonemeScoring
      ? `${pronunciationProvider === "local" ? "Local phoneme model" : "Azure Speech"} scored this attempt.`
      : "Intelligibility and timing were scored; phoneme scoring was unavailable for this attempt.");
  }

  async function finishPronunciationCapture() {
    const capture = pronunciationCaptureRef.current;
    if (!capture) return;
    pronunciationCaptureRef.current = null;
    if (pronunciationTimerRef.current) window.clearTimeout(pronunciationTimerRef.current);
    pronunciationTimerRef.current = null;
    setPronunciationRecording(false);
    setPronunciationBusy(true);
    setPronunciationNote("Analysing sounds, word timing, and completeness…");
    try {
      const audio = await capture.stop();
      if (audio.size < 1000) throw new Error("The recording was too short. Try speaking for at least one second.");
      if (lastAttemptUrl) URL.revokeObjectURL(lastAttemptUrl);
      setLastAttemptUrl(URL.createObjectURL(audio));
      await assessPronunciation(audio);
    } catch (error) {
      setPronunciationNote(error instanceof Error ? error.message : "Pronunciation assessment failed.");
    } finally {
      setPronunciationBusy(false);
    }
  }

  async function togglePronunciationRecording() {
    if (pronunciationRecording) {
      await finishPronunciationCapture();
      return;
    }
    setPronunciationResult(null);
    setPronunciationNote("Listening… read the highlighted phrase once.");
    try {
      pronunciationCaptureRef.current = await beginWavCapture();
      setPronunciationRecording(true);
      pronunciationTimerRef.current = window.setTimeout(() => void finishPronunciationCapture(), 12000);
    } catch {
      setPronunciationNote("Microphone access was not available. Allow microphone permission and try again.");
    }
  }

  function enterCity(nextCity: City) {
    setCityId(nextCity.id);
    setSceneId(nextCity.scenes[0].id);
    setPlayerPosition({ x: 50, y: 82 });
    setShowWorldPicker(false);
  }

  function chooseCity(nextCity: City) {
    if (provider === "local" && localStatus !== "connected") {
      setPendingCityId(nextCity.id);
      setLocalMessage(localStatus === "error" ? localMessage : "Test Ollama successfully before entering a district with Qwen.");
      setEngineNote(`${nextCity.name} queued · connect the local model to enter`);
      setShowEngine(true);
      return;
    }
    setPendingCityId(null);
    enterCity(nextCity);
  }

  function closeEngine() {
    setPendingCityId(null);
    setShowEngine(false);
  }

  function leaveStreet() {
    setShowPause(false);
    setShowPhrasebook(false);
    setShowWorldPicker(true);
  }

  function movePlayer(dx: number, dy: number) {
    setPlayerPosition((current) => clampToPlayableStreet({ x: current.x + dx, y: current.y + dy }));
  }

  function movePlayerTo(point: { x: number; y: number }) {
    setPlayerPosition(clampToPlayableStreet(point));
  }

  return (
    <main className="app-shell sadak-replace">
      <section className={`journey-section scene-${city.sceneClass}`} id="journey">
        <div className="journey-shell">
          <div className="play-world" aria-label={`Walkable scene in ${city.name}`}>
            <Suspense fallback={<div className="world3d-fallback">Building the city…</div>}>
              <World3D
                activeNpcIndex={activeNpcIndex}
                cityId={city.id}
                cityName={city.name}
                npcNames={city.scenes.map((person) => person.character)}
                npcPositions={npcPositions}
                onCameraDirectionChange={updateCameraDirection}
                onMoveTo={movePlayerTo}
                onSelectNpc={(index) => {
                  if (index === activeNpcIndex) setSceneId(city.scenes[index].id);
                  else addAgentEvent("set_waypoint", `${city.scenes[index].character} points you toward ${city.scenes[activeNpcIndex].character}`);
                }}
                playerPosition={playerPosition}
                sceneClass={city.sceneClass}
                latitude={cityCenter[0]}
                longitude={cityCenter[1]}
                waypointLabel={missionStep.title}
              />
            </Suspense>

            <div className="sadak-brand-hud" aria-label="Current district">
              <span className="sadak-wordmark"><b>W</b> WORLDLING</span>
              <div><strong>{city.name}</strong><small>{city.flag} {city.nativeLanguage} · {level}{FLAGSHIP_MISSIONS[city.id] ? " · FLAGSHIP STORY" : ""}</small></div>
              <button onClick={() => setShowWorldPicker(true)}>Change district</button>
            </div>

            {showWorldPicker && (
              <div className="sadak-world-picker" role="dialog" aria-modal="true" aria-labelledby="district-title">
                <section>
                  <header>
                    <div className="sadak-title-lockup"><span>W</span><div><strong>WORLDLING</strong><small>WALK · MEET · SPEAK</small></div></div>
                    <button onClick={() => setShowEngine(true)}><i className={`status-dot ${provider} ${provider === "local" ? localStatus : ""}`} />{provider === "local" ? ollamaModel : providerLabels[provider]}</button>
                  </header>
                  <div className="sadak-picker-heading">
                    <span>YOUR NEXT ERRAND</span>
                    <h1 id="district-title">Choose a district.</h1>
                    <p>Choose the AI that will play every local, then drop into the street.</p>
                  </div>
                  <div className="sadak-start-setup">
                    <div className="sadak-brain-picker" aria-label="Conversation AI">
                      {(["demo", "local", "api"] as Provider[]).map((option) => (
                        <button
                          key={option}
                          className={provider === option ? "active" : ""}
                          onClick={() => { setProvider(option); if (option === "local") setShowEngine(true); }}
                        >
                          <i>{option === "demo" ? "◎" : option === "local" ? "⌂" : "✦"}</i>
                          <span><strong>{option === "demo" ? "Demo" : option === "local" ? "Ollama / Qwen" : "Hosted API"}</strong><small>{option === "demo" ? "Scripted · offline" : option === "local" ? localStatus === "connected" ? `${ollamaModel} · connected` : localStatus === "error" ? "Connection failed · fix settings" : "Local LLM · test required" : "Server LLM · live"}</small></span>
                          <b>{provider === option ? "SELECTED" : "USE"}</b>
                        </button>
                      ))}
                    </div>
                    <div className="sadak-level-row" aria-label="Difficulty level">
                      {(["Beginner", "Intermediate", "Advanced"] as Level[]).map((option) => <button key={option} className={level === option ? "active" : ""} onClick={() => setLevel(option)}>{option}</button>)}
                    </div>
                  </div>
                  <div className="sadak-district-grid">
                    {CITIES.map((item, index) => (
                      <button key={item.id} className={item.id === city.id ? "active" : ""} onClick={() => chooseCity(item)}>
                        <span className={`district-cover cover-${item.sceneClass}`}><b>{String(index + 1).padStart(2, "0")}</b><i>{item.flag}</i></span>
                        <span className="district-copy"><small>{item.country.toUpperCase()}{FLAGSHIP_MISSIONS[item.id] ? " · FLAGSHIP" : ""}</small><strong>{item.name}</strong><em>{item.language} · {item.scenes.length} connected encounters</em></span>
                        <span className="district-progress">{stamps.includes(item.id) ? "✓" : "→"}</span>
                      </button>
                    ))}
                  </div>
                  <footer><span>{stamps.length}/{CITIES.length} DISTRICTS COMPLETE</span><i><b style={{ width: `${stamps.length / CITIES.length * 100}%` }} /></i><small>WASD to walk · E to talk · P for phrases</small></footer>
                </section>
              </div>
            )}

            {!showWorldPicker && (
              <div key={city.id} className="street-intro" aria-live="polite">
                <span>{city.flag} {city.country}</span>
                <h3>{city.name}</h3>
                <p>{mission.summary}</p>
                <div><kbd>WASD</kbd> move <kbd>SHIFT</kbd> run <kbd>P</kbd> phrases <kbd>ESC</kbd> pause</div>
              </div>
            )}

            <div className="game-mission glass-card">
              <span className="mission-icon">{completedQuests === 3 ? "✓" : "◎"}</span>
              <div>
                <small>MISSION · {mission.title.toUpperCase()} · {completedQuests}/3</small>
                <strong>{completedQuests === 3 ? mission.finale : missionStep.instruction}</strong>
                <span className="mission-steps" aria-label={`${completedQuests} of 3 mission steps complete`}>
                  {questProgress.map((done, index) => <i key={index} className={done ? "done" : index === missionStepIndex ? "current" : ""}>{done ? "✓" : index + 1}</i>)}
                </span>
              </div>
            </div>

            <aside className="agent-trace glass-card" aria-label="Agent activity">
              <header><span>LIVE AGENT</span><strong>{thinking ? "REASONING" : "WORLD STATE"}</strong></header>
              <div className="agent-trace-events">
                {agentEvents.map((event) => <p key={event.id}><i>{event.tool.replace("_", " ")}</i><span>{event.label}</span></p>)}
              </div>
              <footer><span>{missionInventory.length} items remembered</span><span>{learnerMemory.focusWords.length} focus sounds</span></footer>
            </aside>

            <div className="game-status glass-card">
              <span className={`model-chip ${provider}`} title={engineNote}>{provider === "local" ? `${ollamaModel} · local` : providerLabels[provider]}</span>
              <a href={streetViewUrl} target="_blank" rel="noreferrer">Real streets ↗</a>
              <button onClick={() => setShowPhrasebook(true)} aria-label="Open phrasebook">Phrases <kbd>P</kbd></button>
              <button onClick={() => setShowTranscript((current) => !current)}>{showTranscript ? "Close log" : "Log"}</button>
              <button onClick={() => setAutoSpeak((current) => !current)} aria-label={autoSpeak ? "Mute character voice" : "Enable character voice"}>{autoSpeak ? "Sound on" : "Muted"}</button>
              <button onClick={() => setShowPause(true)} aria-label="Open game menu">Menu</button>
            </div>

            {showPhrasebook && (
              <aside className="phrasebook-panel glass-card" role="dialog" aria-modal="true" aria-labelledby="phrasebook-title">
                <div className="overlay-head"><div><small>POCKET PHRASES · {city.language.toUpperCase()}</small><h3 id="phrasebook-title">Say something useful.</h3></div><button onClick={() => setShowPhrasebook(false)} aria-label="Close phrasebook">×</button></div>
                <p>Listen first, then place a phrase directly into the conversation bar.</p>
                <div className="phrasebook-list">
                  {city.prompts.map((prompt, index) => (
                    <article key={prompt}>
                      <span>0{index + 1}</span>
                      <strong>{prompt}</strong>
                      <div><button onClick={() => speak(prompt, true)}>Listen</button><button onClick={() => { setInput(prompt); setShowPhrasebook(false); window.setTimeout(() => worldInputRef.current?.focus(), 0); }}>Use phrase</button></div>
                    </article>
                  ))}
                </div>
                <small className="overlay-shortcut">Press P to close</small>
              </aside>
            )}

            {showPause && (
              <div className="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
                <section className="glass-card">
                  <small>WORLDLING · {city.name.toUpperCase()}</small>
                  <h3 id="pause-title">Street paused.</h3>
                  <p>Your conversation and mission progress stay on this device.</p>
                  <button className="primary" onClick={() => setShowPause(false)}>Resume street</button>
                  <button onClick={() => { setShowPause(false); setShowPhrasebook(true); }}>Open phrasebook</button>
                  <button onClick={() => setAutoSpeak((current) => !current)}>{autoSpeak ? "Mute character voice" : "Enable character voice"}</button>
                  <button onClick={() => { setShowPause(false); setShowEngine(true); }}>AI & voice settings</button>
                  <button className="danger" onClick={leaveStreet}>Choose another district</button>
                  <span><kbd>ESC</kbd> resume</span>
                </section>
              </div>
            )}

            {(thinking || (nearCharacter && currentNpcMessage)) && (
              <div className="world-dialogue glass-card" aria-live="polite">
                <span>{scene.avatar}</span>
                <div><small>{thinking ? `${scene.character} is thinking…` : currentNpcMessage?.speaker ?? scene.character}</small><p>{thinking ? "•••" : currentNpcMessage?.text}</p></div>
              </div>
            )}

            {!nearCharacter && <div className="approach-hint glass-card"><b>WAYPOINT</b> Move closer to {city.scenes[activeNpcIndex].character} · {waypointDistance}m</div>}

            <div className="movement-pad glass-card" aria-label="Movement controls">
              <button onClick={() => movePlayer(0, -5)} aria-label="Move up">↑</button>
              <button onClick={() => movePlayer(-5, 0)} aria-label="Move left">←</button>
              <button onClick={() => movePlayer(0, 5)} aria-label="Move down">↓</button>
              <button onClick={() => movePlayer(5, 0)} aria-label="Move right">→</button>
              <small>WASD</small>
            </div>

            <VirtualJoystick
              disabled={showPause || showPhrasebook || showWorldPicker || showEngine || showPronunciation}
              onMove={(x, y) => movePlayer(x * 1.15, y * 1.15)}
            />

            <div className="game-minimap glass-card" aria-label="Street radar">
              <i className="radar-road horizontal" /><i className="radar-road vertical" />
              {npcPositions.map((position, index) => <span key={city.scenes[index].id} className={index === activeNpcIndex ? "npc-dot active" : "npc-dot"} style={{ left: `${position.x}%`, top: `${position.y}%` }} />)}
              <b style={{ left: `${playerPosition.x}%`, top: `${playerPosition.y}%` }}>▲</b>
              <small>{city.name}</small>
            </div>

            {showTranscript && (
              <aside className="transcript-drawer glass-card">
                <div><strong>Conversation</strong><button onClick={() => setShowTranscript(false)}>×</button></div>
                <div className="messages">
                  {messages.map((message) => (
                    <article key={message.id} className={`message ${message.role}`}>
                      <span className="speaker">{message.role === "npc" ? message.speaker ?? "Local" : message.role === "system" ? "System" : "You"}</span>
                      <div><p>{message.text}</p>{message.translation && city.locale !== "en-US" && <small>{message.translation}</small>}</div>
                    </article>
                  ))}
                </div>
              </aside>
            )}

            <div className={`voice-hud glass-card ${nearCharacter ? "engaged" : "roaming"}`}>
              <div className="voice-context">
                <span>{scene.avatar}</span>
                <div><small>{nearCharacter ? `TALKING TO ${scene.character.toUpperCase()} · BOND ${affinity}%` : "EXPLORE THE SCENE"}</small><strong>{nearCharacter ? `Speak naturally in ${city.language}` : "Use WASD or the arrows to move"}</strong></div>
              </div>
              {lastHeard && <div className="voice-heard"><span>MIC HEARD</span><p>{lastHeard}</p></div>}
              <form onSubmit={handleSubmit}>
                <button
                  type="button"
                  className={listening ? "world-mic listening" : "world-mic"}
                  disabled={!nearCharacter || thinking}
                  onClick={() => listening ? recognitionRef.current?.stop() : startListening()}
                  aria-label={listening ? "Stop listening" : `Speak to ${scene.character} in ${city.language}`}
                >
                  <span>●</span>{listening ? "Listening" : "Tap to speak"}
                </button>
                <div className="world-text-entry">
                  <input ref={worldInputRef} value={input} disabled={!nearCharacter || thinking} onChange={(event) => setInput(event.target.value)} placeholder={nearCharacter ? "Or type what you want to say…" : `Walk closer to ${scene.character}`} />
                  <button type="submit" disabled={!nearCharacter || !input.trim() || thinking}>↑</button>
                </div>
              </form>
              <div className="voice-actions">
                <button onClick={() => setShowPronunciation(true)}>Pronunciation</button>
                <button onClick={() => void finishConversation()}>Finish & grade</button>
              </div>
              <div className="suggestion-strip">
                {city.prompts.map((prompt) => <button key={prompt} disabled={!nearCharacter} onClick={() => setInput(prompt)}>{prompt}</button>)}
              </div>
            </div>
          </div>
        </div>
      </section>

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
            <button className="replay-button" onClick={() => { setMessages([cityWelcome(city, level)]); setEvaluation(null); setReward(null); setRewarded(false); setQuestProgress([false, false, false]); setMissionStepIndex(0); setMissionStepTurns(0); setMissionInventory([]); setSceneId(city.scenes[0].id); setAffinity(12); addAgentEvent("set_waypoint", `Mission restarted at ${city.scenes[0].character}`); }}>Replay the mission</button>
          </section>
        </div>
      )}

      {showPronunciation && (
        <div className="modal-backdrop pronunciation-backdrop" role="presentation" onClick={() => { if (!pronunciationRecording) setShowPronunciation(false); }}>
          <section className="pronunciation-sheet" role="dialog" aria-modal="true" aria-labelledby="pronunciation-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" disabled={pronunciationRecording} onClick={() => setShowPronunciation(false)} aria-label="Close pronunciation lab">×</button>
            <span className="score-kicker">ACOUSTIC MISSION · {city.flag} {city.name.toUpperCase()}</span>
            <h2 id="pronunciation-title">Make every sound land.</h2>
            <p className="pronunciation-intro">Read one known phrase. Unlike conversation grading, this mission sends the recording to a speech model and scores the audio itself.</p>

            <div className="pronunciation-providers" aria-label="Pronunciation provider">
              <button disabled={pronunciationRecording || pronunciationBusy} className={pronunciationProvider === "local" ? "active" : ""} onClick={() => { setPronunciationProvider("local"); setPronunciationResult(null); }}>
                <strong>⌂ Local lab</strong><small>Whisper + phoneme model</small>
              </button>
              <button disabled={pronunciationRecording || pronunciationBusy} className={pronunciationProvider === "azure" ? "active" : ""} onClick={() => { setPronunciationProvider("azure"); setPronunciationResult(null); }}>
                <strong>☁ Azure Speech</strong><small>Production assessment API</small>
              </button>
            </div>

            {pronunciationProvider === "local" && (
              <label className="pronunciation-endpoint">Local service address<input value={localPronunciationEndpoint} disabled={pronunciationRecording || pronunciationBusy} onChange={(event) => setLocalPronunciationEndpoint(event.target.value)} /></label>
            )}

            <div className="phrase-selector">
              <span>CHOOSE A LINE</span>
              <div>{city.prompts.map((prompt, index) => <button disabled={pronunciationRecording || pronunciationBusy} className={pronunciationPrompt === index ? "active" : ""} key={prompt} onClick={() => { setPronunciationPrompt(index); setPronunciationResult(null); }}>{index + 1}</button>)}</div>
            </div>
            <div className="target-phrase">
              <span>TARGET · {city.language.toUpperCase()}</span>
              <strong>{city.prompts[pronunciationPrompt]}</strong>
              <button onClick={() => speak(city.prompts[pronunciationPrompt], true)}>Listen ↗</button>
            </div>

            <button className={`record-pronunciation ${pronunciationRecording ? "recording" : ""}`} disabled={pronunciationBusy} onClick={() => void togglePronunciationRecording()}>
              <i>{pronunciationBusy ? "◌" : pronunciationRecording ? "■" : "●"}</i>
              <span><strong>{pronunciationBusy ? "Scoring attempt" : pronunciationRecording ? "Stop and score" : "Record attempt"}</strong><small>{pronunciationRecording ? "Maximum 12 seconds" : "Audio is used only for this assessment"}</small></span>
            </button>
            <p className="pronunciation-note" aria-live="polite">{pronunciationNote}</p>

            {pronunciationResult && (
              <div className="pronunciation-result">
                <div className="pronunciation-score">
                  <strong>{pronunciationResult.overall}</strong><span>/100</span><small>{pronunciationResult.phonemeScoring ? "ACOUSTIC SCORE" : "INTELLIGIBILITY SCORE"}</small>
                </div>
                <div className="pronunciation-metrics">
                  {(["accuracy", "fluency", "completeness"] as const).map((metric) => (
                    <div key={metric}><span>{metric}</span><i><b style={{ width: `${pronunciationResult[metric]}%` }} /></i><strong>{pronunciationResult[metric]}</strong></div>
                  ))}
                  {typeof pronunciationResult.prosody === "number" && <div><span>prosody</span><i><b style={{ width: `${pronunciationResult.prosody}%` }} /></i><strong>{pronunciationResult.prosody}</strong></div>}
                </div>
                <div className="recognized-line"><span>MODEL HEARD</span><p>{pronunciationResult.recognizedText || "No clear words detected."}</p></div>
                <div className="attempt-review">
                  {lastAttemptUrl && <audio controls src={lastAttemptUrl} preload="metadata" aria-label="Replay your pronunciation attempt" />}
                  <span>BEST {pronunciationBest[city.prompts[pronunciationPrompt]] ?? pronunciationResult.overall}/100</span>
                  {weakestWord && <button onClick={() => speak(weakestWord.word, true)}>Hear “{weakestWord.word}” again</button>}
                </div>
                <div className="word-heatmap" aria-label="Word accuracy scores">
                  {pronunciationResult.words.map((word, index) => <span key={`${word.word}-${index}`} className={word.accuracy >= 80 ? "good" : word.accuracy >= 55 ? "close" : "retry"} title={`${word.accuracy}/100 · ${word.errorType}`}>{word.word}<small>{word.accuracy}</small></span>)}
                </div>
                <div className="pronunciation-feedback"><span>COACHING NOTE</span><p>{pronunciationResult.feedback}</p></div>
                {!pronunciationResult.phonemeScoring && pronunciationProvider === "local" && <p className="phoneme-warning">Install the optional Allosaurus and Epitran packages for phoneme-level scoring. The current result uses Whisper intelligibility and timing.</p>}
              </div>
            )}
          </section>
        </div>
      )}

      {showEngine && (
        <div className="modal-backdrop engine-backdrop" role="presentation" onClick={closeEngine}>
          <section className="engine-sheet" role="dialog" aria-modal="true" aria-labelledby="engine-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={closeEngine} aria-label="Close engine settings">×</button>
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
                <div className="origin-help">
                  <strong>One-time setup for this hosted game</strong>
                  <ol>
                    <li>Start Ollama and run <code>ollama pull {ollamaModel || "qwen3:8b"}</code></li>
                    <li>On Windows run <code>setx OLLAMA_ORIGINS &quot;https://worldling-sadak-game.vercel.app&quot;</code></li>
                    <li>Fully restart Ollama, then press Test connection.</li>
                  </ol>
                  <p><b>Fast local mode:</b> hidden reasoning off · shorter replies · 4K context · model kept warm for 30 minutes.</p>
                </div>
              </div>
            ) : (
              <div className="config-note">
                <strong>{provider === "api" ? "API setup" : "Demo setup"}</strong>
                <p>{provider === "api" ? "Set OPENAI_API_KEY and OPENAI_MODEL on the server. Keys are never requested by or exposed to the browser." : "No setup. Responses and scores use transparent prototype rules so every interaction is testable."}</p>
              </div>
            )}
            <button
              className="sheet-done"
              disabled={provider === "local" && localStatus !== "connected"}
              onClick={() => {
                const pendingCity = CITIES.find((item) => item.id === pendingCityId);
                if (pendingCity) enterCity(pendingCity);
                setPendingCityId(null);
                setShowEngine(false);
              }}
            >{provider === "local" && localStatus !== "connected" ? "Test Ollama to continue" : pendingCityId ? `Enter ${CITIES.find((item) => item.id === pendingCityId)?.name ?? "district"}` : `Continue with ${providerLabels[provider]}`}</button>
          </section>
        </div>
      )}
    </main>
  );
}
