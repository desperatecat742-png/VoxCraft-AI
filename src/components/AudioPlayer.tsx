import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Pause, Play, Scissors, Volume2 } from 'lucide-react';
import {
  base64ToBlobUrl,
  extractWaveformPeaks,
  formatTimecode,
  triggerAudioDownload,
} from '../utils/audioProcessor';
import { voxApi } from '../services/api';
import type { AudioFormat } from '../types/voxcraft';

interface AudioPlayerProps {
  title: string;
  audioBase64: string;
  mimeType: string;
  format: AudioFormat;
  durationSeconds?: number;
  subtitle?: string;
  onSendToEditor?: () => void;
}

export function AudioPlayer({
  title,
  audioBase64,
  mimeType,
  format,
  durationSeconds: initialDuration = 0,
  subtitle,
  onSendToEditor,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [peaks, setPeaks] = useState<number[]>(() =>
    Array.from({ length: 48 }, (_, i) => 0.25 + ((Math.sin(i * 0.6) + 1) * 0.3))
  );
  const [downloadingFormat, setDownloadingFormat] = useState<AudioFormat | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const objectUrl = useMemo(() => {
    return base64ToBlobUrl(audioBase64, mimeType);
  }, [audioBase64, mimeType]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    let cancelled = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(initialDuration);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
    extractWaveformPeaks(audioBase64, 52)
      .then((res) => {
        if (!cancelled) {
          setPeaks(res.peaks);
          if (res.durationSeconds > 0) setDuration(res.durationSeconds);
        }
      })
      .catch(() => {
        // Fallback silently to uniform waveform if browser decode hits edge case
      });
    return () => {
      cancelled = true;
    };
  }, [audioBase64, initialDuration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (ratio: number) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const next = Math.max(0, Math.min(duration, ratio * duration));
    el.currentTime = next;
    setCurrentTime(next);
  };

  const handleDownload = async (targetFormat: AudioFormat) => {
    setDownloadError(null);
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voxcraft-audio';

    if (targetFormat === format) {
      triggerAudioDownload(audioBase64, mimeType, `${safeName}.${targetFormat}`);
      return;
    }

    if (targetFormat === 'mp3' && format === 'wav') {
      try {
        setDownloadingFormat('mp3');
        const encoded = await voxApi.encodeMp3(audioBase64);
        triggerAudioDownload(encoded.audioBase64, 'audio/mpeg', `${safeName}.mp3`);
      } catch (err) {
        setDownloadError(err instanceof Error ? err.message : 'MP3 conversion failed.');
      } finally {
        setDownloadingFormat(null);
      }
      return;
    }

    // If clip was generated directly as MP3 and user asks for WAV, re-export via browser Web Audio or direct MP3
    triggerAudioDownload(audioBase64, mimeType, `${safeName}.${format}`);
  };

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="studio-surface rounded-xl p-4 sm:p-5 space-y-4">
      <audio
        ref={audioRef}
        src={objectUrl}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setDuration(e.currentTarget.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-display text-sm sm:text-base font-semibold text-white truncate">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span>{format.toUpperCase()}</span>
          <span aria-hidden="true">·</span>
          <span>{formatTimecode(currentTime)} / {formatTimecode(duration)}</span>
        </div>
      </div>

      {/* Interactive Waveform Bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div
          role="slider"
          aria-label="Audio playback progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            handleSeek(ratio);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') handleSeek(progressRatio + 0.05);
            if (e.key === 'ArrowLeft') handleSeek(progressRatio - 0.05);
          }}
          className="flex-1 h-12 flex items-center gap-[3px] cursor-pointer px-1 rounded-lg bg-[#070B19]/60 border border-slate-800/80"
        >
          {peaks.map((peak, idx) => {
            const barProgress = idx / peaks.length;
            const active = barProgress <= progressRatio;
            return (
              <div
                key={idx}
                className={`flex-1 rounded-full transition-colors ${
                  active ? 'bg-blue-400' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                style={{ height: `${Math.round(peak * 82)}%`, minHeight: '4px' }}
              />
            );
          })}
        </div>
      </div>

      {/* Controls & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">Speed:</span>
          {[0.85, 1, 1.15, 1.25].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setPlaybackRate(rate)}
              className={`px-2 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 ${
                playbackRate === rate
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {format === 'wav' && (
            <button
              type="button"
              onClick={() => handleDownload('wav')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download WAV
            </button>
          )}
          <button
            type="button"
            disabled={downloadingFormat === 'mp3'}
            onClick={() => handleDownload('mp3')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {downloadingFormat === 'mp3' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download MP3
          </button>
          {onSendToEditor && (
            <button
              type="button"
              onClick={onSendToEditor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 transition-colors whitespace-nowrap shrink-0"
            >
              <Scissors className="w-3.5 h-3.5" />
              Open in Audio Studio
            </button>
          )}
        </div>
      </div>

      {downloadError && (
        <p className="text-xs text-rose-400">{downloadError}</p>
      )}
    </div>
  );
}
