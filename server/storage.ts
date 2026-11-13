import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AudioFormat,
  HistoryItem,
  PlanTier,
  SavedProject,
  TtsModelId,
  UsageQuotaState,
  UserSession,
  VoicePreset,
} from '../src/types/voxcraft.ts';
import { FREE_QUOTA_CONFIG, PRO_QUOTA_CONFIG } from './config.ts';

interface DailyUsageRecord {
  dateKey: string;
  charactersUsed: number;
  generationsCount: number;
  bonusCharacters?: number;
}

interface UserAccountRecord {
  userId: string;
  isAuthenticated: boolean;
  email: string | null;
  displayName: string;
  planTier?: PlanTier;
  onProWaitlist?: boolean;
  preferredVoiceId: string;
  preferredLanguageCode: string;
  preferredFormat: AudioFormat;
  preferredModel: TtsModelId;
  totalGeneratedAudioCount: number;
  favouriteVoices: string[];
  projects: SavedProject[];
  history: HistoryItem[];
  presets: VoicePreset[];
}

interface PersistedDatabase {
  users: Record<string, UserAccountRecord>;
  emailToUserId: Record<string, string>;
  dailyUsageByKey: Record<string, DailyUsageRecord>;
  proWaitlistEmails?: string[];
}

const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
);

const DATA_DIR = process.env.VOXCRAFT_DATA_DIR
  ? path.resolve(process.env.VOXCRAFT_DATA_DIR)
  : IS_SERVERLESS
    ? path.join(os.tmpdir(), 'voxcraft-data')
    : path.resolve(process.cwd(), 'server', 'data');

const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PREVIEW_CACHE_DIR = path.join(DATA_DIR, 'voice_previews');
const memoryPreviewCache = new Map<string, string>();

function ensureDirs(): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(PREVIEW_CACHE_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDb(): PersistedDatabase {
  ensureDirs();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as PersistedDatabase;
      return {
        users: parsed.users || {},
        emailToUserId: parsed.emailToUserId || {},
        dailyUsageByKey: parsed.dailyUsageByKey || {},
        proWaitlistEmails: parsed.proWaitlistEmails || [],
      };
    }
  } catch {
    // Fallback to clean in-memory store if unreadable
  }
  return {
    users: {},
    emailToUserId: {},
    dailyUsageByKey: {},
    proWaitlistEmails: [],
  };
}

let db: PersistedDatabase = loadDb();

function saveDb(): void {
  if (!ensureDirs()) return;
  try {
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch {
    // Keep operating cleanly in-memory if filesystem write is unavailable
  }
}

export function getOrCreateUserRecord(userId: string): UserAccountRecord {
  if (!db.users[userId]) {
    db.users[userId] = {
      userId,
      isAuthenticated: false,
      email: null,
      displayName: 'Guest Creator',
      planTier: 'free',
      onProWaitlist: false,
      preferredVoiceId: 'Kore',
      preferredLanguageCode: 'en-US',
      preferredFormat: 'wav',
      preferredModel: 'gemini-3.8-flash-lite-tts',
      totalGeneratedAudioCount: 0,
      favouriteVoices: ['Kore', 'Puck'],
      projects: [],
      history: [],
      presets: [],
    };
    saveDb();
  }
  return db.users[userId];
}

export function signInUser(params: {
  currentGuestUserId: string;
  email: string;
  displayName: string;
}): UserAccountRecord {
  const normalizedEmail = params.email.trim().toLowerCase();
  let existingUserId = db.emailToUserId[normalizedEmail];

  if (!existingUserId) {
    existingUserId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    db.emailToUserId[normalizedEmail] = existingUserId;
    const guest = getOrCreateUserRecord(params.currentGuestUserId);
    // Migrate guest workspace items cleanly on first sign-in
    db.users[existingUserId] = {
      ...guest,
      userId: existingUserId,
      isAuthenticated: true,
      email: normalizedEmail,
      displayName: params.displayName.trim() || normalizedEmail.split('@')[0],
    };
  } else {
    const account = getOrCreateUserRecord(existingUserId);
    account.isAuthenticated = true;
    account.email = normalizedEmail;
    if (params.displayName.trim()) {
      account.displayName = params.displayName.trim();
    }
  }

  saveDb();
  return db.users[existingUserId];
}

export function toPublicSession(record: UserAccountRecord): UserSession {
  const emailWaitlisted =
    Boolean(record.onProWaitlist) ||
    Boolean(record.email && db.proWaitlistEmails?.includes(record.email.toLowerCase()));
  return {
    userId: record.userId,
    isAuthenticated: record.isAuthenticated,
    email: record.email,
    displayName: record.displayName,
    planTier: record.planTier === 'pro' ? 'pro' : 'free',
    onProWaitlist: emailWaitlisted,
    preferredVoiceId: record.preferredVoiceId,
    preferredLanguageCode: record.preferredLanguageCode,
    preferredFormat: record.preferredFormat,
    preferredModel: record.preferredModel,
  };
}

export function joinProWaitlist(userId: string, email: string): UserSession {
  const normalized = email.trim().toLowerCase();
  const user = getOrCreateUserRecord(userId);
  user.onProWaitlist = true;
  if (!user.email) {
    user.email = normalized;
  }
  db.proWaitlistEmails = db.proWaitlistEmails || [];
  if (!db.proWaitlistEmails.includes(normalized)) {
    db.proWaitlistEmails.push(normalized);
  }
  saveDb();
  return toPublicSession(user);
}

export function updateUserPreferences(
  userId: string,
  updates: Partial<
    Pick<
      UserAccountRecord,
      'displayName' | 'preferredVoiceId' | 'preferredLanguageCode' | 'preferredFormat' | 'preferredModel'
    >
  >
): UserSession {
  const user = getOrCreateUserRecord(userId);
  if (updates.displayName !== undefined) user.displayName = updates.displayName.trim() || user.displayName;
  if (updates.preferredVoiceId !== undefined) user.preferredVoiceId = updates.preferredVoiceId;
  if (updates.preferredLanguageCode !== undefined) user.preferredLanguageCode = updates.preferredLanguageCode;
  if (updates.preferredFormat !== undefined) user.preferredFormat = updates.preferredFormat;
  if (updates.preferredModel !== undefined) user.preferredModel = updates.preferredModel;
  saveDb();
  return toPublicSession(user);
}

function getDailyBucket(key: string): DailyUsageRecord {
  const today = getTodayKey();
  const bucketKey = `${key}:${today}`;
  if (!db.dailyUsageByKey[bucketKey]) {
    db.dailyUsageByKey[bucketKey] = {
      dateKey: today,
      charactersUsed: 0,
      generationsCount: 0,
    };
  }
  return db.dailyUsageByKey[bucketKey];
}

export function getQuotaStatus(userId: string, clientIp: string): UsageQuotaState {
  const user = getOrCreateUserRecord(userId);
  const planTier = user.planTier === 'pro' ? 'pro' : 'free';
  const planCfg = planTier === 'pro' ? PRO_QUOTA_CONFIG : FREE_QUOTA_CONFIG;

  const userBucket = getDailyBucket(`u_${userId}`);
  const ipBucket = getDailyBucket(`ip_${clientIp}`);

  // Enforce the stricter of user or IP daily counters to protect against cookie clearing
  const charactersUsedToday = Math.max(userBucket.charactersUsed, ipBucket.charactersUsed);
  const generationsToday = Math.max(userBucket.generationsCount, ipBucket.generationsCount);
  const bonusCharactersToday = Math.max(
    userBucket.bonusCharacters || 0,
    ipBucket.bonusCharacters || 0
  );
  const effectiveDailyCharacterLimit = planCfg.dailyCharacterLimit + bonusCharactersToday;

  return {
    planTier,
    charactersUsedToday,
    bonusCharactersToday,
    charactersRemainingToday: Math.max(0, effectiveDailyCharacterLimit - charactersUsedToday),
    generationsToday,
    generationsRemainingToday: Math.max(0, planCfg.dailyGenerationLimit - generationsToday),
    totalGeneratedAudioCount: user.totalGeneratedAudioCount,
    dailyCharacterLimit: planCfg.dailyCharacterLimit,
    effectiveDailyCharacterLimit,
    dailyGenerationLimit: planCfg.dailyGenerationLimit,
    maxCharsPerRequest: planCfg.maxCharsPerRequest,
    resetNote: 'Daily allowance resets every 24 hours at 00:00 UTC.',
  };
}

export function grantRewardedBonusCharacters(
  userId: string,
  clientIp: string,
  bonusChars = 15000
): UsageQuotaState {
  const userBucket = getDailyBucket(`u_${userId}`);
  const ipBucket = getDailyBucket(`ip_${clientIp}`);
  userBucket.bonusCharacters = (userBucket.bonusCharacters || 0) + bonusChars;
  ipBucket.bonusCharacters = (ipBucket.bonusCharacters || 0) + bonusChars;
  saveDb();
  return getQuotaStatus(userId, clientIp);
}

export function checkAndConsumeQuota(params: {
  userId: string;
  clientIp: string;
  charCount: number;
  countAsAudioGeneration: boolean;
}): { ok: true; quota: UsageQuotaState } | { ok: false; error: string; quota: UsageQuotaState } {
  const current = getQuotaStatus(params.userId, params.clientIp);

  if (params.charCount > current.maxCharsPerRequest) {
    return {
      ok: false,
      error: `Request exceeds the maximum ${current.maxCharsPerRequest.toLocaleString()} characters per request. For longer scripts, split into sections or use Audiobook Maker.`,
      quota: current,
    };
  }

  if (current.charactersUsedToday + params.charCount > current.effectiveDailyCharacterLimit) {
    return {
      ok: false,
      error: `Daily character allowance reached (${current.effectiveDailyCharacterLimit.toLocaleString()} characters/day). ${current.resetNote}`,
      quota: current,
    };
  }

  if (
    params.countAsAudioGeneration &&
    current.generationsToday + 1 > current.dailyGenerationLimit
  ) {
    return {
      ok: false,
      error: `Daily generation limit reached (${current.dailyGenerationLimit} generations/day). ${current.resetNote}`,
      quota: current,
    };
  }

  const userBucket = getDailyBucket(`u_${params.userId}`);
  const ipBucket = getDailyBucket(`ip_${params.clientIp}`);

  userBucket.charactersUsed += params.charCount;
  ipBucket.charactersUsed += params.charCount;

  if (params.countAsAudioGeneration) {
    userBucket.generationsCount += 1;
    ipBucket.generationsCount += 1;
    const user = getOrCreateUserRecord(params.userId);
    user.totalGeneratedAudioCount += 1;
  }

  saveDb();
  return {
    ok: true,
    quota: getQuotaStatus(params.userId, params.clientIp),
  };
}

// Projects CRUD
export function listProjects(userId: string): SavedProject[] {
  return getOrCreateUserRecord(userId).projects;
}

export function saveProject(userId: string, project: SavedProject): SavedProject {
  const user = getOrCreateUserRecord(userId);
  const idx = user.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    user.projects[idx] = project;
  } else {
    user.projects.unshift(project);
  }
  saveDb();
  return project;
}

export function renameProject(userId: string, projectId: string, title: string): SavedProject | null {
  const user = getOrCreateUserRecord(userId);
  const proj = user.projects.find((p) => p.id === projectId);
  if (!proj) return null;
  proj.title = title.trim();
  proj.updatedAt = new Date().toISOString();
  saveDb();
  return proj;
}

export function deleteProject(userId: string, projectId: string): boolean {
  const user = getOrCreateUserRecord(userId);
  const prevLen = user.projects.length;
  user.projects = user.projects.filter((p) => p.id !== projectId);
  if (user.projects.length !== prevLen) {
    saveDb();
    return true;
  }
  return false;
}

// History CRUD (bounded to 40 most recent items per user; audio stored only for recent items under 3MB)
export function listHistory(userId: string): HistoryItem[] {
  return getOrCreateUserRecord(userId).history;
}

export function addHistoryItem(userId: string, item: HistoryItem): HistoryItem {
  const user = getOrCreateUserRecord(userId);
  const safeItem = { ...item };
  if (safeItem.audioBase64 && safeItem.audioBase64.length > 3_500_000) {
    delete safeItem.audioBase64;
  }
  user.history.unshift(safeItem);
  if (user.history.length > 40) {
    user.history = user.history.slice(0, 40);
  }
  saveDb();
  return safeItem;
}

export function deleteHistoryItem(userId: string, itemId: string): boolean {
  const user = getOrCreateUserRecord(userId);
  const prevLen = user.history.length;
  user.history = user.history.filter((h) => h.id !== itemId);
  if (user.history.length !== prevLen) {
    saveDb();
    return true;
  }
  return false;
}

// Favourites & Presets
export function getFavourites(userId: string): string[] {
  return getOrCreateUserRecord(userId).favouriteVoices;
}

export function toggleFavouriteVoice(userId: string, voiceId: string): string[] {
  const user = getOrCreateUserRecord(userId);
  if (user.favouriteVoices.includes(voiceId)) {
    user.favouriteVoices = user.favouriteVoices.filter((v) => v !== voiceId);
  } else {
    user.favouriteVoices.push(voiceId);
  }
  saveDb();
  return user.favouriteVoices;
}

export function listPresets(userId: string): VoicePreset[] {
  return getOrCreateUserRecord(userId).presets;
}

export function savePreset(userId: string, preset: VoicePreset): VoicePreset[] {
  const user = getOrCreateUserRecord(userId);
  user.presets.unshift(preset);
  saveDb();
  return user.presets;
}

export function deletePreset(userId: string, presetId: string): VoicePreset[] {
  const user = getOrCreateUserRecord(userId);
  user.presets = user.presets.filter((p) => p.id !== presetId);
  saveDb();
  return user.presets;
}

// Voice preview cache on disk/memory (so repeated voice sample clicks return real Gemini TTS audio instantly)
export function getCachedVoicePreview(cacheKey: string): string | null {
  const mem = memoryPreviewCache.get(cacheKey);
  if (mem) return mem;
  if (!ensureDirs()) return null;
  try {
    const safeName = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(PREVIEW_CACHE_DIR, `${safeName}.wav`);
    if (fs.existsSync(filePath)) {
      const b64 = fs.readFileSync(filePath).toString('base64');
      memoryPreviewCache.set(cacheKey, b64);
      return b64;
    }
  } catch {
    // Ignore disk read error
  }
  return null;
}

export function saveCachedVoicePreview(cacheKey: string, wavBase64: string): void {
  memoryPreviewCache.set(cacheKey, wavBase64);
  if (!ensureDirs()) return;
  try {
    const safeName = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(PREVIEW_CACHE_DIR, `${safeName}.wav`);
    fs.writeFileSync(filePath, Buffer.from(wavBase64, 'base64'));
  } catch {
    // Keep cached in memory even if filesystem write fails
  }
}
