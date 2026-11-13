import type {
  EmotionStyleDefinition,
  LanguageDefinition,
  QuotaConfig,
  TtsModelId,
  VoiceDefinition,
} from '../src/types/voxcraft.ts';

/**
 * Central administrator configuration for VoxCraft AI free tier quotas & limits.
 * Adjust these values here without rewriting application endpoints.
 */
export const MAX_SCRIPT_WORDS = 2000;

export const FREE_QUOTA_CONFIG: QuotaConfig = {
  dailyCharacterLimit: Number(process.env.VOXCRAFT_DAILY_CHAR_LIMIT || 100000),
  dailyGenerationLimit: Number(process.env.VOXCRAFT_DAILY_GEN_LIMIT || 60),
  maxCharsPerRequest: Number(process.env.VOXCRAFT_MAX_CHARS_PER_REQ || 20000),
  rateLimitWindowSeconds: 60,
  rateLimitMaxRequests: Number(process.env.VOXCRAFT_RATE_LIMIT_MAX || 24),
};

export const PRO_QUOTA_CONFIG: QuotaConfig = {
  dailyCharacterLimit: Number(process.env.VOXCRAFT_PRO_DAILY_CHAR_LIMIT || 1000000),
  dailyGenerationLimit: Number(process.env.VOXCRAFT_PRO_DAILY_GEN_LIMIT || 400),
  maxCharsPerRequest: Number(process.env.VOXCRAFT_MAX_CHARS_PER_REQ || 20000),
  rateLimitWindowSeconds: 60,
  rateLimitMaxRequests: 60,
};

export const PLAN_TIERS = [
  {
    id: 'free' as const,
    name: 'Free Studio',
    priceLabel: '$0 / Free (Ad-Supported)',
    status: 'active' as const,
    dailyCharacterLimit: FREE_QUOTA_CONFIG.dailyCharacterLimit,
    maxWordsPerScript: MAX_SCRIPT_WORDS,
    adSupported: true,
    highlights: [
      '100,000 characters & 60 audio generations daily',
      'Up to 2,000 words per voiceover or script',
      'All Gemini 3.8 TTS voices, WAV & MP3 export',
      'Supported by non-intrusive Google AdSense display ads',
    ],
  },
  {
    id: 'pro' as const,
    name: 'VoxCraft Pro',
    priceLabel: 'Future Upgrade',
    status: 'coming-soon' as const,
    dailyCharacterLimit: PRO_QUOTA_CONFIG.dailyCharacterLimit,
    maxWordsPerScript: MAX_SCRIPT_WORDS,
    adSupported: false,
    highlights: [
      'Completely ad-free production workspace',
      '1,000,000 characters & 400 generations daily',
      'Priority batch synthesis for long audiobooks & agencies',
      'Early access notification when billing launches',
    ],
  },
];

export const ADSENSE_CONFIG = {
  publisherId: (process.env.ADSENSE_PUBLISHER_ID || 'ca-pub-1059513612077779').trim(),
  rewardedAdUnitPath: (process.env.GAM_REWARDED_AD_UNIT || '').trim(),
  get enabled() {
    return Boolean(this.publisherId && this.publisherId.startsWith('ca-pub-'));
  },
  get rewardedEnabled() {
    return Boolean(this.rewardedAdUnitPath);
  },
};

export const TEXT_GENERATION_MODEL = 'gemini-4-hydrogen';

export const TTS_MODELS: {
  id: TtsModelId;
  label: string;
  description: string;
  supportsMultiSpeaker: boolean;
  supportsVoiceDesign: boolean;
}[] = [
  {
    id: 'gemini-3.8-flash-tts',
    label: 'Gemini 3.8 Flash TTS (Flagship Studio)',
    description:
      'Flagship model for Voice Design, expressive delivery, dual-speaker conversations, backchanneling, and nuanced narration.',
    supportsMultiSpeaker: true,
    supportsVoiceDesign: true,
  },
  {
    id: 'gemini-3.8-flash-lite-tts',
    label: 'Gemini 3.8 Flash Lite TTS (Fast & Efficient)',
    description:
      'Low-latency, cost-efficient model ideal for fast article reading, high-throughput voiceovers, and general narration.',
    supportsMultiSpeaker: false,
    supportsVoiceDesign: false,
  },
];

/**
 * Verified prebuilt voice identifiers supported by Gemini 3.8 TTS models.
 */
export const VERIFIED_VOICES: VoiceDefinition[] = [
  {
    id: 'Kore',
    name: 'Kore',
    genderLabel: 'Female',
    categories: ['Female', 'Professional', 'Conversational', 'Expressive'],
    timbre: 'Clear, poised, articulated mid-register',
    bestFor: 'Explainers, corporate ads, news narration, and co-hosting',
    sampleLine: 'Welcome to VoxCraft AI. Every word you write deserves a clear, natural voice.',
    modelCompatibility: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
  },
  {
    id: 'Puck',
    name: 'Puck',
    genderLabel: 'Male',
    categories: ['Male', 'Conversational', 'Expressive', 'Storytelling'],
    timbre: 'Warm, energetic, engaging baritone-tenor',
    bestFor: 'YouTube intros, creator scripts, podcasts, and lively promos',
    sampleLine: 'Ready to turn your script into studio-ready audio in just a few seconds?',
    modelCompatibility: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
  },
  {
    id: 'Charon',
    name: 'Charon',
    genderLabel: 'Male',
    categories: ['Male', 'Professional', 'Storytelling'],
    timbre: 'Deep, grounded, measured narrator resonance',
    bestFor: 'Documentaries, audiobooks, luxury brand adverts, and serious commentary',
    sampleLine: 'In every great documentary, the pacing of the voice carries the weight of the story.',
    modelCompatibility: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    genderLabel: 'Male',
    categories: ['Male', 'Expressive', 'Storytelling', 'Conversational'],
    timbre: 'Dynamic, textured, commanding vocal presence',
    bestFor: 'Trailers, high-energy campaigns, dramatic audiobooks, and debates',
    sampleLine: 'Do not settle for flat narration when your story calls for real momentum.',
    modelCompatibility: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    genderLabel: 'Neutral',
    categories: ['Neutral', 'Female', 'Conversational', 'Storytelling', 'Professional'],
    timbre: 'Balanced, calm, bright and approachable tone',
    bestFor: 'Educational lessons, guided narration, multilingual reads, and calm tutorials',
    sampleLine: 'Take a steady breath and follow along as we break down each concept step by step.',
    modelCompatibility: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
  },
];

export const EMOTION_STYLES: EmotionStyleDefinition[] = [
  {
    id: 'natural',
    label: 'Natural / Balanced',
    instruction: 'Clear, natural, balanced studio delivery',
    description: 'Clean baseline studio reading with natural pacing',
  },
  {
    id: 'professional',
    label: 'Professional',
    instruction: 'Confident, articulate, polished corporate presenter',
    description: 'Ideal for business presentations, B2B explainers, and training',
  },
  {
    id: 'storytelling',
    label: 'Storytelling',
    instruction: 'Warm, immersive, descriptive audiobook storyteller with natural pauses',
    description: 'Rich pacing for audiobooks, documentaries, and narratives',
  },
  {
    id: 'news',
    label: 'News Presentation',
    instruction: 'Crisp, authoritative, neutral broadcast news anchor',
    description: 'Broadcast cadence for news updates and commentary',
  },
  {
    id: 'conversational',
    label: 'Friendly & Conversational',
    instruction: 'Warm, relaxed, conversational friend speaking naturally',
    description: 'Approachable tone for podcasts and social media',
  },
  {
    id: 'persuasive',
    label: 'Persuasive',
    instruction: 'Compelling, trustworthy, persuasive advertising announcer',
    description: 'Designed for product launches and promotional spots',
  },
  {
    id: 'excited',
    label: 'Excited',
    instruction: 'Upbeat, bright, enthusiastic and genuinely excited delivery',
    description: 'High energy for hooks, giveaways, and event promos',
  },
  {
    id: 'energetic',
    label: 'Energetic',
    instruction: 'Fast-moving, vibrant, high-momentum creator delivery',
    description: 'Built for short-form reels, TikTok, and dynamic intros',
  },
  {
    id: 'happy',
    label: 'Happy',
    instruction: 'Cheerful, smiling, bright and uplifting tone',
    description: 'Warm positivity for lifestyle and community content',
  },
  {
    id: 'calm',
    label: 'Calm',
    instruction: 'Soft, unhurried, soothing and composed voice',
    description: 'Gentle cadence for educational guides and reflective narration',
  },
  {
    id: 'serious',
    label: 'Serious',
    instruction: 'Measured, solemn, authoritative and focused delivery',
    description: 'Weighty tone for investigative topics and formal notices',
  },
  {
    id: 'emotional',
    label: 'Emotional',
    instruction: 'Heartfelt, expressive, deeply empathetic human delivery',
    description: 'Sensitive expression for drama, poetry, and testimonials',
  },
  {
    id: 'sad',
    label: 'Sad / Reflective',
    instruction: 'Subdued, melancholic, gentle and reflective cadence',
    description: 'Somber tone for poignant stories and dramatic scenes',
  },
  {
    id: 'inspirational',
    label: 'Inspirational',
    instruction: 'Uplifting, resonant, motivational keynote speaker',
    description: 'Strong resonance for motivational videos and speeches',
  },
];

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
  {
    code: 'en-US',
    name: 'English (International)',
    region: 'Global',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 TTS support across all 5 prebuilt voices',
    recommendedVoiceIds: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'],
    styleHint: 'Standard international English studio pronunciation',
    sampleText:
      'VoxCraft AI helps creators, educators, and businesses produce studio-quality voiceovers in minutes.',
  },
  {
    code: 'en-NG',
    name: 'Nigerian English',
    region: 'West Africa',
    isAfricanCollection: true,
    supportTier: 'style-guided',
    availabilityNote:
      'Style-guided regional cadence via Gemini 3.8 TTS Voice Design (not a separate native accent ID)',
    recommendedVoiceIds: ['Puck', 'Kore', 'Charon'],
    styleHint: 'Educated Nigerian English cadence and warm West African rhythm, clear and natural',
    sampleText:
      'Welcome to Lagos Creative Radio. Today we are sharing how digital creators across Nigeria tell stories that reach the whole world.',
  },
  {
    code: 'en-GH',
    name: 'Ghanaian English',
    region: 'West Africa',
    isAfricanCollection: true,
    supportTier: 'style-guided',
    availabilityNote:
      'Style-guided regional cadence via Gemini 3.8 TTS Voice Design (uses prebuilt base voices)',
    recommendedVoiceIds: ['Kore', 'Zephyr', 'Puck'],
    styleHint: 'Warm Ghanaian English cadence, measured and articulate West African delivery',
    sampleText:
      'Good morning from Accra. Let us explore practical ways small businesses can connect with local and global customers.',
  },
  {
    code: 'en-ZA',
    name: 'South African English',
    region: 'Southern Africa',
    isAfricanCollection: true,
    supportTier: 'style-guided',
    availabilityNote:
      'Style-guided regional cadence via Gemini 3.8 TTS Voice Design (uses prebuilt base voices)',
    recommendedVoiceIds: ['Charon', 'Kore', 'Zephyr'],
    styleHint: 'Crisp South African English broadcast articulation',
    sampleText:
      'From Cape Town to Johannesburg, independent publishers are bringing local stories to listeners everywhere.',
  },
  {
    code: 'en-KE',
    name: 'Kenyan English',
    region: 'East Africa',
    isAfricanCollection: true,
    supportTier: 'style-guided',
    availabilityNote:
      'Style-guided regional cadence via Gemini 3.8 TTS Voice Design (uses prebuilt base voices)',
    recommendedVoiceIds: ['Zephyr', 'Kore', 'Puck'],
    styleHint: 'Clear East African Kenyan English cadence, warm and approachable',
    sampleText:
      'Welcome to Nairobi Tech Brief. Today we look at how educators are scaling audio lessons for mobile learners.',
  },
  {
    code: 'sw',
    name: 'Swahili (Kiswahili)',
    region: 'East Africa',
    isAfricanCollection: true,
    supportTier: 'multilingual-native',
    availabilityNote: 'Multilingual Gemini TTS rendering; verify specialized regional terms in preview',
    recommendedVoiceIds: ['Kore', 'Puck', 'Zephyr'],
    styleHint: 'Natural Kiswahili pronunciation and clear syllable pacing',
    sampleText:
      'Karibu kwenye VoxCraft AI. Sasa unaweza kubadilisha maandishi kuwa sauti ya asili kwa urahisi na haraka.',
  },
  {
    code: 'yo',
    name: 'Yoruba',
    region: 'West Africa',
    isAfricanCollection: true,
    supportTier: 'pronunciation-guided',
    availabilityNote:
      'Experimental tonal pronunciation via multilingual Gemini TTS; use diacritics and Pronunciation Assistant for best results',
    recommendedVoiceIds: ['Kore', 'Puck'],
    styleHint: 'Careful Yoruba tonal articulation with steady phrasing',
    sampleText:
      'Ẹ kú àbọ̀ sí VoxCraft AI. Ẹ lè ṣẹ̀dá ohùn tó dára fún ìtàn àti ìpolówó lórí ẹ̀rọ ayélujára.',
  },
  {
    code: 'ha',
    name: 'Hausa',
    region: 'West Africa',
    isAfricanCollection: true,
    supportTier: 'pronunciation-guided',
    availabilityNote:
      'Experimental multilingual rendering; preview output and refine spelling with Pronunciation Control',
    recommendedVoiceIds: ['Charon', 'Kore'],
    styleHint: 'Clear Hausa pronunciation with steady broadcast pacing',
    sampleText:
      'Barka da zuwa VoxCraft AI. Za ka iya mayar da rubutu zuwa murya mai kyau cikin sauƙi.',
  },
  {
    code: 'ig',
    name: 'Igbo',
    region: 'West Africa',
    isAfricanCollection: true,
    supportTier: 'pronunciation-guided',
    availabilityNote:
      'Experimental multilingual rendering; tonal marks and Pronunciation Control guidance recommended',
    recommendedVoiceIds: ['Puck', 'Kore'],
    styleHint: 'Respectful Igbo phrasing and deliberate tonal pacing',
    sampleText:
      'Nnọọ na VoxCraft AI. Anyị na-enyere gị aka ịgbanwe ederede ka ọ bụrụ olu doro anya.',
  },
  {
    code: 'zu',
    name: 'isiZulu',
    region: 'Southern Africa',
    isAfricanCollection: true,
    supportTier: 'pronunciation-guided',
    availabilityNote:
      'Experimental multilingual rendering; review click consonants and proper nouns in preview',
    recommendedVoiceIds: ['Charon', 'Zephyr'],
    styleHint: 'Clear isiZulu pronunciation and measured pacing',
    sampleText:
      'Siyakwamukela ku-VoxCraft AI. Guqula umbhalo ube yizwi elicacile ngokushesha.',
  },
  {
    code: 'fr',
    name: 'French (Français)',
    region: 'Europe & Francophone Africa',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Kore', 'Charon', 'Zephyr'],
    styleHint: 'Natural French articulation and liaison',
    sampleText:
      'Bienvenue sur VoxCraft AI. Transformez vos textes en voix off naturelles et expressives en quelques instants.',
  },
  {
    code: 'es',
    name: 'Spanish (Español)',
    region: 'Europe & Americas',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Puck', 'Kore', 'Fenrir'],
    styleHint: 'Natural Spanish pronunciation with clear intonation',
    sampleText:
      'Bienvenido a VoxCraft AI. Convierte tus guiones en narraciones profesionales en varios idiomas.',
  },
  {
    code: 'pt',
    name: 'Portuguese (Português)',
    region: 'Americas, Europe & Lusophone Africa',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Kore', 'Puck', 'Zephyr'],
    styleHint: 'Natural Portuguese pronunciation and smooth cadence',
    sampleText:
      'Bem-vindo ao VoxCraft AI. Crie locuções profissionais para vídeos, anúncios e audiolivros.',
  },
  {
    code: 'de',
    name: 'German (Deutsch)',
    region: 'Europe',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Charon', 'Kore', 'Zephyr'],
    styleHint: 'Clear standard German pronunciation',
    sampleText:
      'Willkommen bei VoxCraft AI. Erstellen Sie klare Sprachaufnahmen für Videos, Hörbücher und Werbung.',
  },
  {
    code: 'it',
    name: 'Italian (Italiano)',
    region: 'Europe',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Puck', 'Kore', 'Charon'],
    styleHint: 'Expressive standard Italian pronunciation',
    sampleText:
      'Benvenuto in VoxCraft AI. Dai voce alle tue storie con una narrazione naturale e coinvolgente.',
  },
  {
    code: 'ar',
    name: 'Arabic (العربية)',
    region: 'Middle East & North Africa',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support (Modern Standard Arabic)',
    recommendedVoiceIds: ['Charon', 'Kore', 'Zephyr'],
    styleHint: 'Clear Modern Standard Arabic pronunciation',
    sampleText:
      'مرحبًا بكم في VoxCraft AI. حوّل نصوصك إلى تعليق صوتي احترافي وواضح بكل سهولة.',
  },
  {
    code: 'hi',
    name: 'Hindi (हिन्दी)',
    region: 'South Asia',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Kore', 'Puck', 'Zephyr'],
    styleHint: 'Natural Hindi pronunciation and warm rhythm',
    sampleText:
      'VoxCraft AI में आपका स्वागत है। अपने शब्दों को प्राकृतिक और प्रभावशाली आवाज़ में बदलें।',
  },
  {
    code: 'zh',
    name: 'Chinese (Mandarin 中文)',
    region: 'East Asia',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Kore', 'Zephyr', 'Charon'],
    styleHint: 'Clear Mandarin Chinese tonal articulation',
    sampleText:
      '欢迎使用 VoxCraft AI。轻松将您的文字转化为自然流畅的专业配音。',
  },
  {
    code: 'ja',
    name: 'Japanese (日本語)',
    region: 'East Asia',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Kore', 'Zephyr', 'Puck'],
    styleHint: 'Natural Japanese pitch accent and smooth pacing',
    sampleText:
      'VoxCraft AIへようこそ。あなたの言葉を自然で表現力豊かな音声に変えましょう。',
  },
  {
    code: 'ko',
    name: 'Korean (한국어)',
    region: 'East Asia',
    isAfricanCollection: false,
    supportTier: 'multilingual-native',
    availabilityNote: 'Full Gemini 3.8 multilingual TTS support',
    recommendedVoiceIds: ['Kore', 'Zephyr', 'Puck'],
    styleHint: 'Natural Korean articulation and studio intonation',
    sampleText:
      'VoxCraft AI에 오신 것을 환영합니다. 텍스트를 자연스럽고 생생한 음성으로 만들어 보세요.',
  },
];

export function isValidVoiceId(voiceId: string): boolean {
  return VERIFIED_VOICES.some((v) => v.id === voiceId);
}

export function getLanguageByCode(code: string): LanguageDefinition | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function getEmotionById(id: string): EmotionStyleDefinition | undefined {
  return EMOTION_STYLES.find((e) => e.id === id);
}
