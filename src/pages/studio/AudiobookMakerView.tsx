import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  FileUp,
  FolderPlus,
  Loader2,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';
import { voxApi } from '../../services/api';
import { splitTextIntoSmartChunks, triggerAudioDownload } from '../../utils/audioProcessor';
import type {
  AudioFormat,
  AudiobookChapter,
  EditorClip,
  PublicAppConfig,
  SavedProject,
  UsageQuotaState,
} from '../../types/voxcraft';

interface AudiobookMakerViewProps {
  config: PublicAppConfig;
  onQuotaUpdate: (quota: UsageQuotaState) => void;
  onProjectSaved: (projects: SavedProject[]) => void;
  onSendToEditor: (clip: Pick<EditorClip, 'title' | 'audioBase64' | 'mimeType' | 'durationSeconds'>) => void;
}

export function AudiobookMakerView({
  config,
  onQuotaUpdate,
  onProjectSaved,
  onSendToEditor,
}: AudiobookMakerViewProps) {
  const [bookTitle, setBookTitle] = useState('My First Audiobook');
  const [chapters, setChapters] = useState<AudiobookChapter[]>([
    {
      id: 'ch1',
      title: 'Chapter 1: The Beginning',
      text: 'The morning train arrived twenty minutes ahead of schedule, carrying a quiet mist off the harbor. Mara tightened her coat, checked the manuscript inside her bag, and stepped onto the stone platform knowing every word she had written would soon find its voice.',
      voiceId: 'Charon',
      languageCode: 'en-US',
      status: 'idle',
      completedChunks: 0,
      totalChunks: 1,
    },
  ]);
  const [activeChapterId, setActiveChapterId] = useState('ch1');
  const [exportFormat, setExportFormat] = useState<AudioFormat>('wav');
  const [exportingBook, setExportingBook] = useState(false);
  const [combinedBook, setCombinedBook] = useState<{
    audioBase64: string;
    mimeType: string;
    format: AudioFormat;
    durationSeconds: number;
  } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];
  const smartChunks = activeChapter ? splitTextIntoSmartChunks(activeChapter.text, 1400) : [];

  const updateChapter = (id: string, patch: Partial<AudiobookChapter>) => {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addChapter = () => {
    const nextIdx = chapters.length + 1;
    const id = `ch_${Date.now()}`;
    setChapters((prev) => [
      ...prev,
      {
        id,
        title: `Chapter ${nextIdx}`,
        text: '',
        voiceId: activeChapter?.voiceId || 'Charon',
        languageCode: activeChapter?.languageCode || 'en-US',
        status: 'idle',
        completedChunks: 0,
        totalChunks: 0,
      },
    ]);
    setActiveChapterId(id);
  };

  const deleteChapter = (id: string) => {
    if (chapters.length <= 1) return;
    const next = chapters.filter((c) => c.id !== id);
    setChapters(next);
    if (activeChapterId === id) {
      setActiveChapterId(next[0].id);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGlobalError(null);
    try {
      const content = await file.text();
      if (!content.trim()) {
        setGlobalError('Uploaded document appears empty.');
        return;
      }
      // Split by "Chapter" headings if present, otherwise load into active chapter
      const chapterRegex = /(?:^|\n)(Chapter\s+\d+[^\n]*)/gi;
      const matches = Array.from(content.matchAll(chapterRegex));
      if (matches.length >= 2) {
        const parsed: AudiobookChapter[] = [];
        for (let i = 0; i < matches.length; i++) {
          const start = matches[i].index || 0;
          const end = i + 1 < matches.length ? matches[i + 1].index || content.length : content.length;
          const slice = content.slice(start, end).trim();
          const firstNewline = slice.indexOf('\n');
          const chTitle = firstNewline > 0 ? slice.slice(0, firstNewline).trim() : `Chapter ${i + 1}`;
          const chText = firstNewline > 0 ? slice.slice(firstNewline + 1).trim() : slice;
          parsed.push({
            id: `ch_${Date.now()}_${i}`,
            title: chTitle,
            text: chText,
            voiceId: activeChapter?.voiceId || 'Charon',
            languageCode: activeChapter?.languageCode || 'en-US',
            status: 'idle',
            completedChunks: 0,
            totalChunks: splitTextIntoSmartChunks(chText, 1400).length,
          });
        }
        setChapters(parsed);
        setActiveChapterId(parsed[0].id);
      } else {
        updateChapter(activeChapter.id, {
          title: file.name.replace(/\.[^.]+$/, ''),
          text: content.trim(),
          status: 'idle',
        });
      }
    } catch {
      setGlobalError('Could not read uploaded file. Please upload plain text (.txt or .md).');
    }
  };

  const generateChapterAudio = async (chapter: AudiobookChapter) => {
    setGlobalError(null);
    const chunks = splitTextIntoSmartChunks(chapter.text, 1400);
    if (chunks.length === 0) {
      updateChapter(chapter.id, { status: 'error', errorMessage: 'Chapter text is empty.' });
      return;
    }

    updateChapter(chapter.id, {
      status: 'generating',
      completedChunks: 0,
      totalChunks: chunks.length,
      errorMessage: undefined,
      audioBase64: undefined,
    });

    const chunkWavs: string[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        const res = await voxApi.generateSpeech({
          text: chunks[i],
          voiceId: chapter.voiceId,
          languageCode: chapter.languageCode,
          emotionId: 'storytelling',
          modelId: 'gemini-3.8-flash-tts',
          format: 'wav',
          title: `${chapter.title} (Part ${i + 1}/${chunks.length})`,
          saveHistory: i === 0,
        });
        onQuotaUpdate(res.quota);
        chunkWavs.push(res.audioBase64);
        updateChapter(chapter.id, { completedChunks: i + 1 });
      }

      const merged =
        chunkWavs.length === 1
          ? { audioBase64: chunkWavs[0], mimeType: 'audio/wav', durationSeconds: 0 }
          : await voxApi.concatAudio({
              clipsBase64: chunkWavs,
              format: 'wav',
              silenceGapMs: 280,
            });

      updateChapter(chapter.id, {
        status: 'done',
        audioBase64: merged.audioBase64,
        mimeType: merged.mimeType,
        durationSeconds: merged.durationSeconds,
      });
    } catch (err) {
      updateChapter(chapter.id, {
        status: 'error',
        errorMessage:
          err instanceof Error
            ? `Stopped at chunk ${chunkWavs.length + 1}/${chunks.length}: ${err.message}`
            : 'Chapter generation failed.',
      });
    }
  };

  const allChaptersSucceeded = chapters.length > 0 && chapters.every((c) => c.status === 'done' && c.audioBase64);

  const handleExportFullAudiobook = async () => {
    setGlobalError(null);
    if (!allChaptersSucceeded) {
      setGlobalError('Generate all chapters completely before exporting the combined audiobook.');
      return;
    }
    setExportingBook(true);
    try {
      const clips = chapters.map((c) => c.audioBase64!);
      const merged = await voxApi.concatAudio({
        clipsBase64: clips,
        format: exportFormat,
        silenceGapMs: 700,
      });
      setCombinedBook(merged);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to combine audiobook chapters.');
    } finally {
      setExportingBook(false);
    }
  };

  const handleSaveProject = async () => {
    const res = await voxApi.saveProject({
      title: bookTitle.trim() || 'Audiobook Draft',
      type: 'audiobook',
      languageCode: activeChapter?.languageCode || 'en-US',
      voiceId: activeChapter?.voiceId || 'Charon',
      content: chapters.map((c) => `${c.title}\n\n${c.text}`).join('\n\n---\n\n'),
      payload: {
        chapters: chapters.map((c) => ({
          id: c.id,
          title: c.title,
          text: c.text,
          voiceId: c.voiceId,
          languageCode: c.languageCode,
        })),
      },
    });
    onProjectSaved(res.projects);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Audiobook Maker</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Divide long manuscripts cleanly at sentence boundaries, keep voice consistency across chunks, and export
            chapters or a combined audiobook.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Audiobook title"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            className="rounded-lg bg-[#0D1326] border border-slate-700 px-3 py-2 text-sm text-white w-48"
          />
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white cursor-pointer">
            <FileUp className="w-3.5 h-3.5 text-blue-400" />
            Upload .TXT / .MD
            <input type="file" accept=".txt,.md,text/plain" onChange={handleUploadDocument} className="hidden" />
          </label>
          <button
            type="button"
            onClick={handleSaveProject}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
          >
            {savedOk ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
            {savedOk ? 'Saved' : 'Save Book'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Chapters List */}
        <div className="xl:col-span-4 space-y-4">
          <div className="studio-surface rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white">
                Chapters ({chapters.length})
              </h2>
              <button
                type="button"
                onClick={addChapter}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Chapter
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {chapters.map((ch) => {
                const isSelected = ch.id === activeChapter?.id;
                const chChunks = splitTextIntoSmartChunks(ch.text, 1400).length;
                return (
                  <div
                    key={ch.id}
                    className={`rounded-xl p-3 border transition-colors ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/50'
                        : 'bg-[#070B19] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveChapterId(ch.id)}
                        className="text-left flex-1 min-w-0"
                      >
                        <p className="text-sm font-semibold text-white truncate">{ch.title}</p>
                        <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                          {ch.text.length.toLocaleString()} chars · {chChunks} chunk{chChunks === 1 ? '' : 's'} ·{' '}
                          <span
                            className={
                              ch.status === 'done'
                                ? 'text-emerald-400'
                                : ch.status === 'error'
                                ? 'text-rose-400'
                                : ch.status === 'generating'
                                ? 'text-blue-400'
                                : 'text-slate-400'
                            }
                          >
                            {ch.status === 'generating'
                              ? `${ch.completedChunks}/${ch.totalChunks}`
                              : ch.status}
                          </span>
                        </p>
                      </button>
                      {chapters.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Delete ${ch.title}`}
                          onClick={() => deleteChapter(ch.id)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Combined Audiobook Export */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Combined Export</span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as AudioFormat)}
                  className="rounded-md bg-[#070B19] border border-slate-700 px-2 py-1 text-xs text-white uppercase"
                >
                  <option value="wav">WAV</option>
                  <option value="mp3">MP3</option>
                </select>
              </div>
              <button
                type="button"
                disabled={!allChaptersSucceeded || exportingBook}
                onClick={handleExportFullAudiobook}
                className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {exportingBook ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                Combine All Chapters ({chapters.filter((c) => c.status === 'done').length}/{chapters.length} Ready)
              </button>
              {!allChaptersSucceeded && (
                <p className="text-xs text-slate-500">
                  All chapters must succeed individually before exporting the complete audiobook.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Active Chapter Editor & Generator */}
        <div className="xl:col-span-8 space-y-5">
          {activeChapter && (
            <div className="studio-surface rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Chapter Title</label>
                  <input
                    type="text"
                    value={activeChapter.title}
                    onChange={(e) => updateChapter(activeChapter.id, { title: e.target.value })}
                    className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Narrator Voice</label>
                  <select
                    value={activeChapter.voiceId}
                    onChange={(e) => updateChapter(activeChapter.id, { voiceId: e.target.value })}
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
                  <label className="block text-xs font-medium text-slate-400 mb-1">Language</label>
                  <select
                    value={activeChapter.languageCode}
                    onChange={(e) => updateChapter(activeChapter.id, { languageCode: e.target.value })}
                    className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
                  >
                    {config.languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">Chapter Manuscript</span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {activeChapter.text.length.toLocaleString()} chars · Auto-split into {smartChunks.length} safe
                    sentence-boundary section{smartChunks.length === 1 ? '' : 's'}
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={activeChapter.text}
                  onChange={(e) =>
                    updateChapter(activeChapter.id, {
                      text: e.target.value,
                      status: activeChapter.status === 'done' ? 'idle' : activeChapter.status,
                    })
                  }
                  placeholder="Paste long-form story, textbook, or chapter content here..."
                  className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              {activeChapter.status === 'generating' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-blue-300 font-mono tabular-nums">
                    <span>Synthesizing chapter chunks sequentially...</span>
                    <span>
                      {activeChapter.completedChunks} / {activeChapter.totalChunks}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${Math.round(
                          (activeChapter.completedChunks / Math.max(1, activeChapter.totalChunks)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {activeChapter.errorMessage && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{activeChapter.errorMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Voice consistency preserved across all chunks using {activeChapter.voiceId}.
                </span>
                <button
                  type="button"
                  disabled={activeChapter.status === 'generating'}
                  onClick={() => generateChapterAudio(activeChapter)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-60"
                >
                  {activeChapter.status === 'generating' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Generate Chapter Audio
                </button>
              </div>
            </div>
          )}

          {activeChapter?.audioBase64 && (
            <AudioPlayer
              title={`${activeChapter.title} (Chapter Audio)`}
              subtitle={`Voice: ${activeChapter.voiceId} · ${activeChapter.totalChunks} chunk(s) merged cleanly`}
              audioBase64={activeChapter.audioBase64}
              mimeType={activeChapter.mimeType || 'audio/wav'}
              format="wav"
              durationSeconds={activeChapter.durationSeconds}
              onSendToEditor={() =>
                onSendToEditor({
                  title: activeChapter.title,
                  audioBase64: activeChapter.audioBase64!,
                  mimeType: activeChapter.mimeType || 'audio/wav',
                  durationSeconds: activeChapter.durationSeconds || 0,
                })
              }
            />
          )}

          {globalError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          {combinedBook && (
            <div className="studio-surface-elevated rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Complete Audiobook Ready: {bookTitle}
                  </h3>
                  <p className="text-xs text-emerald-400">
                    All {chapters.length} chapters combined without corruption
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    triggerAudioDownload(
                      combinedBook.audioBase64,
                      combinedBook.mimeType,
                      `${bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${combinedBook.format}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Full {combinedBook.format.toUpperCase()}
                </button>
              </div>
              <AudioPlayer
                title={`${bookTitle} (Complete Audiobook)`}
                audioBase64={combinedBook.audioBase64}
                mimeType={combinedBook.mimeType}
                format={combinedBook.format}
                durationSeconds={combinedBook.durationSeconds}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
