import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  FolderPlus,
  Loader2,
  Megaphone,
  Mic2,
  RefreshCw,
  Sparkles,
  Video,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';
import { voxApi } from '../../services/api';
import type {
  AudioFormat,
  EditorClip,
  GeneratedAudioClip,
  PublicAppConfig,
  SavedProject,
  ScriptOutput,
  UsageQuotaState,
} from '../../types/voxcraft';

interface ScriptStudioBaseProps {
  config: PublicAppConfig;
  onQuotaUpdate: (quota: UsageQuotaState) => void;
  onSendToTts: (text: string, languageCode: string, voiceId?: string) => void;
  onAudioGenerated: (clip: GeneratedAudioClip) => void;
  onProjectSaved: (projects: SavedProject[]) => void;
  onSendToEditor: (clip: Pick<EditorClip, 'title' | 'audioBase64' | 'mimeType' | 'durationSeconds'>) => void;
}

const SCRIPT_CATEGORIES = [
  'YouTube videos',
  'TikTok videos',
  'Facebook videos',
  'Instagram reels',
  'Business advertisements',
  'Product promotions',
  'Educational lessons',
  'Podcast introductions',
  'Motivational speeches',
  'Storytelling',
  'News-style narration',
  'Professional presentations',
];

export function ScriptWriterView({
  config,
  onQuotaUpdate,
  onSendToTts,
  onProjectSaved,
}: ScriptStudioBaseProps) {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState(SCRIPT_CATEGORIES[0]);
  const [purpose, setPurpose] = useState('Educate and engage viewers');
  const [audience, setAudience] = useState('Creators and entrepreneurs');
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [targetWords, setTargetWords] = useState(150);
  const [languageCode, setLanguageCode] = useState('en-US');
  const [tone, setTone] = useState('Confident & Engaging');
  const [platform, setPlatform] = useState('YouTube');

  const [generating, setGenerating] = useState(false);
  const [transforming, setTransforming] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [structuredOutput, setStructuredOutput] = useState<ScriptOutput | null>(null);
  const [editableScript, setEditableScript] = useState('');
  const [translateTarget, setTranslateTarget] = useState('fr');
  const [savedOk, setSavedOk] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!topic.trim()) {
      setErrorMsg('Please enter a topic for your script.');
      return;
    }
    setGenerating(true);
    try {
      const res = await voxApi.generateScript({
        mode: 'script-writer',
        topic,
        category,
        purpose,
        audience,
        durationSeconds,
        targetWords,
        languageCode,
        tone,
        platform,
      });
      onQuotaUpdate(res.quota);
      setStructuredOutput(res.output);
      setEditableScript(res.output.fullScript);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate script.');
    } finally {
      setGenerating(false);
    }
  };

  const handleTransform = async (action: 'rewrite' | 'shorten' | 'expand' | 'change-tone' | 'translate') => {
    if (!editableScript.trim()) return;
    setErrorMsg(null);
    setTransforming(action);
    try {
      const res = await voxApi.transformScript({
        script: editableScript,
        action,
        tone: action === 'change-tone' ? tone : undefined,
        targetLanguageCode: action === 'translate' ? translateTarget : undefined,
      });
      onQuotaUpdate(res.quota);
      setEditableScript(res.script);
      if (action === 'translate') {
        setLanguageCode(translateTarget);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update script.');
    } finally {
      setTransforming(null);
    }
  };

  const handleSave = async () => {
    if (!editableScript.trim()) return;
    const res = await voxApi.saveProject({
      title: topic.trim() ? `Script: ${topic.slice(0, 40)}` : 'AI Script',
      type: 'script',
      languageCode,
      voiceId: config.voices[0]?.id || 'Kore',
      content: editableScript,
      payload: { category, tone, platform, structuredOutput },
    });
    onProjectSaved(res.projects);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  const wordCount = editableScript.trim() ? editableScript.trim().split(/\s+/).length : 0;
  const estSeconds = Math.max(0, Math.round(wordCount / 2.33));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">AI Script Writer</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Generate structured hooks, body narration, transitions, and calls to action, then send directly to speech.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <form onSubmit={handleGenerate} className="xl:col-span-5 studio-surface rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Topic / Key Message</label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 5 practical ways small African businesses can accept global payments"
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Script Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {SCRIPT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Platform</label>
              <input
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Audience</label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Content Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {config.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Writing Tone</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Words (40–2,000)</label>
              <input
                type="number"
                min={40}
                max={2000}
                step={50}
                value={targetWords}
                onChange={(e) => {
                  const words = Math.min(2000, Math.max(40, Number(e.target.value) || 150));
                  setTargetWords(words);
                  setDurationSeconds(Math.round(words / 2.33));
                }}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1">Quick length:</span>
            {[150, 400, 800, 1400, 2000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTargetWords(preset);
                  setDurationSeconds(Math.round(preset / 2.33));
                }}
                className={`px-2 py-1 rounded-md font-mono tabular-nums transition-colors ${
                  targetWords === preset
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                {preset.toLocaleString()}w
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Structured Script
          </button>
        </form>

        <div className="xl:col-span-7 studio-surface rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-white">Editable Script Workspace</h2>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                <span className={wordCount > 2000 ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                  {wordCount.toLocaleString()}
                </span>{' '}
                / 2,000 words · Estimated read time: ~{estSeconds}s
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!editableScript.trim()}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white disabled:opacity-50"
              >
                {savedOk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
                {savedOk ? 'Saved' : 'Save Script'}
              </button>
              <button
                type="button"
                disabled={!editableScript.trim()}
                onClick={() => onSendToTts(editableScript, languageCode)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50"
              >
                Send to Text-to-Speech
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Script Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'rewrite', label: 'Rewrite' },
                { id: 'shorten', label: 'Shorten' },
                { id: 'expand', label: 'Expand' },
                { id: 'change-tone', label: 'Apply Current Tone' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                disabled={!editableScript.trim() || transforming !== null}
                onClick={() => handleTransform(btn.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-50"
              >
                {transforming === btn.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 text-blue-400" />
                )}
                {btn.label}
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-auto">
              <select
                value={translateTarget}
                onChange={(e) => setTranslateTarget(e.target.value)}
                className="rounded-lg bg-[#070B19] border border-slate-700 px-2 py-1 text-xs text-white"
              >
                {config.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!editableScript.trim() || transforming !== null}
                onClick={() => handleTransform('translate')}
                className="px-2.5 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 text-xs font-medium disabled:opacity-50"
              >
                {transforming === 'translate' ? 'Translating...' : 'Translate Script'}
              </button>
            </div>
          </div>

          <textarea
            rows={11}
            value={editableScript}
            onChange={(e) => setEditableScript(e.target.value)}
            placeholder="Your generated script will appear here—or paste any draft to rewrite, shorten, expand, or translate."
            className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
          />

          {structuredOutput && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="rounded-xl bg-[#070B19] border border-slate-800 p-3">
                <p className="font-semibold text-blue-400 mb-1">Opening Hook</p>
                <p className="text-slate-300">{structuredOutput.hook}</p>
              </div>
              <div className="rounded-xl bg-[#070B19] border border-slate-800 p-3">
                <p className="font-semibold text-violet-400 mb-1">Call to Action / Ending</p>
                <p className="text-slate-300">
                  {structuredOutput.callToAction || structuredOutput.ending}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const YOUTUBE_STYLES = [
  'Educational narration',
  'Documentary narration',
  'Entertainment',
  'Storytelling',
  'Motivational videos',
  'Explainer videos',
  'News commentary',
  'Faceless YouTube videos',
];

export function YouTubeVoiceoverView({
  config,
  onQuotaUpdate,
  onAudioGenerated,
  onProjectSaved,
  onSendToEditor,
}: ScriptStudioBaseProps) {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState(YOUTUBE_STYLES[0]);
  const [languageCode, setLanguageCode] = useState('en-US');
  const [voiceId, setVoiceId] = useState(config.voices[1]?.id || 'Puck');
  const [durationSeconds, setDurationSeconds] = useState(90);
  const [targetWords, setTargetWords] = useState(250);
  const [format, setFormat] = useState<AudioFormat>('wav');
  const [script, setScript] = useState('');

  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioClip, setAudioClip] = useState<GeneratedAudioClip | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const ytWordCount = script.trim() ? script.trim().split(/\s+/).length : 0;

  const handleGenerateScript = async () => {
    setErrorMsg(null);
    if (!topic.trim()) {
      setErrorMsg('Enter a YouTube video topic first, or paste your completed script on the right.');
      return;
    }
    setGeneratingScript(true);
    try {
      const res = await voxApi.generateScript({
        mode: 'youtube',
        topic,
        category: style,
        durationSeconds,
        targetWords,
        languageCode,
        tone: style,
      });
      onQuotaUpdate(res.quota);
      setScript(res.output.fullScript);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'YouTube script generation failed.');
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleGenerateAudio = async () => {
    setErrorMsg(null);
    if (!script.trim()) {
      setErrorMsg('Enter or generate a narration script first.');
      return;
    }
    if (ytWordCount > 2000) {
      setErrorMsg(
        `Narration script has ${ytWordCount.toLocaleString()} words, exceeding the 2,000-word limit per voiceover request.`
      );
      return;
    }
    setGeneratingAudio(true);
    try {
      const res = await voxApi.generateSpeech({
        text: script.trim(),
        voiceId,
        languageCode,
        emotionId: style.toLowerCase().includes('documentary') ? 'storytelling' : 'conversational',
        modelId: 'gemini-3.8-flash-tts',
        format,
        title: `YouTube: ${topic.trim().slice(0, 36) || style}`,
      });
      onQuotaUpdate(res.quota);
      const clip: GeneratedAudioClip = {
        id: res.id,
        title: `YouTube Narration · ${topic.trim().slice(0, 36) || style}`,
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        format: res.format,
        durationSeconds: res.durationSeconds,
        voiceId,
        languageCode,
        modelId: res.modelUsed,
        textSnippet: script.slice(0, 100),
        createdAt: res.createdAt,
      };
      setAudioClip(clip);
      onAudioGenerated(clip);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voiceover generation failed.');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleSaveProject = async () => {
    if (!script.trim()) return;
    const res = await voxApi.saveProject({
      title: topic.trim() ? `YouTube: ${topic.slice(0, 40)}` : `YouTube ${style}`,
      type: 'youtube',
      languageCode,
      voiceId,
      content: script,
      payload: { style, durationSeconds },
      audioId: audioClip?.id,
    });
    onProjectSaved(res.projects);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">YouTube Voiceover Studio</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Create natural-paced narration scripts and voiceovers for documentaries, explainers, and faceless channels.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 studio-surface rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Video Topic / Concept</label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., How ancient West African bronze casting worked and why it still amazes historians"
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Narration Format</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
            >
              {YOUTUBE_STYLES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {config.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Words (40–2,000)</label>
              <input
                type="number"
                min={40}
                max={2000}
                step={50}
                value={targetWords}
                onChange={(e) => {
                  const words = Math.min(2000, Math.max(40, Number(e.target.value) || 250));
                  setTargetWords(words);
                  setDurationSeconds(Math.round(words / 2.33));
                }}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1">Length preset:</span>
            {[250, 600, 1200, 2000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTargetWords(preset);
                  setDurationSeconds(Math.round(preset / 2.33));
                }}
                className={`px-2 py-1 rounded-md font-mono tabular-nums transition-colors ${
                  targetWords === preset
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                {preset.toLocaleString()}w
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={generatingScript}
            onClick={handleGenerateScript}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {generatingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4 text-blue-400" />}
            Generate YouTube Script
          </button>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Narrator Voice</label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {config.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.genderLabel})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Audio Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as AudioFormat)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white uppercase"
              >
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={generatingAudio}
            onClick={handleGenerateAudio}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {generatingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
            Generate YouTube Voiceover
          </button>
        </div>

        <div className="xl:col-span-7 space-y-5">
          <div className="studio-surface rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-white">Narration Script (Editable)</h2>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  <span className={ytWordCount > 2000 ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                    {ytWordCount.toLocaleString()}
                  </span>{' '}
                  / 2,000 words
                </p>
              </div>
              <button
                type="button"
                disabled={!script.trim()}
                onClick={handleSaveProject}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white disabled:opacity-50"
              >
                {savedOk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
                {savedOk ? 'Saved' : 'Save Project'}
              </button>
            </div>
            <textarea
              rows={11}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Generate a script on the left or paste up to 2,000 words of your completed YouTube narration script here..."
              className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
            />
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
              subtitle={`Voice: ${audioClip.voiceId} · ${audioClip.languageCode}`}
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
      </div>
    </div>
  );
}

const ADVERT_STYLES = [
  'Emotional',
  'Professional',
  'Persuasive',
  'Exciting',
  'Luxury brand',
  'Friendly',
  'Urgent promotional',
  'Corporate',
];

export function BusinessAdvertView({
  config,
  onQuotaUpdate,
  onAudioGenerated,
  onProjectSaved,
  onSendToEditor,
}: ScriptStudioBaseProps) {
  const [businessName, setBusinessName] = useState('');
  const [productOrService, setProductOrService] = useState('');
  const [description, setDescription] = useState('');
  const [targetCustomers, setTargetCustomers] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [targetDuration, setTargetDuration] = useState(30);
  const [style, setStyle] = useState(ADVERT_STYLES[2]);
  const [languageCode, setLanguageCode] = useState('en-US');
  const [includeHook, setIncludeHook] = useState(true);
  const [includeCta, setIncludeCta] = useState(true);

  const [voiceId, setVoiceId] = useState(config.voices[0]?.id || 'Kore');
  const [format, setFormat] = useState<AudioFormat>('wav');
  const [adScript, setAdScript] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioClip, setAudioClip] = useState<GeneratedAudioClip | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const wordCount = adScript.trim() ? adScript.trim().split(/\s+/).length : 0;
  const estimatedReadSeconds = Math.max(0, Math.round(wordCount / 2.33));

  const handleGenerateAdScript = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!businessName.trim() && !productOrService.trim()) {
      setErrorMsg('Enter at least your business name or product/service.');
      return;
    }
    setGeneratingScript(true);
    try {
      const res = await voxApi.generateScript({
        mode: 'advert',
        businessName,
        productOrService,
        purpose: description,
        audience: targetCustomers,
        sellingPoint,
        contactInfo,
        durationSeconds: targetDuration,
        languageCode,
        tone: style,
        includeHook,
        includeCta,
      });
      onQuotaUpdate(res.quota);
      setAdScript(res.output.fullScript);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Advertisement script generation failed.');
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleGenerateAdVoiceover = async () => {
    setErrorMsg(null);
    if (!adScript.trim()) {
      setErrorMsg('Generate or paste an advertisement script first.');
      return;
    }
    setGeneratingAudio(true);
    try {
      const res = await voxApi.generateSpeech({
        text: adScript.trim(),
        voiceId,
        languageCode,
        emotionId: style.toLowerCase().includes('luxury')
          ? 'serious'
          : style.toLowerCase().includes('urgent')
          ? 'energetic'
          : 'persuasive',
        customStyle: `${style} commercial voiceover announcer`,
        modelId: 'gemini-3.8-flash-tts',
        format,
        title: `Advert: ${businessName || productOrService || 'Promo'}`,
      });
      onQuotaUpdate(res.quota);
      const clip: GeneratedAudioClip = {
        id: res.id,
        title: `Advert · ${businessName || productOrService || 'Promo'}`,
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        format: res.format,
        durationSeconds: res.durationSeconds,
        voiceId,
        languageCode,
        modelId: res.modelUsed,
        textSnippet: adScript.slice(0, 100),
        createdAt: res.createdAt,
      };
      setAudioClip(clip);
      onAudioGenerated(clip);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voiceover generation failed.');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleSave = async () => {
    if (!adScript.trim()) return;
    const res = await voxApi.saveProject({
      title: `Advert: ${businessName || productOrService || 'Commercial'}`,
      type: 'advert',
      languageCode,
      voiceId,
      content: adScript,
      payload: { businessName, productOrService, style, targetDuration },
      audioId: audioClip?.id,
    });
    onProjectSaved(res.projects);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Business Advert Generator</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Draft persuasive commercial scripts with estimated read durations and export ready-to-air voiceovers.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <form onSubmit={handleGenerateAdScript} className="xl:col-span-5 studio-surface rounded-2xl p-5 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Zuri Solar Homes"
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Product or Service</label>
              <input
                type="text"
                value={productOrService}
                onChange={(e) => setProductOrService(e.target.value)}
                placeholder="24/7 Hybrid Solar Kits"
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Business Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Clean, quiet solar backup for homes and small offices"
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 p-2.5 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target Customers</label>
              <input
                type="text"
                value={targetCustomers}
                onChange={(e) => setTargetCustomers(e.target.value)}
                placeholder="Homeowners & remote teams"
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Main Selling Point</label>
              <input
                type="text"
                value={sellingPoint}
                onChange={(e) => setSellingPoint(e.target.value)}
                placeholder="Zero generator noise, 5-year warranty"
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Contact Info</label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="zurisolar.example"
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-2.5 py-2 text-sm text-white"
              >
                {ADVERT_STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target Seconds</label>
              <select
                value={targetDuration}
                onChange={(e) => setTargetDuration(Number(e.target.value))}
                className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-2.5 py-2 text-sm text-white font-mono tabular-nums"
              >
                <option value={15}>15s Spot</option>
                <option value={30}>30s Spot</option>
                <option value={45}>45s Spot</option>
                <option value={60}>60s Spot</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Language</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
            >
              {config.languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHook}
                onChange={(e) => setIncludeHook(e.target.checked)}
                className="rounded border-slate-600 bg-[#070B19]"
              />
              Strong Opening Hook
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCta}
                onChange={(e) => setIncludeCta(e.target.checked)}
                className="rounded border-slate-600 bg-[#070B19]"
              />
              Include Call to Action
            </label>
          </div>

          <button
            type="submit"
            disabled={generatingScript}
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {generatingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            Generate Advert Script
          </button>
        </form>

        <div className="xl:col-span-7 space-y-5">
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-white">Advertisement Script</h2>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  {wordCount} words · Estimated Duration (Estimate): ~{estimatedReadSeconds}s
                </p>
              </div>
              <button
                type="button"
                disabled={!adScript.trim()}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white disabled:opacity-50"
              >
                {savedOk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
                {savedOk ? 'Saved' : 'Save Advert'}
              </button>
            </div>

            <textarea
              rows={9}
              value={adScript}
              onChange={(e) => setAdScript(e.target.value)}
              placeholder="Your commercial voiceover script will appear here..."
              className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
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
                disabled={generatingAudio}
                onClick={handleGenerateAdVoiceover}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-60"
              >
                {generatingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
                Turn Into Voiceover
              </button>
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
              subtitle={`Style: ${style} · Voice: ${audioClip.voiceId}`}
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
      </div>
    </div>
  );
}
