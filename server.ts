import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import {
  ADSENSE_CONFIG,
  EMOTION_STYLES,
  FREE_QUOTA_CONFIG,
  MAX_SCRIPT_WORDS,
  PLAN_TIERS,
  SUPPORTED_LANGUAGES,
  TTS_MODELS,
  VERIFIED_VOICES,
  getLanguageByCode,
  isValidVoiceId,
} from './server/config.ts';
import {
  analyzePronunciationWithGemini,
  generateConversationSpeech,
  generateScriptContent,
  generateSingleSpeakerSpeech,
  transformScriptContent,
  translateTextWithGemini,
} from './server/geminiClient.ts';
import { concatenateWavBuffers, encodeWavToMp3, parseWavHeader } from './server/audioUtils.ts';
import {
  addHistoryItem,
  checkAndConsumeQuota,
  deleteHistoryItem,
  deletePreset,
  deleteProject,
  getCachedVoicePreview,
  getFavourites,
  getOrCreateUserRecord,
  getQuotaStatus,
  grantRewardedBonusCharacters,
  joinProWaitlist,
  listHistory,
  listPresets,
  listProjects,
  renameProject,
  saveCachedVoicePreview,
  savePreset,
  saveProject,
  signInUser,
  toPublicSession,
  toggleFavouriteVoice,
  updateUserPreferences,
} from './server/storage.ts';
import {
  rateLimitMiddleware,
  sessionMiddleware,
  setSessionCookie,
  type RequestWithContext,
} from './server/middleware.ts';
import type { AudioFormat, SavedProject, TtsModelId, VoicePreset } from './src/types/voxcraft.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use('/api', sessionMiddleware);

// Public non-secret platform configuration
app.get('/api/config', (_req, res) => {
  res.json({
    voices: VERIFIED_VOICES,
    languages: SUPPORTED_LANGUAGES,
    emotionStyles: EMOTION_STYLES,
    ttsModels: TTS_MODELS,
    quotas: FREE_QUOTA_CONFIG,
    plans: PLAN_TIERS,
    proSubscriptionsEnabled: false,
    adsense: {
      enabled: ADSENSE_CONFIG.enabled,
      publisherIdConfigured: ADSENSE_CONFIG.enabled,
      publisherId: ADSENSE_CONFIG.publisherId,
      mode: ADSENSE_CONFIG.enabled ? 'active' : 'disabled-pending-approval',
      rewardedAdUnitConfigured: ADSENSE_CONFIG.rewardedEnabled,
    },
    supportedFormats: ['wav', 'mp3'],
  });
});

// Session & Account Profile
app.get('/api/session', (req: RequestWithContext, res) => {
  const userId = req.voxcraftUserId!;
  const ip = req.voxcraftClientIp!;
  const record = getOrCreateUserRecord(userId);
  res.json({
    session: toPublicSession(record),
    quota: getQuotaStatus(userId, ip),
    favourites: getFavourites(userId),
    presets: listPresets(userId),
  });
});

app.post('/api/auth/login', (req: RequestWithContext, res) => {
  const { email, displayName } = req.body as { email?: string; displayName?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  const account = signInUser({
    currentGuestUserId: req.voxcraftUserId!,
    email,
    displayName: displayName || '',
  });
  setSessionCookie(res, account.userId);
  res.json({
    session: toPublicSession(account),
    quota: getQuotaStatus(account.userId, req.voxcraftClientIp!),
    favourites: getFavourites(account.userId),
    presets: listPresets(account.userId),
  });
});

app.post('/api/auth/logout', (req: RequestWithContext, res) => {
  const freshGuestId = `gst_${crypto.randomBytes(10).toString('hex')}`;
  const record = getOrCreateUserRecord(freshGuestId);
  setSessionCookie(res, freshGuestId);
  res.json({
    session: toPublicSession(record),
    quota: getQuotaStatus(freshGuestId, req.voxcraftClientIp!),
    favourites: getFavourites(freshGuestId),
    presets: listPresets(freshGuestId),
  });
});

app.patch('/api/session/preferences', (req: RequestWithContext, res) => {
  const userId = req.voxcraftUserId!;
  const body = req.body as {
    displayName?: string;
    preferredVoiceId?: string;
    preferredLanguageCode?: string;
    preferredFormat?: AudioFormat;
    preferredModel?: TtsModelId;
  };
  if (body.preferredVoiceId && !isValidVoiceId(body.preferredVoiceId)) {
    res.status(400).json({ error: 'Invalid voice identifier.' });
    return;
  }
  if (body.preferredLanguageCode && !getLanguageByCode(body.preferredLanguageCode)) {
    res.status(400).json({ error: 'Unsupported language code.' });
    return;
  }
  const updated = updateUserPreferences(userId, body);
  res.json({ session: updated });
});

app.get('/api/usage', (req: RequestWithContext, res) => {
  res.json({
    quota: getQuotaStatus(req.voxcraftUserId!, req.voxcraftClientIp!),
  });
});

// Future Pro tier waitlist (persists creator interest cleanly without fake billing)
app.post('/api/plans/waitlist', (req: RequestWithContext, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address for the Pro waitlist.' });
    return;
  }
  const session = joinProWaitlist(req.voxcraftUserId!, email);
  res.json({
    session,
    message: 'Added to the VoxCraft Pro early-access waitlist.',
  });
});

// Rewarded Ad quota boost endpoint (only active when GAM_REWARDED_AD_UNIT is configured)
app.post('/api/quota/reward-claim', rateLimitMiddleware, (req: RequestWithContext, res) => {
  if (!ADSENSE_CONFIG.rewardedEnabled) {
    res.status(400).json({
      error:
        'Rewarded character boosts require a Google Ad Manager Rewarded Ad Unit (GAM_REWARDED_AD_UNIT). Standard AdSense display units cannot reward clicks.',
    });
    return;
  }
  const quota = grantRewardedBonusCharacters(req.voxcraftUserId!, req.voxcraftClientIp!, 15000);
  res.json({ quota, bonusGranted: 15000 });
});

// Core Text-to-Speech generation
app.post('/api/tts/generate', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const userId = req.voxcraftUserId!;
    const ip = req.voxcraftClientIp!;
    const {
      text,
      voiceId,
      languageCode = 'en-US',
      emotionId = 'natural',
      speed = 'normal',
      customStyle = '',
      pronunciationNotes = '',
      modelId = 'gemini-3.8-flash-lite-tts',
      format = 'wav',
      title,
      saveHistory = true,
    } = req.body as {
      text?: string;
      voiceId?: string;
      languageCode?: string;
      emotionId?: string;
      speed?: string;
      customStyle?: string;
      pronunciationNotes?: string;
      modelId?: TtsModelId;
      format?: AudioFormat;
      title?: string;
      saveHistory?: boolean;
    };

    const cleanText = (text || '').trim();
    if (!cleanText) {
      res.status(400).json({ error: 'Please enter text before generating speech.' });
      return;
    }
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_SCRIPT_WORDS) {
      res.status(400).json({
        error: `Script has ${wordCount.toLocaleString()} words, exceeding the ${MAX_SCRIPT_WORDS.toLocaleString()}-word limit per request. Shorten your script or use Audiobook Maker for longer manuscripts.`,
      });
      return;
    }
    if (!voiceId || !isValidVoiceId(voiceId)) {
      res.status(400).json({ error: 'Please select a valid Gemini voice.' });
      return;
    }
    if (!getLanguageByCode(languageCode)) {
      res.status(400).json({ error: `Unsupported language selection: ${languageCode}` });
      return;
    }

    const quotaCheck = checkAndConsumeQuota({
      userId,
      clientIp: ip,
      charCount: cleanText.length,
      countAsAudioGeneration: true,
    });
    if (!quotaCheck.ok) {
      res.status(429).json({ error: quotaCheck.error, quota: quotaCheck.quota });
      return;
    }

    const result = await generateSingleSpeakerSpeech({
      text: cleanText,
      voiceId,
      languageCode,
      emotionId,
      speed,
      customStyle,
      pronunciationNotes,
      modelId,
      format: format === 'mp3' ? 'mp3' : 'wav',
    });

    const clipId = `aud_${crypto.randomBytes(8).toString('hex')}`;
    const createdAt = new Date().toISOString();

    if (saveHistory) {
      addHistoryItem(userId, {
        id: clipId,
        kind: 'audio',
        title: title?.trim() || `${voiceId} · ${cleanText.slice(0, 42)}${cleanText.length > 42 ? '...' : ''}`,
        summary: cleanText.slice(0, 140),
        languageCode,
        voiceId,
        modelId: result.modelUsed,
        charCount: cleanText.length,
        format: result.format,
        durationSeconds: result.durationSeconds,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        createdAt,
      });
    }

    res.json({
      id: clipId,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      format: result.format,
      durationSeconds: result.durationSeconds,
      modelUsed: result.modelUsed,
      createdAt,
      quota: quotaCheck.quota,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Speech generation failed.';
    res.status(500).json({ error: message });
  }
});

// Real API voice preview (cached cleanly after first real Gemini synthesis)
app.post('/api/tts/preview-voice', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const { voiceId, languageCode = 'en-US' } = req.body as {
      voiceId?: string;
      languageCode?: string;
    };
    if (!voiceId || !isValidVoiceId(voiceId)) {
      res.status(400).json({ error: 'Invalid voice identifier.' });
      return;
    }
    const voice = VERIFIED_VOICES.find((v) => v.id === voiceId)!;
    const lang = getLanguageByCode(languageCode);
    const cacheKey = `preview_${voiceId}_${languageCode}`;
    const cached = getCachedVoicePreview(cacheKey);
    if (cached) {
      const meta = parseWavHeader(Buffer.from(cached, 'base64'));
      res.json({
        audioBase64: cached,
        mimeType: 'audio/wav',
        format: 'wav',
        durationSeconds: meta.durationSeconds,
        cached: true,
      });
      return;
    }

    const sampleText = lang ? lang.sampleText : voice.sampleLine;
    const result = await generateSingleSpeakerSpeech({
      text: sampleText,
      voiceId,
      languageCode,
      emotionId: 'natural',
      modelId: 'gemini-3.8-flash-lite-tts',
      format: 'wav',
    });

    saveCachedVoicePreview(cacheKey, result.audioBase64);
    res.json({
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      format: result.format,
      durationSeconds: result.durationSeconds,
      cached: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Voice preview failed.';
    res.status(500).json({ error: message });
  }
});

// Multi-speaker Conversation Studio
app.post('/api/tts/conversation', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const userId = req.voxcraftUserId!;
    const ip = req.voxcraftClientIp!;
    const {
      lines,
      languageCode = 'en-US',
      format = 'wav',
      title,
    } = req.body as {
      lines?: { speakerName: string; voiceId: string; text: string; styleNote?: string }[];
      languageCode?: string;
      format?: AudioFormat;
      title?: string;
    };

    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ error: 'Please add at least one line of dialogue.' });
      return;
    }

    const totalChars = lines.reduce((sum, l) => sum + (l.text?.trim().length || 0), 0);
    if (totalChars === 0) {
      res.status(400).json({ error: 'Dialogue lines cannot be empty.' });
      return;
    }

    const quotaCheck = checkAndConsumeQuota({
      userId,
      clientIp: ip,
      charCount: totalChars,
      countAsAudioGeneration: true,
    });
    if (!quotaCheck.ok) {
      res.status(429).json({ error: quotaCheck.error, quota: quotaCheck.quota });
      return;
    }

    const result = await generateConversationSpeech({
      lines: lines.map((l) => ({
        speakerName: (l.speakerName || 'Speaker').trim(),
        voiceId: l.voiceId,
        text: l.text.trim(),
        styleNote: l.styleNote,
      })),
      languageCode,
      format: format === 'mp3' ? 'mp3' : 'wav',
    });

    const clipId = `conv_${crypto.randomBytes(8).toString('hex')}`;
    const createdAt = new Date().toISOString();

    addHistoryItem(userId, {
      id: clipId,
      kind: 'audio',
      title: title?.trim() || `Conversation · ${lines.length} lines`,
      summary: lines.map((l) => `${l.speakerName}: ${l.text}`).join(' ').slice(0, 140),
      languageCode,
      voiceId: Array.from(new Set(lines.map((l) => l.voiceId))).join(', '),
      modelId: result.modelUsed,
      charCount: totalChars,
      format: result.format,
      durationSeconds: result.durationSeconds,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      createdAt,
    });

    res.json({
      id: clipId,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      format: result.format,
      durationSeconds: result.durationSeconds,
      modelUsed: result.modelUsed,
      mode: result.mode,
      createdAt,
      quota: quotaCheck.quota,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Conversation generation failed.';
    res.status(500).json({ error: message });
  }
});

// Concatenate multiple WAV clips safely & optionally encode to MP3 (Audiobook & Audio Editor)
app.post('/api/audio/concat', rateLimitMiddleware, (req: RequestWithContext, res) => {
  try {
    const { clipsBase64, format = 'wav', silenceGapMs = 220 } = req.body as {
      clipsBase64?: string[];
      format?: AudioFormat;
      silenceGapMs?: number;
    };

    if (!Array.isArray(clipsBase64) || clipsBase64.length === 0) {
      res.status(400).json({ error: 'No audio clips supplied to combine.' });
      return;
    }

    const buffers = clipsBase64.map((b64) => Buffer.from(b64, 'base64'));
    const { wavBuffer, durationSeconds } = concatenateWavBuffers(
      buffers,
      Math.max(0, Math.min(2000, Number(silenceGapMs) || 0))
    );

    if (format === 'mp3') {
      const mp3Buffer = encodeWavToMp3(wavBuffer, 128);
      res.json({
        audioBase64: mp3Buffer.toString('base64'),
        mimeType: 'audio/mpeg',
        format: 'mp3',
        durationSeconds,
      });
      return;
    }

    res.json({
      audioBase64: wavBuffer.toString('base64'),
      mimeType: 'audio/wav',
      format: 'wav',
      durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to combine audio clips.';
    res.status(500).json({ error: message });
  }
});

// Encode a single WAV buffer (e.g., from Web Audio OfflineAudioContext export) into MP3
app.post('/api/audio/encode-mp3', rateLimitMiddleware, (req: RequestWithContext, res) => {
  try {
    const { wavBase64 } = req.body as { wavBase64?: string };
    if (!wavBase64) {
      res.status(400).json({ error: 'Missing WAV audio payload.' });
      return;
    }
    const wavBuffer = Buffer.from(wavBase64, 'base64');
    const meta = parseWavHeader(wavBuffer);
    const mp3Buffer = encodeWavToMp3(wavBuffer, 128);
    res.json({
      audioBase64: mp3Buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      format: 'mp3',
      durationSeconds: meta.durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MP3 encoding failed.';
    res.status(500).json({ error: message });
  }
});

// AI Script Writer, YouTube Narration, and Business Advert Generator
app.post('/api/scripts/generate', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const userId = req.voxcraftUserId!;
    const ip = req.voxcraftClientIp!;
    const body = req.body as {
      mode: 'script-writer' | 'youtube' | 'advert';
      topic?: string;
      category?: string;
      purpose?: string;
      audience?: string;
      durationSeconds?: number;
      targetWords?: number;
      languageCode?: string;
      tone?: string;
      platform?: string;
      businessName?: string;
      productOrService?: string;
      sellingPoint?: string;
      contactInfo?: string;
      includeHook?: boolean;
      includeCta?: boolean;
    };

    const topicText = (body.topic || body.productOrService || '').trim();
    if (!topicText) {
      res.status(400).json({ error: 'Please provide a topic or product description.' });
      return;
    }

    const quotaCheck = checkAndConsumeQuota({
      userId,
      clientIp: ip,
      charCount: Math.min(800, topicText.length + 250),
      countAsAudioGeneration: false,
    });
    if (!quotaCheck.ok) {
      res.status(429).json({ error: quotaCheck.error, quota: quotaCheck.quota });
      return;
    }

    const output = await generateScriptContent({
      mode: body.mode || 'script-writer',
      topic: topicText,
      category: body.category,
      purpose: body.purpose,
      audience: body.audience,
      durationSeconds: body.durationSeconds,
      targetWords: body.targetWords,
      languageCode: body.languageCode || 'en-US',
      tone: body.tone || 'Professional',
      platform: body.platform,
      businessName: body.businessName,
      productOrService: body.productOrService,
      sellingPoint: body.sellingPoint,
      contactInfo: body.contactInfo,
      includeHook: body.includeHook,
      includeCta: body.includeCta,
    });

    addHistoryItem(userId, {
      id: `scr_${crypto.randomBytes(8).toString('hex')}`,
      kind: 'script',
      title: `${body.mode === 'advert' ? 'Advert' : body.mode === 'youtube' ? 'YouTube' : 'Script'}: ${topicText.slice(0, 42)}`,
      summary: output.fullScript.slice(0, 140),
      languageCode: body.languageCode || 'en-US',
      modelId: 'gemini-4-hydrogen',
      charCount: output.fullScript.length,
      createdAt: new Date().toISOString(),
    });

    res.json({ output, quota: quotaCheck.quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/scripts/transform', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const userId = req.voxcraftUserId!;
    const ip = req.voxcraftClientIp!;
    const { script, action, tone, targetLanguageCode } = req.body as {
      script?: string;
      action?: 'rewrite' | 'shorten' | 'expand' | 'change-tone' | 'translate';
      tone?: string;
      targetLanguageCode?: string;
    };

    const cleanScript = (script || '').trim();
    if (!cleanScript) {
      res.status(400).json({ error: 'No script text provided to update.' });
      return;
    }

    const quotaCheck = checkAndConsumeQuota({
      userId,
      clientIp: ip,
      charCount: Math.min(1500, cleanScript.length),
      countAsAudioGeneration: false,
    });
    if (!quotaCheck.ok) {
      res.status(429).json({ error: quotaCheck.error, quota: quotaCheck.quota });
      return;
    }

    const result = await transformScriptContent({
      script: cleanScript,
      action: action || 'rewrite',
      tone,
      targetLanguageCode,
    });

    res.json({ ...result, quota: quotaCheck.quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script transformation failed.';
    res.status(500).json({ error: message });
  }
});

// Translate & Speak
app.post('/api/translate', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const userId = req.voxcraftUserId!;
    const ip = req.voxcraftClientIp!;
    const { text, sourceLanguage = 'auto', targetLanguageCode } = req.body as {
      text?: string;
      sourceLanguage?: string;
      targetLanguageCode?: string;
    };

    const cleanText = (text || '').trim();
    if (!cleanText) {
      res.status(400).json({ error: 'Please enter source text to translate.' });
      return;
    }
    if (!targetLanguageCode || !getLanguageByCode(targetLanguageCode)) {
      res.status(400).json({ error: 'Please select a valid target language.' });
      return;
    }

    const quotaCheck = checkAndConsumeQuota({
      userId,
      clientIp: ip,
      charCount: cleanText.length,
      countAsAudioGeneration: false,
    });
    if (!quotaCheck.ok) {
      res.status(429).json({ error: quotaCheck.error, quota: quotaCheck.quota });
      return;
    }

    const result = await translateTextWithGemini({
      text: cleanText,
      sourceLanguage,
      targetLanguageCode,
    });

    addHistoryItem(userId, {
      id: `trn_${crypto.randomBytes(8).toString('hex')}`,
      kind: 'translation',
      title: `Translation (${result.detectedSourceLanguage} → ${targetLanguageCode})`,
      summary: result.translatedText.slice(0, 140),
      languageCode: targetLanguageCode,
      modelId: 'gemini-4-hydrogen',
      charCount: result.translatedText.length,
      createdAt: new Date().toISOString(),
    });

    res.json({ ...result, quota: quotaCheck.quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed.';
    res.status(500).json({ error: message });
  }
});

// Pronunciation analysis
app.post('/api/pronunciation/analyze', rateLimitMiddleware, async (req: RequestWithContext, res) => {
  try {
    const { text, languageCode = 'en-US' } = req.body as {
      text?: string;
      languageCode?: string;
    };
    const cleanText = (text || '').trim();
    if (!cleanText) {
      res.status(400).json({ error: 'Enter script text first to analyze pronunciation.' });
      return;
    }
    const result = await analyzePronunciationWithGemini({ text: cleanText, languageCode });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pronunciation analysis failed.';
    res.status(500).json({ error: message });
  }
});

// Projects CRUD
app.get('/api/projects', (req: RequestWithContext, res) => {
  res.json({ projects: listProjects(req.voxcraftUserId!) });
});

app.post('/api/projects', (req: RequestWithContext, res) => {
  const userId = req.voxcraftUserId!;
  const body = req.body as Partial<SavedProject>;
  if (!body.title?.trim() || !body.type) {
    res.status(400).json({ error: 'Project title and type are required.' });
    return;
  }
  const now = new Date().toISOString();
  const project: SavedProject = {
    id: body.id || `prj_${crypto.randomBytes(8).toString('hex')}`,
    title: body.title.trim(),
    type: body.type,
    languageCode: body.languageCode || 'en-US',
    voiceId: body.voiceId || 'Kore',
    content: body.content || '',
    payload: body.payload || {},
    audioId: body.audioId,
    createdAt: body.createdAt || now,
    updatedAt: now,
  };
  saveProject(userId, project);
  res.json({ project, projects: listProjects(userId) });
});

app.patch('/api/projects/:id', (req: RequestWithContext, res) => {
  const userId = req.voxcraftUserId!;
  const { title } = req.body as { title?: string };
  if (!title?.trim()) {
    res.status(400).json({ error: 'Project title cannot be empty.' });
    return;
  }
  const updated = renameProject(userId, String(req.params.id), title);
  if (!updated) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({ project: updated, projects: listProjects(userId) });
});

app.delete('/api/projects/:id', (req: RequestWithContext, res) => {
  const userId = req.voxcraftUserId!;
  const ok = deleteProject(userId, String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({ projects: listProjects(userId) });
});

// History CRUD
app.get('/api/history', (req: RequestWithContext, res) => {
  res.json({ history: listHistory(req.voxcraftUserId!) });
});

app.delete('/api/history/:id', (req: RequestWithContext, res) => {
  const userId = req.voxcraftUserId!;
  deleteHistoryItem(userId, String(req.params.id));
  res.json({ history: listHistory(userId) });
});

// Favourites & Voice Presets
app.post('/api/favourites/toggle', (req: RequestWithContext, res) => {
  const { voiceId } = req.body as { voiceId?: string };
  if (!voiceId || !isValidVoiceId(voiceId)) {
    res.status(400).json({ error: 'Invalid voice identifier.' });
    return;
  }
  const favourites = toggleFavouriteVoice(req.voxcraftUserId!, voiceId);
  res.json({ favourites });
});

app.get('/api/presets', (req: RequestWithContext, res) => {
  res.json({ presets: listPresets(req.voxcraftUserId!) });
});

app.post('/api/presets', (req: RequestWithContext, res) => {
  const body = req.body as Partial<VoicePreset>;
  if (!body.name?.trim() || !body.voiceId || !isValidVoiceId(body.voiceId)) {
    res.status(400).json({ error: 'Preset name and valid voice are required.' });
    return;
  }
  const preset: VoicePreset = {
    id: `pst_${crypto.randomBytes(6).toString('hex')}`,
    name: body.name.trim(),
    voiceId: body.voiceId,
    languageCode: body.languageCode || 'en-US',
    emotionId: body.emotionId || 'natural',
    speed: body.speed || 'normal',
    customStyle: body.customStyle || '',
    modelId: body.modelId || 'gemini-3.8-flash-lite-tts',
    createdAt: new Date().toISOString(),
  };
  const presets = savePreset(req.voxcraftUserId!, preset);
  res.json({ preset, presets });
});

app.delete('/api/presets/:id', (req: RequestWithContext, res) => {
  const presets = deletePreset(req.voxcraftUserId!, String(req.params.id));
  res.json({ presets });
});

// Start Vite dev middleware in development or static dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VoxCraft AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
