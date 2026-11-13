import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Eraser,
  FolderPlus,
  Loader2,
  Mic2,
  Play,
  Search,
  Sparkles,
  Volume2,
  Wand2,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';
import { voxApi } from '../../services/api';
import { base64ToBlobUrl } from '../../utils/audioProcessor';
import type {
  AudioFormat,
  EditorClip,
  GeneratedAudioClip,
  PronunciationTip,
  PublicAppConfig,
  SavedProject,
  TtsModelId,
  UsageQuotaState,
  VoiceCategory,
} from '../../types/voxcraft';

interface TextToSpeechViewProps {
  config: PublicAppConfig;
  quota: UsageQuotaState;
  initialText?: string;
  initialVoiceId?: string;
  initialLanguageCode?: string;
  onQuotaUpdate: (quota: UsageQuotaState) => void;
  onAudioGenerated: (clip: GeneratedAudioClip) => void;
  onProjectSaved: (projects: SavedProject[]) => void;
  onSendToEditor: (clip: Pick<EditorClip, 'title' | 'audioBase64' | 'mimeType' | 'durationSeconds'>) => void;
}

const VOICE_CATEGORIES: ('All' | VoiceCategory)[] = [
  'All',
  'Male',
  'Female',
  'Neutral',
  'Storytelling',
  'Professional',
  'Conversational',
  'Expressive',
];

export function TextToSpeechView({
  config,
  quota,
  initialText = '',
  initialVoiceId,
  initialLanguageCode,
  onQuotaUpdate,
  onAudioGenerated,
  onProjectSaved,
  onSendToEditor,
}: TextToSpeechViewProps) {
  const [projectTitle, setProjectTitle] = useState('Untitled Voiceover');
  const [text, setText] = useState(
    initialText ||
      'Welcome to VoxCraft AI. Type or paste your script here to produce clear, expressive speech in WAV or MP3 format.'
  );
  const [voiceId, setVoiceId] = useState(initialVoiceId || config.voices[0]?.id || 'Kore');
  const [languageCode, setLanguageCode] = useState(initialLanguageCode || 'en-US');
  const [emotionId, setEmotionId] = useState('natural');
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [customStyle, setCustomStyle] = useState('');
  const [pronunciationNotes, setPronunciationNotes] = useState('');
  const [modelId, setModelId] = useState<TtsModelId>('gemini-3.8-flash-lite-tts');
  const [format, setFormat] = useState<AudioFormat>('wav');

  const [voiceCategoryFilter, setVoiceCategoryFilter] = useState<'All' | VoiceCategory>('All');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [langSearch, setLangSearch] = useState('');
  const [africanOnly, setAfricanOnly] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedClip, setGeneratedClip] = useState<GeneratedAudioClip | null>(null);

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudioEl, setPreviewAudioEl] = useState<HTMLAudioElement | null>(null);

  // Pronunciation assistance
  const [analyzingPronunciation, setAnalyzingPronunciation] = useState(false);
  const [pronunciationTips, setPronunciationTips] = useState<PronunciationTip[]>([]);
  const [pronunciationError, setPronunciationError] = useState<string | null>(null);

  // Save project feedback
  const [savingProject, setSavingProject] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (initialVoiceId) setVoiceId(initialVoiceId);
  }, [initialVoiceId]);

  useEffect(() => {
    if (initialLanguageCode) setLanguageCode(initialLanguageCode);
  }, [initialLanguageCode]);

  const selectedLanguage = config.languages.find((l) => l.code === languageCode);
  const selectedVoice = config.voices.find((v) => v.id === voiceId);

  const filteredVoices = config.voices.filter((v) => {
    const matchesCat = voiceCategoryFilter === 'All' || v.categories.includes(voiceCategoryFilter);
    const q = voiceSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.timbre.toLowerCase().includes(q) ||
      v.bestFor.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const filteredLanguages = config.languages.filter((l) => {
    if (africanOnly && !l.isAfricanCollection) return false;
    const q = langSearch.trim().toLowerCase();
    return (
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.region.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (filteredLanguages.length > 0 && !filteredLanguages.some((l) => l.code === languageCode)) {
      setLanguageCode(filteredLanguages[0].code);
    }
  }, [filteredLanguages, languageCode]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleLoadSample = () => {
    if (selectedLanguage) {
      setText(selectedLanguage.sampleText);
    } else {
      setText(
        'Every great story begins with a voice that listeners trust. Shape your pacing, tone, and clarity in seconds.'
      );
    }
  };

  const handlePreviewVoice = async (targetVoiceId: string) => {
    setErrorMsg(null);
    if (previewAudioEl) {
      previewAudioEl.pause();
      setPreviewAudioEl(null);
    }
    setPreviewingVoiceId(targetVoiceId);
    let blobUrl: string | null = null;
    try {
      const res = await voxApi.previewVoice(targetVoiceId, languageCode);
      blobUrl = base64ToBlobUrl(res.audioBase64, res.mimeType);
      const audio = new Audio(blobUrl);
      setPreviewAudioEl(audio);
      audio.onended = () => {
        setPreviewingVoiceId(null);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
      await audio.play();
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to preview voice.');
      setPreviewingVoiceId(null);
    }
  };

  const handleAnalyzePronunciation = async () => {
    setPronunciationError(null);
    if (!text.trim()) {
      setPronunciationError('Enter some text first so we can check for tricky words.');
      return;
    }
    setAnalyzingPronunciation(true);
    try {
      const res = await voxApi.analyzePronunciation(text, languageCode);
      setPronunciationTips(res.tips);
    } catch (err) {
      setPronunciationError(err instanceof Error ? err.message : 'Pronunciation analysis failed.');
    } finally {
      setAnalyzingPronunciation(false);
    }
  };

  const handleApplyReplacement = (originalWord: string, replacement: string) => {
    if (!originalWord) return;
    const escaped = originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    setText((prev) => prev.replace(regex, replacement));
  };

  const handleAddPronunciationInstruction = (word: string, phonetic: string) => {
    const note = `Pronounce "${word}" as "${phonetic}"`;
    setPronunciationNotes((prev) => (prev ? `${prev}; ${note}` : note));
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    const clean = text.trim();
    if (!clean) {
      setErrorMsg('Please enter or paste text before generating speech.');
      return;
    }
    if (wordCount > 2000) {
      setErrorMsg(
        `Script has ${wordCount.toLocaleString()} words, exceeding the 2,000-word limit per request. Shorten slightly or use Audiobook Maker for longer books.`
      );
      return;
    }
    if (clean.length > quota.maxCharsPerRequest) {
      setErrorMsg(
        `Text exceeds the ${quota.maxCharsPerRequest.toLocaleString()} character limit per request. Shorten the passage or use Audiobook Maker for multi-part chapters.`
      );
      return;
    }

    setGenerating(true);
    try {
      const res = await voxApi.generateSpeech({
        text: clean,
        voiceId,
        languageCode,
        emotionId,
        speed,
        customStyle,
        pronunciationNotes,
        modelId,
        format,
        title: projectTitle.trim() || `${voiceId} Voiceover`,
      });
      onQuotaUpdate(res.quota);

      const clip: GeneratedAudioClip = {
        id: res.id,
        title: projectTitle.trim() || `${voiceId} · ${selectedLanguage?.name || languageCode}`,
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        format: res.format,
        durationSeconds: res.durationSeconds,
        voiceId,
        languageCode,
        modelId: res.modelUsed,
        textSnippet: clean.slice(0, 100),
        createdAt: res.createdAt,
      };
      setGeneratedClip(clip);
      onAudioGenerated(clip);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Speech generation failed. Please retry.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveProject = async () => {
    if (!text.trim()) return;
    setSavingProject(true);
    setSavedNotice(null);
    try {
      const res = await voxApi.saveProject({
        title: projectTitle.trim() || 'Untitled Voiceover',
        type: 'tts',
        languageCode,
        voiceId,
        content: text,
        payload: { emotionId, speed, customStyle, pronunciationNotes, modelId },
        audioId: generatedClip?.id,
      });
      onProjectSaved(res.projects);
      setSavedNotice('Project saved');
      setTimeout(() => setSavedNotice(null), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save project.');
    } finally {
      setSavingProject(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Text-to-Speech Studio</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Convert scripts into natural speech with verified Gemini 3.8 voices, delivery styles, and WAV/MP3 export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Project title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="rounded-lg bg-[#0D1326] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-48 sm:w-56"
          />
          <button
            type="button"
            disabled={savingProject}
            onClick={handleSaveProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {savedNotice ? <Check className="w-4 h-4 text-emerald-400" /> : <FolderPlus className="w-4 h-4" />}
            {savedNotice || 'Save Project'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Script Editor + Output Audio + Pronunciation Control */}
        <div className="xl:col-span-7 space-y-5">
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Load Sample Text
                </button>
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-400">
                <span className={wordCount > 2000 ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                  {wordCount.toLocaleString()}
                </span>{' '}
                / 2,000 words ·{' '}
                <span className={text.length > quota.maxCharsPerRequest ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                  {text.length.toLocaleString()}
                </span>{' '}
                / {quota.maxCharsPerRequest.toLocaleString()} chars · Remaining today:{' '}
                <span className="text-blue-400">{quota.charactersRemainingToday.toLocaleString()}</span>
              </div>
            </div>

            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write or paste up to 2,000 words of your script here..."
              className="w-full rounded-xl bg-[#070B19] border border-slate-700/90 p-4 text-sm sm:text-base text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
            />

            {errorMsg && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Selected:</span>
                <span className="text-slate-200 font-medium">{selectedVoice?.name}</span>
                <span>·</span>
                <span className="text-slate-200 font-medium">{selectedLanguage?.name}</span>
              </div>

              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Speech...
                  </>
                ) : (
                  <>
                    <Mic2 className="w-4 h-4" />
                    Generate Voice ({format.toUpperCase()})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Audio Player */}
          {generatedClip && (
            <AudioPlayer
              title={generatedClip.title}
              subtitle={`Model: ${generatedClip.modelId} · Voice: ${generatedClip.voiceId} · ${generatedClip.languageCode}`}
              audioBase64={generatedClip.audioBase64}
              mimeType={generatedClip.mimeType}
              format={generatedClip.format}
              durationSeconds={generatedClip.durationSeconds}
              onSendToEditor={() =>
                onSendToEditor({
                  title: generatedClip.title,
                  audioBase64: generatedClip.audioBase64,
                  mimeType: generatedClip.mimeType,
                  durationSeconds: generatedClip.durationSeconds,
                })
              }
            />
          )}

          {/* Pronunciation & Speech Control Assistant */}
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Pronunciation &amp; Speech Control
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identify names, acronyms, or regional words and attach pronunciation instructions for Gemini TTS.
                </p>
              </div>
              <button
                type="button"
                disabled={analyzingPronunciation}
                onClick={handleAnalyzePronunciation}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                {analyzingPronunciation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                Analyze Difficult Words
              </button>
            </div>

            <div>
              <label htmlFor="pronunciation-notes" className="block text-xs font-medium text-slate-400 mb-1.5">
                Custom Pronunciation Instructions (optional)
              </label>
              <input
                id="pronunciation-notes"
                type="text"
                value={pronunciationNotes}
                onChange={(e) => setPronunciationNotes(e.target.value)}
                placeholder='Example: Pronounce "Lekki" as "LEH-kee"; read "AI" as two letters A-I'
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {pronunciationError && (
              <p className="text-xs text-rose-400">{pronunciationError}</p>
            )}

            {pronunciationTips.length > 0 && (
              <div className="space-y-2.5 pt-1">
                {pronunciationTips.map((tip, idx) => (
                  <div
                    key={`${tip.word}-${idx}`}
                    className="rounded-xl bg-[#070B19] border border-slate-800 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-white">{tip.word}</span>
                        <span className="text-xs text-blue-400 font-mono ml-2">/{tip.phoneticGuide}/</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddPronunciationInstruction(tip.word, tip.phoneticGuide)}
                        className="text-xs font-medium text-violet-300 hover:text-violet-200"
                      >
                        + Add Instruction
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">{tip.instructionNote}</p>
                    {tip.replacementSuggestions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-slate-500">Replace in script:</span>
                        {tip.replacementSuggestions.map((alt) => (
                          <button
                            key={alt}
                            type="button"
                            onClick={() => handleApplyReplacement(tip.word, alt)}
                            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Voice, Language, Emotion & Speech Controls */}
        <div className="xl:col-span-5 space-y-5">
          {/* Voice Selection */}
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-white">Voice Library</h2>
              <span className="text-xs text-slate-400">Verified Gemini Voices</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="Search voices or traits..."
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {VOICE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVoiceCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    voiceCategoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredVoices.map((v) => {
                const selected = v.id === voiceId;
                const isPreviewing = previewingVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`rounded-xl p-3 border transition-colors flex items-center justify-between gap-3 ${
                      selected
                        ? 'bg-blue-600/15 border-blue-500/60'
                        : 'bg-[#070B19]/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setVoiceId(v.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-white">{v.name}</span>
                        <span className="text-xs text-slate-400">· {v.genderLabel}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{v.timbre}</p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Preview ${v.name}`}
                      onClick={() => handlePreviewVoice(v.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1 shrink-0"
                    >
                      {isPreviewing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      Preview
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Language & African Collection Selector */}
          <div className="studio-surface rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-white">Language &amp; Accent Target</h2>
              <button
                type="button"
                onClick={() => setAfricanOnly((v) => !v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  africanOnly
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                African Collection
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                placeholder="Search languages (e.g., Nigerian, Swahili, French)..."
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              aria-label="Select target language"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {filteredLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.region})
                </option>
              ))}
            </select>

            {selectedLanguage && (
              <div className="rounded-lg bg-[#070B19]/90 border border-slate-800 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">Availability Status</span>
                  <span className="text-blue-400 font-medium">
                    {selectedLanguage.supportTier === 'multilingual-native'
                      ? 'Multilingual Supported'
                      : selectedLanguage.supportTier === 'style-guided'
                      ? 'Style-Guided Accent'
                      : 'Pronunciation-Guided'}
                  </span>
                </div>
                <p className="text-slate-400">{selectedLanguage.availabilityNote}</p>
              </div>
            )}
          </div>

          {/* Speech Delivery & Model Settings */}
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-white">Emotion, Style &amp; Format</h2>

            <div>
              <label htmlFor="emotion-select" className="block text-xs font-medium text-slate-400 mb-1.5">
                Emotion &amp; Delivery Style (Natural-Language Instruction)
              </label>
              <select
                id="emotion-select"
                value={emotionId}
                onChange={(e) => setEmotionId(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {config.emotionStyles.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label} — {st.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Speaking Pace</label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#070B19] border border-slate-800">
                  {(['slow', 'normal', 'fast'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                        speed === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Export Format</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#070B19] border border-slate-800">
                  {(['wav', 'mp3'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-1.5 text-xs font-medium rounded-md uppercase transition-colors ${
                        format === fmt ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="custom-style" className="block text-xs font-medium text-slate-400 mb-1.5">
                Custom Style / Voice Design Instruction (optional)
              </label>
              <input
                id="custom-style"
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g., Warm documentary narrator, soft breath pauses"
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="tts-model" className="block text-xs font-medium text-slate-400 mb-1.5">
                Gemini Speech Model
              </label>
              <select
                id="tts-model"
                value={modelId}
                onChange={(e) => setModelId(e.target.value as TtsModelId)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {config.ttsModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                Style controls guide delivery via Gemini speechMetadata instructions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
