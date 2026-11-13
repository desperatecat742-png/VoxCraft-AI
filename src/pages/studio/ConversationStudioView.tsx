import { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  FolderPlus,
  Loader2,
  Mic2,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';
import { voxApi } from '../../services/api';
import type {
  AudioFormat,
  ConversationLine,
  ConversationSpeaker,
  EditorClip,
  GeneratedAudioClip,
  PublicAppConfig,
  SavedProject,
  UsageQuotaState,
} from '../../types/voxcraft';

interface ConversationStudioViewProps {
  config: PublicAppConfig;
  onQuotaUpdate: (quota: UsageQuotaState) => void;
  onAudioGenerated: (clip: GeneratedAudioClip) => void;
  onProjectSaved: (projects: SavedProject[]) => void;
  onSendToEditor: (clip: Pick<EditorClip, 'title' | 'audioBase64' | 'mimeType' | 'durationSeconds'>) => void;
}

export function ConversationStudioView({
  config,
  onQuotaUpdate,
  onAudioGenerated,
  onProjectSaved,
  onSendToEditor,
}: ConversationStudioViewProps) {
  const [title, setTitle] = useState('Business Podcast Intro');
  const [languageCode, setLanguageCode] = useState('en-US');
  const [format, setFormat] = useState<AudioFormat>('wav');

  const [speakers, setSpeakers] = useState<ConversationSpeaker[]>([
    { id: 'spk1', name: 'Speaker 1', voiceId: 'Puck', roleDescription: 'Warm, upbeat podcast host' },
    { id: 'spk2', name: 'Speaker 2', voiceId: 'Kore', roleDescription: 'Articulate, insightful guest' },
  ]);

  const [lines, setLines] = useState<ConversationLine[]>([
    { id: 'ln1', speakerId: 'spk1', text: 'Welcome to our business podcast. <breath> Today we are exploring how voice audio helps teams reach global audiences.' },
    { id: 'ln2', speakerId: 'spk2', text: 'Thank you for inviting me. |yeah| Multilingual storytelling has become essential for growing brands.' },
    { id: 'ln3', speakerId: 'spk1', text: 'Let us walk through how creators can build natural dialogue in just a few minutes.' },
  ]);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<string | null>(null);
  const [audioClip, setAudioClip] = useState<GeneratedAudioClip | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const addSpeaker = () => {
    const nextNum = speakers.length + 1;
    const defaultVoice = config.voices[(nextNum - 1) % config.voices.length]?.id || 'Charon';
    setSpeakers((prev) => [
      ...prev,
      {
        id: `spk_${Date.now()}`,
        name: `Speaker ${nextNum}`,
        voiceId: defaultVoice,
        roleDescription: 'Conversational guest',
      },
    ]);
  };

  const removeSpeaker = (id: string) => {
    if (speakers.length <= 1) return;
    const remaining = speakers.filter((s) => s.id !== id);
    setSpeakers(remaining);
    setLines((prev) =>
      prev.map((l) => (l.speakerId === id ? { ...l, speakerId: remaining[0].id } : l))
    );
  };

  const addLine = () => {
    const lastLine = lines[lines.length - 1];
    const nextSpeakerIdx = lastLine
      ? (speakers.findIndex((s) => s.id === lastLine.speakerId) + 1) % speakers.length
      : 0;
    setLines((prev) => [
      ...prev,
      {
        id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        speakerId: speakers[nextSpeakerIdx]?.id || speakers[0].id,
        text: '',
      },
    ]);
  };

  const moveLine = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= lines.length) return;
    const copy = [...lines];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setLines(copy);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    const validLines = lines
      .map((l) => {
        const spk = speakers.find((s) => s.id === l.speakerId) || speakers[0];
        return {
          speakerName: spk.name,
          voiceId: spk.voiceId,
          text: l.text.trim(),
          styleNote: spk.roleDescription,
        };
      })
      .filter((l) => l.text.length > 0);

    if (validLines.length === 0) {
      setErrorMsg('Please enter dialogue text in at least one line.');
      return;
    }

    setGenerating(true);
    try {
      const res = await voxApi.generateConversation({
        lines: validLines,
        languageCode,
        format,
        title: title.trim() || 'Conversation',
      });
      onQuotaUpdate(res.quota);
      setGenerationMode(
        res.mode === 'native-multi-speaker'
          ? 'Generated via native Gemini 3.8 dual-speaker synthesis'
          : 'Generated via sequential per-speaker synthesis & combined'
      );
      const clip: GeneratedAudioClip = {
        id: res.id,
        title: title.trim() || 'Conversation Audio',
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        format: res.format,
        durationSeconds: res.durationSeconds,
        voiceId: speakers.map((s) => s.voiceId).join(', '),
        languageCode,
        modelId: res.modelUsed,
        textSnippet: validLines.map((l) => `${l.speakerName}: ${l.text}`).join(' ').slice(0, 100),
        createdAt: res.createdAt,
      };
      setAudioClip(clip);
      onAudioGenerated(clip);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Conversation generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const res = await voxApi.saveProject({
      title: title.trim() || 'Conversation Project',
      type: 'conversation',
      languageCode,
      voiceId: speakers[0]?.voiceId || 'Puck',
      content: lines
        .map((l) => `${speakers.find((s) => s.id === l.speakerId)?.name || 'Speaker'}: ${l.text}`)
        .join('\n'),
      payload: { speakers, lines },
      audioId: audioClip?.id,
    });
    onProjectSaved(res.projects);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Conversation Studio</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Create multi-speaker podcasts and interviews. Supports 2-speaker native Gemini 3.8 Flash TTS and sequential
            combining for 3+ speakers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Conversation title"
            className="rounded-lg bg-[#0D1326] border border-slate-700 px-3 py-2 text-sm text-white w-48"
          />
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
          >
            {savedOk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
            {savedOk ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Speakers & Config */}
        <div className="xl:col-span-4 space-y-5">
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white">Speakers ({speakers.length})</h2>
              <button
                type="button"
                onClick={addSpeaker}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Speaker
              </button>
            </div>

            <div className="space-y-3">
              {speakers.map((spk) => (
                <div key={spk.id} className="rounded-xl bg-[#070B19] border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={spk.name}
                      onChange={(e) =>
                        setSpeakers((prev) =>
                          prev.map((s) => (s.id === spk.id ? { ...s, name: e.target.value } : s))
                        )
                      }
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 text-sm font-semibold text-white pb-0.5 focus:outline-none w-36"
                    />
                    {speakers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove ${spk.name}`}
                        onClick={() => removeSpeaker(spk.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={spk.voiceId}
                    onChange={(e) =>
                      setSpeakers((prev) =>
                        prev.map((s) => (s.id === spk.id ? { ...s, voiceId: e.target.value } : s))
                      )
                    }
                    className="w-full rounded-lg bg-[#0D1326] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  >
                    {config.voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.genderLabel})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={spk.roleDescription}
                    onChange={(e) =>
                      setSpeakers((prev) =>
                        prev.map((s) => (s.id === spk.id ? { ...s, roleDescription: e.target.value } : s))
                      )
                    }
                    placeholder="Delivery style (e.g., curious co-host)"
                    className="w-full rounded-lg bg-[#0D1326] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Language</label>
                <select
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-2.5 py-2 text-xs text-white"
                >
                  {config.languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as AudioFormat)}
                  className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-2.5 py-2 text-xs text-white uppercase"
                >
                  <option value="wav">WAV</option>
                  <option value="mp3">MP3</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tip: With 2 speakers, Gemini 3.8 Flash TTS supports expressive cues like{' '}
              <code className="font-mono text-blue-300">|yeah|</code>,{' '}
              <code className="font-mono text-blue-300">|mhm|</code>, and{' '}
              <code className="font-mono text-blue-300">&lt;breath&gt;</code>.
            </p>
          </div>
        </div>

        {/* Dialogue Timeline */}
        <div className="xl:col-span-8 space-y-5">
          <div className="studio-surface rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white">
                Dialogue Lines ({lines.length})
              </h2>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Line
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className="rounded-xl bg-[#070B19] border border-slate-800 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-5">{idx + 1}.</span>
                      <select
                        value={line.speakerId}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) => (l.id === line.id ? { ...l, speakerId: e.target.value } : l))
                          )
                        }
                        className="rounded-lg bg-[#0D1326] border border-slate-700 px-2.5 py-1 text-xs font-medium text-white"
                      >
                        {speakers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.voiceId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Move line up"
                        disabled={idx === 0}
                        onClick={() => moveLine(idx, -1)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move line down"
                        disabled={idx === lines.length - 1}
                        onClick={() => moveLine(idx, 1)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          aria-label="Delete line"
                          onClick={() => removeLine(line.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={line.text}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, text: e.target.value } : l))
                      )
                    }
                    placeholder="Enter what this speaker says..."
                    className="w-full rounded-lg bg-[#0D1326] border border-slate-800 p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-60"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
                Generate Conversation Audio
              </button>
            </div>
          </div>

          {audioClip && (
            <AudioPlayer
              title={audioClip.title}
              subtitle={generationMode || `Language: ${audioClip.languageCode}`}
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
