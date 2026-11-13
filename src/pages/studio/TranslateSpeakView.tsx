import { useState } from 'react';
import {
  AlertCircle,
  Check,
  FolderPlus,
  Languages,
  Loader2,
  Mic2,
  RefreshCw,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';
import { voxApi } from '../../services/api';
import type {
  AudioFormat,
  EditorClip,
  GeneratedAudioClip,
  PublicAppConfig,
  SavedProject,
  UsageQuotaState,
} from '../../types/voxcraft';

interface TranslateSpeakViewProps {
  config: PublicAppConfig;
  onQuotaUpdate: (quota: UsageQuotaState) => void;
  onAudioGenerated: (clip: GeneratedAudioClip) => void;
  onProjectSaved: (projects: SavedProject[]) => void;
  onSendToEditor: (clip: Pick<EditorClip, 'title' | 'audioBase64' | 'mimeType' | 'durationSeconds'>) => void;
}

export function TranslateSpeakView({
  config,
  onQuotaUpdate,
  onAudioGenerated,
  onProjectSaved,
  onSendToEditor,
}: TranslateSpeakViewProps) {
  const [sourceText, setSourceText] = useState(
    'Welcome to our international training session. Today we will walk through clear steps anyone can follow.'
  );
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguageCode, setTargetLanguageCode] = useState('fr');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [culturalNote, setCulturalNote] = useState('');
  const [translatedForTargetCode, setTranslatedForTargetCode] = useState<string | null>(null);

  const [voiceId, setVoiceId] = useState(config.voices[0]?.id || 'Kore');
  const [format, setFormat] = useState<AudioFormat>('wav');
  const [translating, setTranslating] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioClip, setAudioClip] = useState<GeneratedAudioClip | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const sourceWordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
  const translatedWordCount = translatedText.trim() ? translatedText.trim().split(/\s+/).length : 0;

  const handleTranslate = async () => {
    setErrorMsg(null);
    if (!sourceText.trim()) {
      setErrorMsg('Enter source text to translate.');
      return;
    }
    if (sourceWordCount > 2000) {
      setErrorMsg('Source text exceeds 2,000 words per translation request.');
      return;
    }
    setTranslating(true);
    try {
      const res = await voxApi.translate({
        text: sourceText.trim(),
        sourceLanguage,
        targetLanguageCode,
      });
      onQuotaUpdate(res.quota);
      setTranslatedText(res.translatedText);
      setDetectedLanguage(res.detectedSourceLanguage);
      setCulturalNote(res.culturalNote);
      setTranslatedForTargetCode(targetLanguageCode);
      setAudioClip(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSpeakTranslation = async () => {
    setErrorMsg(null);
    if (!translatedText.trim()) {
      setErrorMsg('Translate your text first so the audio stays synchronized with the target language.');
      return;
    }
    setSpeaking(true);
    try {
      const activeLang = translatedForTargetCode || targetLanguageCode;
      const res = await voxApi.generateSpeech({
        text: translatedText.trim(),
        voiceId,
        languageCode: activeLang,
        emotionId: 'natural',
        modelId: 'gemini-3.8-flash-tts',
        format,
        title: `Translated (${activeLang})`,
      });
      onQuotaUpdate(res.quota);
      const clip: GeneratedAudioClip = {
        id: res.id,
        title: `Translation Audio · ${activeLang}`,
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        format: res.format,
        durationSeconds: res.durationSeconds,
        voiceId,
        languageCode: activeLang,
        modelId: res.modelUsed,
        textSnippet: translatedText.slice(0, 100),
        createdAt: res.createdAt,
      };
      setAudioClip(clip);
      onAudioGenerated(clip);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Target-language speech generation failed.');
    } finally {
      setSpeaking(false);
    }
  };

  const handleSave = async () => {
    if (!translatedText.trim()) return;
    const res = await voxApi.saveProject({
      title: `Translation → ${targetLanguageCode}`,
      type: 'translation',
      languageCode: targetLanguageCode,
      voiceId,
      content: translatedText,
      payload: { sourceText, sourceLanguage, detectedLanguage, culturalNote },
      audioId: audioClip?.id,
    });
    onProjectSaved(res.projects);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  const targetMismatch =
    translatedForTargetCode !== null && translatedForTargetCode !== targetLanguageCode;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Translate and Speak</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Translate scripts while keeping your original text intact side-by-side, edit freely, and generate speech in
          the target language.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Text Column */}
        <div className="studio-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-white">1. Original Text</h2>
            <select
              aria-label="Source language"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-1.5 text-xs sm:text-sm text-white"
            >
              <option value="auto">Auto-detect source language</option>
              {config.languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <textarea
            rows={8}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter up to 2,000 words of original text here. It will never be silently overwritten."
            className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs font-mono tabular-nums text-slate-400">
            {sourceWordCount.toLocaleString()} / 2,000 words · {sourceText.length.toLocaleString()} chars
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Translate to:</span>
              <select
                aria-label="Target language"
                value={targetLanguageCode}
                onChange={(e) => setTargetLanguageCode(e.target.value)}
                className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {config.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={translating}
              onClick={handleTranslate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-60"
            >
              {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              {translatedText ? 'Regenerate Translation' : 'Translate Text'}
            </button>
          </div>
        </div>

        {/* Translated Text & Speech Column */}
        <div className="studio-surface rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-white">2. Translated Script (Editable)</h2>
              {detectedLanguage && (
                <p className="text-xs text-slate-400">
                  Detected source: <span className="text-slate-200">{detectedLanguage}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {translatedText && (
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              )}
              <button
                type="button"
                disabled={!translatedText.trim()}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white disabled:opacity-50"
              >
                {savedOk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
                {savedOk ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>

          {targetMismatch && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-200">
              Target language changed to {targetLanguageCode}. Click "Regenerate Translation" to keep text and audio
              synchronized.
            </div>
          )}

          <textarea
            rows={8}
            value={translatedText}
            onChange={(e) => setTranslatedText(e.target.value)}
            placeholder="Translated text will appear here. You can edit any line before generating audio."
            className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs font-mono tabular-nums text-slate-400">
            {translatedWordCount.toLocaleString()} / 2,000 words · {translatedText.length.toLocaleString()} chars
          </p>

          {culturalNote && (
            <p className="text-xs text-slate-400 bg-[#070B19] border border-slate-800 rounded-lg p-2.5">
              Adaptation note: {culturalNote}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                aria-label="Target voice"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {config.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.genderLabel})
                  </option>
                ))}
              </select>
              <select
                aria-label="Format"
                value={format}
                onChange={(e) => setFormat(e.target.value as AudioFormat)}
                className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white uppercase"
              >
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
              </select>
            </div>

            <button
              type="button"
              disabled={speaking || !translatedText.trim()}
              onClick={handleSpeakTranslation}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm disabled:opacity-60"
            >
              {speaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
              Generate Target Audio
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {audioClip && (
        <AudioPlayer
          title={audioClip.title}
          subtitle={`Voice: ${audioClip.voiceId} · Language: ${audioClip.languageCode}`}
          audioBase64={audioClip.audioBase64}
          mimeType={audioClip.mimeType}
          format={audioClip.format}
          durationSeconds={audioClip.durationSeconds}
          onSendToEditor={() =>
            onSendToEditor({
              title: audioClip.title,
              audioBase64: audioClip.audioBase64,
              mimeType: audioClip.mimeType,
              durationSeconds: audioClip.durationSeconds,
            })
          }
        />
      )}
    </div>
  );
}
