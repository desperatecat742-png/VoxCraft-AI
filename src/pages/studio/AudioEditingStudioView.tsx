import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Download,
  FileAudio,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';
import { voxApi } from '../../services/api';
import {
  base64ToUint8Array,
  extractWaveformPeaks,
  formatTimecode,
  renderMixedTimelineToWav,
  uint8ArrayToBase64,
} from '../../utils/audioProcessor';
import type { AudioFormat, EditorClip, GeneratedAudioClip } from '../../types/voxcraft';

interface AudioEditingStudioViewProps {
  editorClips: EditorClip[];
  sessionClips: GeneratedAudioClip[];
  onUpdateClips: (clips: EditorClip[]) => void;
}

export function AudioEditingStudioView({
  editorClips,
  sessionClips,
  onUpdateClips,
}: AudioEditingStudioViewProps) {
  const [selectedImportId, setSelectedImportId] = useState(sessionClips[0]?.id || '');
  const [exportFormat, setExportFormat] = useState<AudioFormat>('wav');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportedMaster, setExportedMaster] = useState<{
    audioBase64: string;
    mimeType: string;
    format: AudioFormat;
    durationSeconds: number;
  } | null>(null);

  const liveAudioCtxRef = useRef<AudioContext | null>(null);
  const liveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  useEffect(() => {
    if (!selectedImportId && sessionClips.length > 0) {
      setSelectedImportId(sessionClips[0].id);
    }
  }, [sessionClips, selectedImportId]);

  const stopPreview = () => {
    if (liveTimerRef.current) {
      window.clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    if (liveAudioCtxRef.current) {
      liveAudioCtxRef.current.close().catch(() => {});
      liveAudioCtxRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  const computeSequentialStart = (existing: EditorClip[]): number => {
    if (existing.length === 0) return 0;
    const lastEnd = existing.reduce(
      (max, c) => Math.max(max, c.startOffsetSeconds + c.durationSeconds),
      0
    );
    return Number((lastEnd + 0.15).toFixed(2));
  };

  const handleImportSessionClip = async () => {
    setErrorMsg(null);
    const found = sessionClips.find((c) => c.id === selectedImportId);
    if (!found) return;
    try {
      const { peaks, durationSeconds } = await extractWaveformPeaks(found.audioBase64, 48);
      const nextClip: EditorClip = {
        id: `ed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: found.title,
        audioBase64: found.audioBase64,
        mimeType: found.mimeType,
        durationSeconds: durationSeconds || found.durationSeconds,
        startOffsetSeconds: computeSequentialStart(editorClips),
        volume: 1,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        waveformPeaks: peaks,
      };
      onUpdateClips([...editorClips, nextClip]);
    } catch {
      setErrorMsg('Failed to decode audio clip for editing.');
    }
  };

  const handleUploadLocalAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const arrayBuf = await file.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuf));
      const { peaks, durationSeconds } = await extractWaveformPeaks(base64, 48);
      const nextClip: EditorClip = {
        id: `ed_${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        audioBase64: base64,
        mimeType: file.type || 'audio/wav',
        durationSeconds,
        startOffsetSeconds: computeSequentialStart(editorClips),
        volume: 1,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        waveformPeaks: peaks,
      };
      onUpdateClips([...editorClips, nextClip]);
    } catch {
      setErrorMsg('Unsupported audio file. Upload a valid WAV or MP3 file.');
    }
  };

  const updateClip = (id: string, patch: Partial<EditorClip>) => {
    onUpdateClips(editorClips.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const moveClip = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= editorClips.length) return;
    const copy = [...editorClips];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    // Reflow sequential offsets automatically on reorder for convenience
    let cursor = 0;
    const reflowed = copy.map((c) => {
      const updated = { ...c, startOffsetSeconds: Number(cursor.toFixed(2)) };
      cursor += c.durationSeconds + 0.15;
      return updated;
    });
    onUpdateClips(reflowed);
  };

  const handlePreviewMix = async () => {
    setErrorMsg(null);
    if (isPreviewPlaying) {
      stopPreview();
      return;
    }
    if (editorClips.length === 0) {
      setErrorMsg('Import or upload at least one audio clip first.');
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      liveAudioCtxRef.current = ctx;
      setIsPreviewPlaying(true);

      let maxEnd = 0;
      const baseTime = ctx.currentTime + 0.05;

      for (const clip of editorClips) {
        const bytes = base64ToUint8Array(clip.audioBase64);
        const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
        const src = ctx.createBufferSource();
        src.buffer = decoded;

        const gain = ctx.createGain();
        const start = baseTime + Math.max(0, clip.startOffsetSeconds);
        const dur = decoded.duration;
        const targetVol = Math.max(0, Math.min(1.5, clip.volume));
        const fadeIn = Math.min(dur * 0.45, Math.max(0, clip.fadeInSeconds));
        const fadeOut = Math.min(dur * 0.45, Math.max(0, clip.fadeOutSeconds));

        if (fadeIn > 0.01) {
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(targetVol, start + fadeIn);
        } else {
          gain.gain.setValueAtTime(targetVol, start);
        }

        if (fadeOut > 0.01) {
          gain.gain.setValueAtTime(targetVol, Math.max(start + fadeIn, start + dur - fadeOut));
          gain.gain.linearRampToValueAtTime(0.0001, start + dur);
        }

        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(start);

        const end = clip.startOffsetSeconds + dur;
        if (end > maxEnd) maxEnd = end;
      }

      liveTimerRef.current = window.setTimeout(() => {
        stopPreview();
      }, Math.ceil((maxEnd + 0.2) * 1000));
    } catch {
      stopPreview();
      setErrorMsg('Browser audio playback failed. Check that all clips are valid audio.');
    }
  };

  const handleExportMaster = async () => {
    setErrorMsg(null);
    if (editorClips.length === 0) {
      setErrorMsg('Add at least one clip before exporting.');
      return;
    }
    setRendering(true);
    try {
      const { wavBase64, durationSeconds } = await renderMixedTimelineToWav(editorClips);
      if (exportFormat === 'mp3') {
        const encoded = await voxApi.encodeMp3(wavBase64);
        setExportedMaster({
          audioBase64: encoded.audioBase64,
          mimeType: 'audio/mpeg',
          format: 'mp3',
          durationSeconds,
        });
      } else {
        setExportedMaster({
          audioBase64: wavBase64,
          mimeType: 'audio/wav',
          format: 'wav',
          durationSeconds,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Master mix rendering failed.');
    } finally {
      setRendering(false);
    }
  };

  const totalTimelineDuration = editorClips.reduce(
    (max, c) => Math.max(max, c.startOffsetSeconds + c.durationSeconds),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Audio Editing Studio</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real Web Audio timeline mixer. Import generated clips or local audio, adjust timing, volume, and fades,
            preview the mix, and export WAV or MP3.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreviewMix}
            disabled={editorClips.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium border border-slate-700 disabled:opacity-50"
          >
            {isPreviewPlaying ? <Pause className="w-4 h-4 text-blue-400" /> : <Play className="w-4 h-4 text-blue-400" />}
            {isPreviewPlaying ? 'Stop Mix Preview' : 'Preview Full Mix'}
          </button>

          <select
            aria-label="Export format"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as AudioFormat)}
            className="rounded-xl bg-[#0D1326] border border-slate-700 px-3 py-2 text-sm text-white uppercase"
          >
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>

          <button
            type="button"
            disabled={editorClips.length === 0 || rendering}
            onClick={handleExportMaster}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Render &amp; Export Mix
          </button>
        </div>
      </div>

      {/* Import Bar */}
      <div className="studio-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <select
            aria-label="Generated session clips"
            value={selectedImportId}
            onChange={(e) => setSelectedImportId(e.target.value)}
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white min-w-[220px]"
          >
            {sessionClips.length === 0 ? (
              <option value="">No generated clips in session yet</option>
            ) : (
              sessionClips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({formatTimecode(c.durationSeconds)})
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            disabled={sessionClips.length === 0}
            onClick={handleImportSessionClip}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Import Clip to Timeline
          </button>
        </div>

        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white cursor-pointer">
          <Upload className="w-3.5 h-3.5 text-violet-400" />
          Upload Local WAV / MP3
          <input type="file" accept="audio/wav,audio/mpeg,audio/mp3,.wav,.mp3" onChange={handleUploadLocalAudio} className="hidden" />
        </label>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Timeline Clips */}
      <div className="studio-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">
            Timeline Arrangement ({editorClips.length} clip{editorClips.length === 1 ? '' : 's'})
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            Total Mix Duration: {formatTimecode(totalTimelineDuration)}
          </span>
        </div>

        {editorClips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
            <FileAudio className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-medium text-slate-300">Your timeline is empty</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Generate speech in Text-to-Speech, Conversation Studio, or Audiobook Maker and click "Open in Audio
              Studio", or upload local audio files above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {editorClips.map((clip, idx) => (
              <div
                key={clip.id}
                className="rounded-xl bg-[#070B19] border border-slate-800 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                    <input
                      type="text"
                      value={clip.title}
                      onChange={(e) => updateClip(clip.id, { title: e.target.value })}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 text-sm font-semibold text-white focus:outline-none"
                    />
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      ({formatTimecode(clip.durationSeconds)})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveClip(idx, -1)}
                      aria-label="Move clip earlier"
                      className="p-1.5 rounded-md text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === editorClips.length - 1}
                      onClick={() => moveClip(idx, 1)}
                      aria-label="Move clip later"
                      className="p-1.5 rounded-md text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateClips(editorClips.filter((c) => c.id !== clip.id))}
                      aria-label="Delete clip"
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Real Decoded Waveform Visualization */}
                <div className="h-12 flex items-center gap-[2px] px-2 rounded-lg bg-[#0D1326] border border-slate-800/80">
                  {clip.waveformPeaks.map((p, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-violet-400/75"
                      style={{ height: `${Math.round(p * 82)}%`, minHeight: '3px' }}
                    />
                  ))}
                </div>

                {/* Real Web Audio Parameters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Start Offset (sec)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={clip.startOffsetSeconds}
                      onChange={(e) =>
                        updateClip(clip.id, { startOffsetSeconds: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full rounded-lg bg-[#0D1326] border border-slate-700 px-2.5 py-1.5 text-white font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Volume ({Math.round(clip.volume * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={clip.volume}
                      onChange={(e) => updateClip(clip.id, { volume: Number(e.target.value) })}
                      className="w-full accent-blue-500 mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Fade In (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={clip.fadeInSeconds}
                      onChange={(e) =>
                        updateClip(clip.id, { fadeInSeconds: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full rounded-lg bg-[#0D1326] border border-slate-700 px-2.5 py-1.5 text-white font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Fade Out (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={clip.fadeOutSeconds}
                      onChange={(e) =>
                        updateClip(clip.id, { fadeOutSeconds: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full rounded-lg bg-[#0D1326] border border-slate-700 px-2.5 py-1.5 text-white font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {exportedMaster && (
        <AudioPlayer
          title="Master Exported Mix"
          subtitle={`${editorClips.length} clips mixed via Web Audio OfflineAudioContext`}
          audioBase64={exportedMaster.audioBase64}
          mimeType={exportedMaster.mimeType}
          format={exportedMaster.format}
          durationSeconds={exportedMaster.durationSeconds}
        />
      )}
    </div>
  );
}
