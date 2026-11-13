import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

interface LamejsModule {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array | Uint8Array;
    flush: () => Int8Array | Uint8Array;
  };
}

let cachedLamejs: LamejsModule | null = null;

function resolveLameAllPath(): string {
  try {
    return require.resolve('lamejs/lame.all.js');
  } catch {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(process.cwd(), 'node_modules/lamejs/lame.all.js'),
      path.resolve(currentDir, '../node_modules/lamejs/lame.all.js'),
      path.resolve(currentDir, '../../node_modules/lamejs/lame.all.js'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    throw new Error('Could not locate lamejs/lame.all.js for MP3 encoding.');
  }
}

function getLamejs(): LamejsModule {
  if (cachedLamejs) return cachedLamejs;
  const lameAllPath = resolveLameAllPath();
  const code = fs.readFileSync(lameAllPath, 'utf8');
  const context: Record<string, unknown> = {
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    Uint8Array,
    Array,
    Math,
    console,
  };
  vm.runInNewContext(code, context);
  cachedLamejs = context.lamejs as LamejsModule;
  return cachedLamejs;
}

export interface WavMetadata {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
  durationSeconds: number;
}

/**
 * Inspects a RIFF/WAVE buffer to locate the `fmt ` and `data` chunks accurately.
 */
export function parseWavHeader(buffer: Buffer): WavMetadata {
  if (buffer.length < 44) {
    throw new Error('Audio buffer is too small to be a valid WAV file.');
  }

  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid audio container: expected RIFF/WAVE header.');
  }

  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataLength = Math.max(0, buffer.length - 44);

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ' && offset + 24 <= buffer.length) {
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, Math.max(0, buffer.length - dataOffset));
      break;
    }
    const nextOffset = offset + 8 + chunkSize + (chunkSize % 2);
    if (nextOffset <= offset) break;
    offset = nextOffset;
  }

  const bytesPerSecond = Math.max(1, sampleRate * numChannels * (bitsPerSample / 8));
  const durationSeconds = Number((dataLength / bytesPerSecond).toFixed(2));

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    dataOffset,
    dataLength,
    durationSeconds,
  };
}

/**
 * Wraps raw 16-bit PCM bytes into a standard 44-byte RIFF/WAVE header.
 */
export function encodePcmToWav(
  pcmData: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Safely concatenates multiple WAV buffers by extracting each clip's raw PCM `data` chunk
 * (stripping headers cleanly) and generating one valid RIFF/WAVE file.
 */
export function concatenateWavBuffers(wavBuffers: Buffer[], silenceGapMs = 180): {
  wavBuffer: Buffer;
  durationSeconds: number;
} {
  if (wavBuffers.length === 0) {
    throw new Error('Cannot concatenate an empty list of audio clips.');
  }

  const firstMeta = parseWavHeader(wavBuffers[0]);
  const bytesPerSample = Math.max(1, firstMeta.bitsPerSample / 8);
  const gapSampleCount = Math.floor((firstMeta.sampleRate * silenceGapMs) / 1000);
  const silenceGap = Buffer.alloc(gapSampleCount * firstMeta.numChannels * bytesPerSample);

  const pcmParts: Buffer[] = [];
  for (let i = 0; i < wavBuffers.length; i++) {
    const buf = wavBuffers[i];
    const meta = parseWavHeader(buf);
    const pcmSlice = buf.subarray(meta.dataOffset, meta.dataOffset + meta.dataLength);
    pcmParts.push(pcmSlice);
    if (i < wavBuffers.length - 1 && silenceGap.length > 0) {
      pcmParts.push(silenceGap);
    }
  }

  const mergedPcm = Buffer.concat(pcmParts);
  const wavBuffer = encodePcmToWav(
    mergedPcm,
    firstMeta.sampleRate,
    firstMeta.numChannels,
    firstMeta.bitsPerSample
  );
  const bytesPerSecond = Math.max(
    1,
    firstMeta.sampleRate * firstMeta.numChannels * (firstMeta.bitsPerSample / 8)
  );
  const durationSeconds = Number((mergedPcm.length / bytesPerSecond).toFixed(2));

  return { wavBuffer, durationSeconds };
}

/**
 * Encodes a 16-bit PCM WAV buffer into real MP3 (`audio/mpeg`) bytes using lamejs.
 */
export function encodeWavToMp3(wavBuffer: Buffer, kbps = 128): Buffer {
  const meta = parseWavHeader(wavBuffer);
  if (meta.bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth for MP3 encoding: ${meta.bitsPerSample}-bit.`);
  }

  const pcmBuffer = wavBuffer.subarray(meta.dataOffset, meta.dataOffset + meta.dataLength);
  const totalSamples = Math.floor(pcmBuffer.length / 2);

  if (totalSamples === 0) {
    throw new Error('Cannot encode empty audio data to MP3.');
  }

  const lame = getLamejs();
  const encoder = new lame.Mp3Encoder(meta.numChannels, meta.sampleRate, kbps);
  const mp3Chunks: Buffer[] = [];
  const blockSize = 1152;

  if (meta.numChannels === 1) {
    const samples = new Int16Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      samples[i] = pcmBuffer.readInt16LE(i * 2);
    }

    for (let i = 0; i < samples.length; i += blockSize) {
      const slice = samples.subarray(i, i + blockSize);
      const mp3buf = encoder.encodeBuffer(slice);
      if (mp3buf.length > 0) {
        mp3Chunks.push(Buffer.from(mp3buf));
      }
    }
  } else {
    const frames = Math.floor(totalSamples / 2);
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = pcmBuffer.readInt16LE(i * 4);
      right[i] = pcmBuffer.readInt16LE(i * 4 + 2);
    }

    for (let i = 0; i < frames; i += blockSize) {
      const leftSlice = left.subarray(i, i + blockSize);
      const rightSlice = right.subarray(i, i + blockSize);
      const mp3buf = encoder.encodeBuffer(leftSlice, rightSlice);
      if (mp3buf.length > 0) {
        mp3Chunks.push(Buffer.from(mp3buf));
      }
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(Buffer.from(endBuf));
  }

  const result = Buffer.concat(mp3Chunks);
  if (result.length === 0) {
    throw new Error('MP3 encoder returned empty output.');
  }
  return result;
}
