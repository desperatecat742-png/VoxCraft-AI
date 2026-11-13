import { GoogleGenAI, Type } from '@google/genai';
import {
  TEXT_GENERATION_MODEL,
  getEmotionById,
  getLanguageByCode,
  isValidVoiceId,
} from './config.ts';
import { concatenateWavBuffers, encodeWavToMp3, parseWavHeader } from './audioUtils.ts';
import type { AudioFormat, PronunciationTip, ScriptOutput, TtsModelId } from '../src/types/voxcraft.ts';

function getAiClient(apiVersion: 'v1' | 'v1beta' | 'v1alpha' = 'v1beta'): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function splitTextForTts(text: string, maxChars = 1400): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if ((current + '\n\n' + trimmedPara).trim().length <= maxChars) {
      current = current ? `${current}\n\n${trimmedPara}` : trimmedPara;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (trimmedPara.length <= maxChars) {
      current = trimmedPara;
      continue;
    }

    const sentences = trimmedPara.match(/[^.!?]+[.!?]+[\])"']*|\s*[^.!?]+$/g) || [trimmedPara];
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      if (s.length > maxChars) {
        const words = s.split(/\s+/);
        let wordBuf = '';
        for (const w of words) {
          if ((wordBuf + ' ' + w).trim().length > maxChars) {
            if (wordBuf.trim()) chunks.push(wordBuf.trim());
            wordBuf = w;
          } else {
            wordBuf = wordBuf ? `${wordBuf} ${w}` : w;
          }
        }
        if (wordBuf.trim()) {
          current = wordBuf.trim();
        }
      } else if ((current + ' ' + s).trim().length <= maxChars) {
        current = current ? `${current} ${s}` : s;
      } else {
        if (current) chunks.push(current);
        current = s;
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

function formatGeminiError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return new Error(
      'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return new Error(
      'Gemini API rate or quota limit reached temporarily. Please wait a moment and retry.'
    );
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return new Error(
      'Requested Gemini model was not found or is unavailable in this project.'
    );
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return new Error(
      'Speech service is temporarily experiencing high demand. Please retry in a few seconds.'
    );
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return new Error('Speech generation timed out. Try a shorter passage or retry.');
  }
  return new Error(raw || 'Gemini API request failed.');
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isTransient = msg.includes('503') || msg.includes('unavailable') || msg.includes('econnreset');
      if (!isTransient || attempt === maxRetries) {
        throw formatGeminiError(err);
      }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw formatGeminiError(lastError);
}

export interface GenerateSpeechOptions {
  text: string;
  voiceId: string;
  languageCode: string;
  emotionId?: string;
  speed?: string; // 'slow' | 'normal' | 'fast'
  customStyle?: string;
  pronunciationNotes?: string;
  modelId?: TtsModelId;
  format?: AudioFormat;
}

export interface GeneratedAudioResult {
  audioBase64: string;
  mimeType: string;
  format: AudioFormat;
  durationSeconds: number;
  modelUsed: TtsModelId;
}

function buildStylePrompt(options: GenerateSpeechOptions): string {
  const parts: string[] = [];
  const lang = getLanguageByCode(options.languageCode);
  const emotion = options.emotionId ? getEmotionById(options.emotionId) : undefined;

  if (emotion) {
    parts.push(emotion.instruction);
  }
  if (lang) {
    parts.push(`Language/Accent target: ${lang.name} (${lang.styleHint})`);
  }
  if (options.speed === 'slow') {
    parts.push('Speak at a slower, unhurried pace with clear enunciation');
  } else if (options.speed === 'fast') {
    parts.push('Speak at a brisk, energetic, slightly faster pace');
  }
  if (options.customStyle?.trim()) {
    parts.push(options.customStyle.trim());
  }
  if (options.pronunciationNotes?.trim()) {
    parts.push(`Pronunciation guidance: ${options.pronunciationNotes.trim()}`);
  }

  return parts.join('. ') || 'Clear, natural studio delivery';
}

function extractInlineAudioData(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
      }>;
    };
  }>;
}): { data: string; mimeType: string } | null {
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/wav',
      };
    }
  }
  return null;
}

function normalizeToWavBuffer(rawBytes: Buffer, mimeType: string): Buffer {
  // If already RIFF/WAVE, return directly; if raw L16 PCM, wrap in 44-byte RIFF header
  if (
    rawBytes.length >= 12 &&
    rawBytes.toString('ascii', 0, 4) === 'RIFF' &&
    rawBytes.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return rawBytes;
  }
  if (mimeType.toLowerCase().includes('l16') || mimeType.toLowerCase().includes('pcm')) {
    const header = Buffer.alloc(44);
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + rawBytes.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * 2, 28);
    header.writeUInt16LE(numChannels * 2, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(rawBytes.length, 40);
    return Buffer.concat([header, rawBytes]);
  }
  return rawBytes;
}

function isFallbackableModelError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('not_found') ||
    msg.includes('404')
  );
}

async function synthesizeChunkWav(params: {
  text: string;
  voiceId: string;
  styleInstruction: string;
  model: TtsModelId;
}): Promise<{ wavBuffer: Buffer; modelUsed: TtsModelId }> {
  const aiBeta = getAiClient('v1beta');
  const aiAlpha = getAiClient('v1alpha');

  const tryCall = async (
    client: GoogleGenAI,
    modelName: string,
    includeSpeechMetadata: boolean
  ) => {
    const partPayload = includeSpeechMetadata
      ? { text: params.text, speechMetadata: { style: params.styleInstruction } }
      : {
          text: `Speak the following text aloud in a ${params.styleInstruction} tone: "${params.text}"`,
        };

    const response = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [partPayload] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: params.voiceId },
          },
        },
      },
    });

    const inline = extractInlineAudioData(response);
    if (!inline) {
      throw new Error('The speech model did not return audio data for this input.');
    }
    return normalizeToWavBuffer(Buffer.from(inline.data, 'base64'), inline.mimeType);
  };

  const synthesizeWithModel = async (targetModel: string): Promise<Buffer> => {
    try {
      return await tryCall(aiBeta, targetModel, true);
    } catch (err1) {
      const msg1 = err1 instanceof Error ? err1.message : '';
      if (msg1.includes('speechMetadata') || msg1.includes('INVALID_ARGUMENT')) {
        try {
          return await tryCall(aiAlpha, targetModel, true);
        } catch {
          return await tryCall(aiBeta, targetModel, false);
        }
      }
      throw err1;
    }
  };

  const candidateModels: { apiModel: string; reportedModel: TtsModelId }[] =
    params.model === 'gemini-3.8-flash-tts'
      ? [
          { apiModel: 'gemini-3.8-flash-tts', reportedModel: 'gemini-3.8-flash-tts' },
          { apiModel: 'gemini-3.8-flash-lite-tts', reportedModel: 'gemini-3.8-flash-lite-tts' },
          { apiModel: 'gemini-2.5-flash-preview-tts', reportedModel: 'gemini-3.8-flash-lite-tts' },
        ]
      : [
          { apiModel: 'gemini-3.8-flash-lite-tts', reportedModel: 'gemini-3.8-flash-lite-tts' },
          { apiModel: 'gemini-3.8-flash-tts', reportedModel: 'gemini-3.8-flash-tts' },
          { apiModel: 'gemini-2.5-flash-preview-tts', reportedModel: 'gemini-3.8-flash-lite-tts' },
        ];

  let lastErr: unknown;
  for (let i = 0; i < candidateModels.length; i++) {
    const candidate = candidateModels[i];
    try {
      const wavBuffer = await synthesizeWithModel(candidate.apiModel);
      return { wavBuffer, modelUsed: candidate.reportedModel };
    } catch (err) {
      lastErr = err;
      const hasMore = i < candidateModels.length - 1;
      if (hasMore && isFallbackableModelError(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function generateSingleSpeakerSpeech(
  options: GenerateSpeechOptions
): Promise<GeneratedAudioResult> {
  if (!isValidVoiceId(options.voiceId)) {
    throw new Error(`Unsupported voice identifier: ${options.voiceId}`);
  }

  const modelId: TtsModelId =
    options.modelId === 'gemini-3.8-flash-lite-tts' || options.modelId === 'gemini-3.8-flash-tts'
      ? options.modelId
      : 'gemini-3.8-flash-lite-tts';

  const lang = getLanguageByCode(options.languageCode);
  const needsVoiceDesign =
    Boolean(options.customStyle?.trim()) ||
    Boolean(options.pronunciationNotes?.trim()) ||
    lang?.supportTier === 'style-guided';

  const resolvedModel: TtsModelId =
    options.modelId === 'gemini-3.8-flash-tts' || needsVoiceDesign
      ? 'gemini-3.8-flash-tts'
      : modelId;

  const styleInstruction = buildStylePrompt(options);
  const chunks = splitTextForTts(options.text, 1400);
  if (chunks.length === 0) {
    throw new Error('Please enter text before generating speech.');
  }

  const wavChunks: Buffer[] = [];
  let actualModelUsed: TtsModelId = resolvedModel;

  for (const chunk of chunks) {
    const res = await withRetry(() =>
      synthesizeChunkWav({
        text: chunk,
        voiceId: options.voiceId,
        styleInstruction,
        model: resolvedModel,
      })
    );
    wavChunks.push(res.wavBuffer);
    actualModelUsed = res.modelUsed;
  }

  const wavBuffer =
    wavChunks.length === 1 ? wavChunks[0] : concatenateWavBuffers(wavChunks, 160).wavBuffer;

  const meta = parseWavHeader(wavBuffer);
  const targetFormat: AudioFormat = options.format === 'mp3' ? 'mp3' : 'wav';

  if (targetFormat === 'mp3') {
    const mp3Buffer = encodeWavToMp3(wavBuffer, 128);
    return {
      audioBase64: mp3Buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      format: 'mp3',
      durationSeconds: meta.durationSeconds,
      modelUsed: actualModelUsed,
    };
  }

  return {
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav',
    format: 'wav',
    durationSeconds: meta.durationSeconds,
    modelUsed: actualModelUsed,
  };
}

export interface ConversationLineInput {
  speakerName: string;
  voiceId: string;
  text: string;
  styleNote?: string;
}

export async function generateConversationSpeech(params: {
  lines: ConversationLineInput[];
  languageCode: string;
  format: AudioFormat;
}): Promise<GeneratedAudioResult & { mode: 'native-multi-speaker' | 'sequential-combined' }> {
  const { lines, languageCode, format } = params;
  if (lines.length === 0) {
    throw new Error('At least one dialogue line is required.');
  }

  for (const line of lines) {
    if (!isValidVoiceId(line.voiceId)) {
      throw new Error(`Invalid voice selected for speaker ${line.speakerName}.`);
    }
  }

  const speakerMap = new Map<string, string>();
  for (const line of lines) {
    if (!speakerMap.has(line.speakerName)) {
      speakerMap.set(line.speakerName, line.voiceId);
    }
  }

  const lang = getLanguageByCode(languageCode);
  const langNote = lang ? `${lang.name} (${lang.styleHint})` : 'Natural studio delivery';

  // Native Gemini multiSpeakerVoiceConfig supports exactly 2 speakers on v1beta/v1alpha
  if (speakerMap.size === 2) {
    try {
      const aiBeta = getAiClient('v1beta');
      const speakerEntries = Array.from(speakerMap.entries());
      const transcript = lines.map((l) => `${l.speakerName}: ${l.text}`).join('\n');

      const wavBuffer = await withRetry(async () => {
        const response = await aiBeta.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `TTS the following conversation naturally (${langNote}):\n${transcript}`,
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakerEntries.map(([speaker, voiceName]) => ({
                  speaker,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                })),
              },
            },
          },
        });

        const inline = extractInlineAudioData(response);
        if (!inline) {
          throw new Error('Multi-speaker model returned no audio data.');
        }
        return normalizeToWavBuffer(Buffer.from(inline.data, 'base64'), inline.mimeType);
      });

      const meta = parseWavHeader(wavBuffer);
      if (format === 'mp3') {
        const mp3Buffer = encodeWavToMp3(wavBuffer, 128);
        return {
          audioBase64: mp3Buffer.toString('base64'),
          mimeType: 'audio/mpeg',
          format: 'mp3',
          durationSeconds: meta.durationSeconds,
          modelUsed: 'gemini-3.8-flash-tts',
          mode: 'native-multi-speaker',
        };
      }

      return {
        audioBase64: wavBuffer.toString('base64'),
        mimeType: 'audio/wav',
        format: 'wav',
        durationSeconds: meta.durationSeconds,
        modelUsed: 'gemini-3.8-flash-tts',
        mode: 'native-multi-speaker',
      };
    } catch {
      // Reliable fallback to sequential clip generation & WAV concatenation below
    }
  }

  // Sequential clip-generation fallback (also used for 1 speaker or 3+ speakers)
  const wavClips: Buffer[] = [];
  let actualModelUsed: TtsModelId = 'gemini-3.8-flash-tts';
  for (const line of lines) {
    const clip = await generateSingleSpeakerSpeech({
      text: line.text,
      voiceId: line.voiceId,
      languageCode,
      customStyle: line.styleNote || 'Natural dialogue delivery',
      modelId: 'gemini-3.8-flash-tts',
      format: 'wav',
    });
    wavClips.push(Buffer.from(clip.audioBase64, 'base64'));
    actualModelUsed = clip.modelUsed;
  }

  const { wavBuffer, durationSeconds } = concatenateWavBuffers(wavClips, 240);
  if (format === 'mp3') {
    const mp3Buffer = encodeWavToMp3(wavBuffer, 128);
    return {
      audioBase64: mp3Buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      format: 'mp3',
      durationSeconds,
      modelUsed: actualModelUsed,
      mode: 'sequential-combined',
    };
  }

  return {
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav',
    format: 'wav',
    durationSeconds,
    modelUsed: actualModelUsed,
    mode: 'sequential-combined',
  };
}

export async function generateScriptContent(params: {
  mode: 'script-writer' | 'youtube' | 'advert';
  topic: string;
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
}): Promise<ScriptOutput> {
  const ai = getAiClient();
  const lang = getLanguageByCode(params.languageCode);
  const languageName = lang ? lang.name : params.languageCode;
  const computedWords = params.targetWords
    ? Math.round(params.targetWords)
    : Math.round(((params.durationSeconds || 60) / 60) * 140);
  const targetWords = Math.min(2000, Math.max(40, computedWords));
  const estDurationSeconds = Math.round(targetWords / 2.33);
  const lengthDirective =
    targetWords >= 500
      ? `Write the full ${targetWords}-word script in rich, complete spoken prose (up to 2,000 words). Do NOT abbreviate, summarize, or skip sections.`
      : `Target Spoken Length: roughly ${targetWords} words (~${estDurationSeconds} seconds).`;

  let prompt = '';
  if (params.mode === 'advert') {
    prompt = `Write a spoken-word business advertisement voiceover script in ${languageName}.
Business Name: ${params.businessName || 'Not specified'}
Product or Service: ${params.productOrService || params.topic}
Business Description: ${params.purpose || params.topic}
Target Customers: ${params.audience || 'General customers'}
Main Selling Point: ${params.sellingPoint || 'Quality and reliability'}
Contact Information: ${params.contactInfo || 'None provided'}
Desired Style/Tone: ${params.tone}
${lengthDirective}
Include strong opening hook: ${params.includeHook !== false ? 'Yes' : 'No'}.
Include clear call to action: ${params.includeCta !== false ? 'Yes' : 'No'}.
Write natural spoken prose without stage directions in brackets unless helpful for breathing pauses.`;
  } else if (params.mode === 'youtube') {
    prompt = `Write a narration-ready YouTube voiceover script in ${languageName}.
Video Topic / Premise: ${params.topic}
Narration Format: ${params.category || 'Educational narration'}
Target Audience: ${params.audience || 'YouTube viewers'}
Desired Tone: ${params.tone}
Target Spoken Length: ~${targetWords} words (~${estDurationSeconds} seconds). ${lengthDirective}
Format with natural paragraphs and clean breath pauses ready for text-to-speech narration. Do not include camera cues or visual brackets in fullScript.`;
  } else {
    prompt = `Write a complete spoken voiceover script in ${languageName}.
Category: ${params.category || 'General Voiceover'}
Platform: ${params.platform || 'Digital Media'}
Topic: ${params.topic}
Purpose: ${params.purpose || 'Inform and engage'}
Target Audience: ${params.audience || 'General audience'}
Writing Tone: ${params.tone}
Target Spoken Length: ~${targetWords} words (~${estDurationSeconds} seconds). ${lengthDirective}
Write clean, natural spoken prose ready for AI narration.`;
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: TEXT_GENERATION_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 16384,
        systemInstruction:
          'You are an expert broadcast scriptwriter and voiceover director. Produce natural, speakable scripts up to 2,000 words without robotic filler or unpronounceable symbols.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hook: { type: Type.STRING, description: 'Opening hook lines.' },
            mainContent: { type: Type.STRING, description: 'Core spoken body.' },
            transitions: { type: Type.STRING, description: 'Natural transition lines.' },
            ending: { type: Type.STRING, description: 'Closing summary lines.' },
            callToAction: { type: Type.STRING, description: 'Call to action lines (empty string if omitted).' },
            fullScript: {
              type: Type.STRING,
              description: 'Complete ready-to-narrate script combining all sections smoothly.',
            },
          },
          required: ['hook', 'mainContent', 'transitions', 'ending', 'callToAction', 'fullScript'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
    ScriptOutput,
    'estimatedDurationSeconds' | 'wordCount'
  >;

  const assembledParts = [
    parsed.hook,
    parsed.transitions,
    parsed.mainContent,
    parsed.ending,
    parsed.callToAction,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('\n\n');

  const rawFull = (parsed.fullScript || '').trim();
  const fullText = rawFull.length >= Math.round(assembledParts.length * 0.5) ? rawFull : assembledParts;
  const wordCount = fullText ? fullText.split(/\s+/).length : 0;
  // Average conversational narration speed ~140 words per minute (~2.33 words/sec)
  const estimatedDurationSeconds = Math.max(3, Math.round(wordCount / 2.33));

  return {
    hook: parsed.hook || '',
    mainContent: parsed.mainContent || '',
    transitions: parsed.transitions || '',
    ending: parsed.ending || '',
    callToAction: parsed.callToAction || '',
    fullScript: fullText,
    estimatedDurationSeconds,
    wordCount,
  };
}

export async function transformScriptContent(params: {
  script: string;
  action: 'rewrite' | 'shorten' | 'expand' | 'change-tone' | 'translate';
  tone?: string;
  targetLanguageCode?: string;
}): Promise<{ script: string; wordCount: number; estimatedDurationSeconds: number }> {
  const ai = getAiClient();
  const targetLang = params.targetLanguageCode ? getLanguageByCode(params.targetLanguageCode) : undefined;

  let instruction = '';
  switch (params.action) {
    case 'shorten':
      instruction = 'Condense this voiceover script by about 35-45% while preserving the core message, hook, and natural spoken cadence.';
      break;
    case 'expand':
      instruction = 'Expand this voiceover script with richer examples, smooth transitions, and natural spoken pacing (about 40% longer).';
      break;
    case 'change-tone':
      instruction = `Rewrite this voiceover script in a ${params.tone || 'professional'} spoken tone while preserving its meaning.`;
      break;
    case 'translate':
      instruction = `Translate and naturally adapt this voiceover script into ${targetLang?.name || params.targetLanguageCode || 'English'} for natural spoken narration.`;
      break;
    default:
      instruction = 'Rewrite and polish this voiceover script so it flows more naturally when read aloud by an AI voice.';
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: TEXT_GENERATION_MODEL,
      contents: `${instruction}\n\nScript:\n${params.script}`,
      config: {
        systemInstruction:
          'Return ONLY the updated ready-to-narrate script text without markdown fences or commentary.',
      },
    })
  );

  const updated = (response.text ?? '').trim();
  const wordCount = updated ? updated.split(/\s+/).length : 0;
  const estimatedDurationSeconds = Math.max(3, Math.round(wordCount / 2.33));
  return { script: updated, wordCount, estimatedDurationSeconds };
}

export async function translateTextWithGemini(params: {
  text: string;
  sourceLanguage: string; // 'auto' or language name/code
  targetLanguageCode: string;
}): Promise<{
  detectedSourceLanguage: string;
  translatedText: string;
  culturalNote: string;
}> {
  const ai = getAiClient();
  const targetLang = getLanguageByCode(params.targetLanguageCode);
  const sourceDesc =
    params.sourceLanguage === 'auto'
      ? 'automatically detect the source language'
      : `translate from ${getLanguageByCode(params.sourceLanguage)?.name || params.sourceLanguage}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: TEXT_GENERATION_MODEL,
      contents: `Please ${sourceDesc} and translate the following text into ${targetLang?.name || params.targetLanguageCode} so it sounds natural when spoken aloud.\n\nText:\n${params.text}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedSourceLanguage: { type: Type.STRING },
            translatedText: { type: Type.STRING },
            culturalNote: {
              type: Type.STRING,
              description: 'Brief note on idiom or pronunciation adaptation if relevant.',
            },
          },
          required: ['detectedSourceLanguage', 'translatedText', 'culturalNote'],
        },
      },
    })
  );

  return JSON.parse((response.text ?? '{}').trim()) as {
    detectedSourceLanguage: string;
    translatedText: string;
    culturalNote: string;
  };
}

export async function analyzePronunciationWithGemini(params: {
  text: string;
  languageCode: string;
}): Promise<{ tips: PronunciationTip[] }> {
  const ai = getAiClient();
  const lang = getLanguageByCode(params.languageCode);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: TEXT_GENERATION_MODEL,
      contents: `Analyze the following text (target language: ${lang?.name || params.languageCode}) for words, acronyms, names, loanwords, or numbers that a text-to-speech voice might mispronounce. Provide practical phonetic spelling guidance, a brief delivery instruction note, and simpler alternative wordings if helpful.\n\nText:\n${params.text}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tips: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  phoneticGuide: { type: Type.STRING },
                  instructionNote: { type: Type.STRING },
                  replacementSuggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['word', 'phoneticGuide', 'instructionNote', 'replacementSuggestions'],
              },
            },
          },
          required: ['tips'],
        },
      },
    })
  );

  return JSON.parse((response.text ?? '{"tips":[]}').trim()) as { tips: PronunciationTip[] };
}
