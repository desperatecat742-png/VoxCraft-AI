import type {
  AudioFormat,
  HistoryItem,
  PronunciationTip,
  PublicAppConfig,
  SavedProject,
  ScriptOutput,
  TtsModelId,
  UsageQuotaState,
  UserSession,
  VoicePreset,
} from '../types/voxcraft';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const voxApi = {
  getConfig: () => apiFetch<PublicAppConfig>('/api/config'),

  getSession: () =>
    apiFetch<{
      session: UserSession;
      quota: UsageQuotaState;
      favourites: string[];
      presets: VoicePreset[];
    }>('/api/session'),

  login: (email: string, displayName: string) =>
    apiFetch<{
      session: UserSession;
      quota: UsageQuotaState;
      favourites: string[];
      presets: VoicePreset[];
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
    }),

  logout: () =>
    apiFetch<{
      session: UserSession;
      quota: UsageQuotaState;
      favourites: string[];
      presets: VoicePreset[];
    }>('/api/auth/logout', { method: 'POST' }),

  updatePreferences: (updates: Partial<UserSession>) =>
    apiFetch<{ session: UserSession }>('/api/session/preferences', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  getUsage: () => apiFetch<{ quota: UsageQuotaState }>('/api/usage'),

  joinProWaitlist: (email: string) =>
    apiFetch<{ session: UserSession; message: string }>('/api/plans/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  claimRewardedBoost: () =>
    apiFetch<{ quota: UsageQuotaState; bonusGranted: number }>('/api/quota/reward-claim', {
      method: 'POST',
    }),

  generateSpeech: (payload: {
    text: string;
    voiceId: string;
    languageCode: string;
    emotionId?: string;
    speed?: string;
    customStyle?: string;
    pronunciationNotes?: string;
    modelId?: TtsModelId;
    format?: AudioFormat;
    title?: string;
    saveHistory?: boolean;
  }) =>
    apiFetch<{
      id: string;
      audioBase64: string;
      mimeType: string;
      format: AudioFormat;
      durationSeconds: number;
      modelUsed: TtsModelId;
      createdAt: string;
      quota: UsageQuotaState;
    }>('/api/tts/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  previewVoice: (voiceId: string, languageCode = 'en-US') =>
    apiFetch<{
      audioBase64: string;
      mimeType: string;
      format: AudioFormat;
      durationSeconds: number;
      cached: boolean;
    }>('/api/tts/preview-voice', {
      method: 'POST',
      body: JSON.stringify({ voiceId, languageCode }),
    }),

  generateConversation: (payload: {
    lines: { speakerName: string; voiceId: string; text: string; styleNote?: string }[];
    languageCode: string;
    format: AudioFormat;
    title?: string;
  }) =>
    apiFetch<{
      id: string;
      audioBase64: string;
      mimeType: string;
      format: AudioFormat;
      durationSeconds: number;
      modelUsed: TtsModelId;
      mode: 'native-multi-speaker' | 'sequential-combined';
      createdAt: string;
      quota: UsageQuotaState;
    }>('/api/tts/conversation', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  concatAudio: (payload: { clipsBase64: string[]; format: AudioFormat; silenceGapMs?: number }) =>
    apiFetch<{
      audioBase64: string;
      mimeType: string;
      format: AudioFormat;
      durationSeconds: number;
    }>('/api/audio/concat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  encodeMp3: (wavBase64: string) =>
    apiFetch<{
      audioBase64: string;
      mimeType: string;
      format: 'mp3';
      durationSeconds: number;
    }>('/api/audio/encode-mp3', {
      method: 'POST',
      body: JSON.stringify({ wavBase64 }),
    }),

  generateScript: (payload: {
    mode: 'script-writer' | 'youtube' | 'advert';
    topic?: string;
    category?: string;
    purpose?: string;
    audience?: string;
    durationSeconds?: number;
    targetWords?: number;
    languageCode: string;
    tone: string;
    platform?: string;
    businessName?: string;
    productOrService?: string;
    sellingPoint?: string;
    contactInfo?: string;
    includeHook?: boolean;
    includeCta?: boolean;
  }) =>
    apiFetch<{ output: ScriptOutput; quota: UsageQuotaState }>('/api/scripts/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  transformScript: (payload: {
    script: string;
    action: 'rewrite' | 'shorten' | 'expand' | 'change-tone' | 'translate';
    tone?: string;
    targetLanguageCode?: string;
  }) =>
    apiFetch<{
      script: string;
      wordCount: number;
      estimatedDurationSeconds: number;
      quota: UsageQuotaState;
    }>('/api/scripts/transform', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  translate: (payload: {
    text: string;
    sourceLanguage: string;
    targetLanguageCode: string;
  }) =>
    apiFetch<{
      detectedSourceLanguage: string;
      translatedText: string;
      culturalNote: string;
      quota: UsageQuotaState;
    }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  analyzePronunciation: (text: string, languageCode: string) =>
    apiFetch<{ tips: PronunciationTip[] }>('/api/pronunciation/analyze', {
      method: 'POST',
      body: JSON.stringify({ text, languageCode }),
    }),

  listProjects: () => apiFetch<{ projects: SavedProject[] }>('/api/projects'),

  saveProject: (project: Partial<SavedProject> & { title: string; type: SavedProject['type'] }) =>
    apiFetch<{ project: SavedProject; projects: SavedProject[] }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    }),

  renameProject: (id: string, title: string) =>
    apiFetch<{ project: SavedProject; projects: SavedProject[] }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),

  deleteProject: (id: string) =>
    apiFetch<{ projects: SavedProject[] }>(`/api/projects/${id}`, {
      method: 'DELETE',
    }),

  listHistory: () => apiFetch<{ history: HistoryItem[] }>('/api/history'),

  deleteHistoryItem: (id: string) =>
    apiFetch<{ history: HistoryItem[] }>(`/api/history/${id}`, {
      method: 'DELETE',
    }),

  toggleFavourite: (voiceId: string) =>
    apiFetch<{ favourites: string[] }>('/api/favourites/toggle', {
      method: 'POST',
      body: JSON.stringify({ voiceId }),
    }),

  savePreset: (preset: Omit<VoicePreset, 'id' | 'createdAt'>) =>
    apiFetch<{ preset: VoicePreset; presets: VoicePreset[] }>('/api/presets', {
      method: 'POST',
      body: JSON.stringify(preset),
    }),

  deletePreset: (id: string) =>
    apiFetch<{ presets: VoicePreset[] }>(`/api/presets/${id}`, {
      method: 'DELETE',
    }),
};
