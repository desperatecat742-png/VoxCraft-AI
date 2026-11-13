import type { EditorClip } from '../types/voxcraft';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBlobUrl(base64: string, mimeType: string): string {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function triggerAudioDownload(base64: string, mimeType: string, filename: string): void {
  const url = base64ToBlobUrl(base64, mimeType);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Decodes real audio data using Web Audio API and computes normalized amplitude peaks
 * for accurate studio waveform rendering.
 */
export async function extractWaveformPeaks(
  base64: string,
  barCount = 56
): Promise<{ peaks: number[]; durationSeconds: number }> {
  const bytes = base64ToUint8Array(base64);
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
    const channelData = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
    const peaks: number[] = [];

    for (let i = 0; i < barCount; i++) {
      const start = i * blockSize;
      const end = Math.min(channelData.length, start + blockSize);
      let maxAmp = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > maxAmp) maxAmp = abs;
      }
      peaks.push(Math.max(0.08, Math.min(1, maxAmp)));
    }

    return {
      peaks,
      durationSeconds: Number(decoded.duration.toFixed(2)),
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Encodes a Web Audio AudioBuffer (mono or mixed down to mono 16-bit PCM) into a valid WAV Uint8Array.
 */
function audioBufferToWavBytes(audioBuffer: AudioBuffer): Uint8Array {
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const numChannels = 1;
  const channelData = audioBuffer.getChannelData(0);

  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Mixes multi-track/arranged timeline clips with real Web Audio OfflineAudioContext,
 * applying exact start offsets, clip volumes, and fade-in / fade-out ramps.
 */
export async function renderMixedTimelineToWav(clips: EditorClip[]): Promise<{
  wavBase64: string;
  durationSeconds: number;
}> {
  if (clips.length === 0) {
    throw new Error('Add at least one clip to the timeline before exporting.');
  }

  const sampleRate = 24000;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtx({ sampleRate });

  const decodedBuffers: { clip: EditorClip; buffer: AudioBuffer }[] = [];
  let maxEndTime = 0;

  try {
    for (const clip of clips) {
      const bytes = base64ToUint8Array(clip.audioBase64);
      const decoded = await tempCtx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
      decodedBuffers.push({ clip, buffer: decoded });
      const clipEnd = Math.max(0, clip.startOffsetSeconds) + decoded.duration;
      if (clipEnd > maxEndTime) maxEndTime = clipEnd;
    }
  } finally {
    await tempCtx.close().catch(() => {});
  }

  const totalFrames = Math.max(sampleRate, Math.ceil(maxEndTime * sampleRate));
  const offline = new OfflineAudioContext(1, totalFrames, sampleRate);

  for (const { clip, buffer } of decodedBuffers) {
    const source = offline.createBufferSource();
    source.buffer = buffer;

    const gainNode = offline.createGain();
    const start = Math.max(0, clip.startOffsetSeconds);
    const dur = buffer.duration;
    const targetVol = Math.max(0, Math.min(1.5, clip.volume));
    const fadeIn = Math.min(dur * 0.45, Math.max(0, clip.fadeInSeconds));
    const fadeOut = Math.min(dur * 0.45, Math.max(0, clip.fadeOutSeconds));

    if (fadeIn > 0.01) {
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.linearRampToValueAtTime(targetVol, start + fadeIn);
    } else {
      gainNode.gain.setValueAtTime(targetVol, start);
    }

    if (fadeOut > 0.01) {
      const fadeOutStart = Math.max(start + fadeIn, start + dur - fadeOut);
      gainNode.gain.setValueAtTime(targetVol, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0.0001, start + dur);
    }

    source.connect(gainNode);
    gainNode.connect(offline.destination);
    source.start(start);
  }

  const rendered = await offline.startRendering();
  const wavBytes = audioBufferToWavBytes(rendered);
  return {
    wavBase64: uint8ArrayToBase64(wavBytes),
    durationSeconds: Number(rendered.duration.toFixed(2)),
  };
}

/**
 * Splits long-form book/document content into model-safe chunks at natural paragraph
 * and sentence boundaries without cutting sentences mid-way.
 */
export function splitTextIntoSmartChunks(text: string, maxChars = 1400): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  const pushSentencewise = (paragraph: string) => {
    const sentences = paragraph.match(/[^.!?]+[.!?]+[\])"']*|\s*[^.!?]+$/g) || [paragraph];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (trimmed.length > maxChars) {
        // Fallback only for extraordinarily long run-on sentences without punctuation
        const words = trimmed.split(/\s+/);
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
          if ((current + ' ' + wordBuf).trim().length <= maxChars) {
            current = current ? `${current} ${wordBuf}` : wordBuf;
          } else {
            if (current) chunks.push(current);
            current = wordBuf;
          }
        }
        continue;
      }

      if ((current + ' ' + trimmed).trim().length > maxChars) {
        if (current) chunks.push(current);
        current = trimmed;
      } else {
        current = current ? `${current} ${trimmed}` : trimmed;
      }
    }
  };

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;
    if ((current + '\n\n' + trimmedPara).trim().length <= maxChars) {
      current = current ? `${current}\n\n${trimmedPara}` : trimmedPara;
    } else {
      if (current) {
        chunks.push(current);
        current = '';
      }
      if (trimmedPara.length <= maxChars) {
        current = trimmedPara;
      } else {
        pushSentencewise(trimmedPara);
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}
