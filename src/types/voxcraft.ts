export type StudioView =
  | 'dashboard'
  | 'tts'
  | 'script-writer'
  | 'youtube'
  | 'advert'
  | 'translate'
  | 'conversation'
  | 'audiobook'
  | 'audio-editor'
  | 'voice-library'
  | 'projects'
  | 'history'
  | 'settings'
  | 'help';

export type AudioFormat = 'wav' | 'mp3';

export type TtsModelId = 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts';

export type VoiceCategory =
  | 'Male'
  | 'Female'
  | 'Neutral'
  | 'Storytelling'
  | 'Professional'
  | 'Conversational'
  | 'Expressive';

export interface VoiceDefinition {
  id: string; // Actual Gemini prebuiltVoiceConfig voiceName: Kore, Puck, Charon, Fenrir, Zephyr
  name: string;
  genderLabel: 'Male' | 'Female' | 'Neutral';
  categories: VoiceCategory[];
  timbre: string;
  bestFor: string;
  sampleLine: string;
  modelCompatibility: TtsModelId[];
}

export type LanguageSupportTier = 'multilingual-native' | 'style-guided' | 'pronunciation-guided';

export interface LanguageDefinition {
  code: string;
  name: string;
  region: string;
  isAfricanCollection: boolean;
  supportTier: LanguageSupportTier;
  availabilityNote: string;
  recommendedVoiceIds: string[];
  styleHint: string;
  sampleText: string;
}

export interface EmotionStyleDefinition {
  id: string;
  label: string;
  instruction: string;
  description: string;
}

export interface QuotaConfig {
  dailyCharacterLimit: number;
  dailyGenerationLimit: number;
  maxCharsPerRequest: number;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
}

export type PlanTier = 'free' | 'pro';

export interface PlanTierDefinition {
  id: PlanTier;
  name: string;
  priceLabel: string;
  status: 'active' | 'coming-soon';
  dailyCharacterLimit: number;
  maxWordsPerScript: number;
  adSupported: boolean;
  highlights: string[];
}

export interface AdSensePublicConfig {
  enabled: boolean;
  publisherIdConfigured: boolean;
  publisherId?: string;
  mode: 'disabled-pending-approval' | 'active';
  rewardedAdUnitConfigured: boolean;
}

export interface PublicAppConfig {
  voices: VoiceDefinition[];
  languages: LanguageDefinition[];
  emotionStyles: EmotionStyleDefinition[];
  ttsModels: {
    id: TtsModelId;
    label: string;
    description: string;
    supportsMultiSpeaker: boolean;
    supportsVoiceDesign: boolean;
  }[];
  quotas: QuotaConfig;
  plans: PlanTierDefinition[];
  proSubscriptionsEnabled: boolean;
  adsense: AdSensePublicConfig;
  supportedFormats: AudioFormat[];
}

export interface UsageQuotaState {
  planTier: PlanTier;
  charactersUsedToday: number;
  bonusCharactersToday: number;
  charactersRemainingToday: number;
  generationsToday: number;
  generationsRemainingToday: number;
  totalGeneratedAudioCount: number;
  dailyCharacterLimit: number;
  effectiveDailyCharacterLimit: number;
  dailyGenerationLimit: number;
  maxCharsPerRequest: number;
  resetNote: string;
}

export interface UserSession {
  userId: string;
  isAuthenticated: boolean;
  email: string | null;
  displayName: string;
  planTier: PlanTier;
  onProWaitlist: boolean;
  preferredVoiceId: string;
  preferredLanguageCode: string;
  preferredFormat: AudioFormat;
  preferredModel: TtsModelId;
}

export interface GeneratedAudioClip {
  id: string;
  title: string;
  audioBase64: string;
  mimeType: string;
  format: AudioFormat;
  durationSeconds: number;
  voiceId: string;
  languageCode: string;
  modelId: TtsModelId;
  textSnippet: string;
  createdAt: string;
}

export type ProjectType =
  | 'tts'
  | 'script'
  | 'youtube'
  | 'advert'
  | 'translation'
  | 'conversation'
  | 'audiobook'
  | 'edited-audio';

export interface SavedProject {
  id: string;
  title: string;
  type: ProjectType;
  languageCode: string;
  voiceId: string;
  content: string;
  payload: Record<string, unknown>;
  audioId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  kind: 'audio' | 'script' | 'translation';
  title: string;
  summary: string;
  languageCode: string;
  voiceId?: string;
  modelId?: string;
  charCount: number;
  format?: AudioFormat;
  durationSeconds?: number;
  audioBase64?: string;
  mimeType?: string;
  createdAt: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  voiceId: string;
  languageCode: string;
  emotionId: string;
  speed: string;
  customStyle: string;
  modelId: TtsModelId;
  createdAt: string;
}

export interface PronunciationTip {
  word: string;
  phoneticGuide: string;
  instructionNote: string;
  replacementSuggestions: string[];
}

export interface ScriptOutput {
  hook: string;
  mainContent: string;
  transitions: string;
  ending: string;
  callToAction: string;
  fullScript: string;
  estimatedDurationSeconds: number;
  wordCount: number;
}

export interface EditorClip {
  id: string;
  title: string;
  audioBase64: string;
  mimeType: string;
  durationSeconds: number;
  startOffsetSeconds: number;
  volume: number; // 0 to 1.5
  fadeInSeconds: number;
  fadeOutSeconds: number;
  waveformPeaks: number[];
}

export interface ConversationLine {
  id: string;
  speakerId: string;
  text: string;
  styleNote?: string;
}

export interface ConversationSpeaker {
  id: string;
  name: string;
  voiceId: string;
  roleDescription: string;
}

export interface AudiobookChapter {
  id: string;
  title: string;
  text: string;
  voiceId: string;
  languageCode: string;
  status: 'idle' | 'generating' | 'done' | 'error';
  completedChunks: number;
  totalChunks: number;
  errorMessage?: string;
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
}
