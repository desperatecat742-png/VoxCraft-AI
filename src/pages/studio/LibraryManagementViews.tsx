import { useState } from 'react';
import {
  Check,
  Download,
  Edit3,
  FolderOpen,
  History,
  Loader2,
  LogIn,
  LogOut,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { voxApi } from '../../services/api';
import { base64ToBlobUrl, formatTimecode, triggerAudioDownload } from '../../utils/audioProcessor';
import type { LegalTab } from '../../components/LegalModal';
import type {
  AudioFormat,
  HistoryItem,
  PublicAppConfig,
  SavedProject,
  TtsModelId,
  UsageQuotaState,
  UserSession,
  VoiceCategory,
  VoicePreset,
} from '../../types/voxcraft';

/* -------------------------------------------------------------------------- */
/* 1. VOICE LIBRARY & AFRICAN VOICE COLLECTION                                */
/* -------------------------------------------------------------------------- */

interface VoiceLibraryViewProps {
  config: PublicAppConfig;
  favourites: string[];
  presets: VoicePreset[];
  onToggleFavourite: (voiceId: string) => void;
  onPresetsUpdated: (presets: VoicePreset[]) => void;
  onUseVoiceInTts: (voiceId: string, languageCode?: string) => void;
}

export function VoiceLibraryView({
  config,
  favourites,
  presets,
  onToggleFavourite,
  onPresetsUpdated,
  onUseVoiceInTts,
}: VoiceLibraryViewProps) {
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female' | 'Neutral'>('All');
  const [styleFilter, setStyleFilter] = useState<'All' | VoiceCategory>('All');
  const [selectedLangForPreview, setSelectedLangForPreview] = useState('en-US');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Preset creator
  const [presetName, setPresetName] = useState('');
  const [presetVoiceId, setPresetVoiceId] = useState(config.voices[0]?.id || 'Kore');
  const [presetLangCode, setPresetLangCode] = useState('en-NG');
  const [presetEmotionId, setPresetEmotionId] = useState('professional');
  const [presetCustomStyle, setPresetCustomStyle] = useState('');

  const filteredVoices = config.voices.filter((v) => {
    const matchGender = genderFilter === 'All' || v.genderLabel === genderFilter;
    const matchStyle = styleFilter === 'All' || v.categories.includes(styleFilter);
    const q = search.trim().toLowerCase();
    const matchQuery =
      !q || v.name.toLowerCase().includes(q) || v.timbre.toLowerCase().includes(q) || v.bestFor.toLowerCase().includes(q);
    return matchGender && matchStyle && matchQuery;
  });

  const africanCollection = config.languages.filter((l) => l.isAfricanCollection);

  const handlePreview = async (voiceId: string) => {
    setPreviewError(null);
    setPreviewingId(voiceId);
    let blobUrl: string | null = null;
    try {
      const res = await voxApi.previewVoice(voiceId, selectedLangForPreview);
      blobUrl = base64ToBlobUrl(res.audioBase64, res.mimeType);
      const audio = new Audio(blobUrl);
      audio.onended = () => {
        setPreviewingId(null);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
      audio.onerror = () => {
        setPreviewingId(null);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
      await audio.play();
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setPreviewError(err instanceof Error ? err.message : 'Preview failed.');
      setPreviewingId(null);
    }
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    const res = await voxApi.savePreset({
      name: presetName.trim(),
      voiceId: presetVoiceId,
      languageCode: presetLangCode,
      emotionId: presetEmotionId,
      speed: 'normal',
      customStyle: presetCustomStyle.trim(),
      modelId: 'gemini-3.8-flash-tts',
    });
    onPresetsUpdated(res.presets);
    setPresetName('');
    setPresetCustomStyle('');
  };

  const handleDeletePreset = async (id: string) => {
    const res = await voxApi.deletePreset(id);
    onPresetsUpdated(res.presets);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Voice Library &amp; African Voice Collection</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Explore verified Gemini speech voices, preview samples in different languages, save favourites, and build
          reusable voice presets.
        </p>
      </div>

      {/* Filters */}
      <div className="studio-surface rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voice name or style..."
            className="w-full rounded-lg bg-[#070B19] border border-slate-700 pl-9 pr-3 py-2 text-sm text-white"
          />
        </div>
        <select
          aria-label="Filter by gender"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value as 'All' | 'Male' | 'Female' | 'Neutral')}
          className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
        >
          <option value="All">All Genders</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
          <option value="Neutral">Neutral</option>
        </select>
        <select
          aria-label="Filter by style"
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value as 'All' | VoiceCategory)}
          className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
        >
          <option value="All">All Styles</option>
          <option value="Storytelling">Storytelling</option>
          <option value="Professional">Professional</option>
          <option value="Conversational">Conversational</option>
          <option value="Expressive">Expressive</option>
        </select>
        <select
          aria-label="Preview language"
          value={selectedLangForPreview}
          onChange={(e) => setSelectedLangForPreview(e.target.value)}
          className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
        >
          {config.languages.map((l) => (
            <option key={l.code} value={l.code}>
              Preview in: {l.name}
            </option>
          ))}
        </select>
      </div>

      {previewError && (
        <p className="text-xs text-rose-400">{previewError}</p>
      )}

      {/* Voice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVoices.map((voice) => {
          const isFav = favourites.includes(voice.id);
          return (
            <div key={voice.id} className="studio-surface rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">{voice.name}</h2>
                    <p className="text-xs text-slate-400">
                      {voice.genderLabel} · {voice.categories.join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={isFav ? `Remove ${voice.name} from favourites` : `Add ${voice.name} to favourites`}
                    onClick={() => onToggleFavourite(voice.id)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300"
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                  </button>
                </div>
                <p className="text-xs text-slate-300">{voice.timbre}</p>
                <p className="text-xs text-slate-400">Best for: {voice.bestFor}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handlePreview(voice.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
                >
                  {previewingId === voice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onUseVoiceInTts(voice.id, selectedLangForPreview)}
                  className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  Use in Studio
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* African Voice Collection Matrix */}
      <section className="studio-surface rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">African Voice Collection</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Regional varieties &amp; African languages with transparent Gemini 3.8 TTS availability indicators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {africanCollection.map((lang) => (
            <div key={lang.code} className="rounded-xl bg-[#070B19] border border-slate-800 p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold text-white">
                  {lang.name} <span className="text-xs font-normal text-slate-400">· {lang.region}</span>
                </p>
                <p className="text-xs text-slate-400">{lang.availabilityNote}</p>
              </div>
              <button
                type="button"
                onClick={() => onUseVoiceInTts(lang.recommendedVoiceIds[0] || 'Kore', lang.code)}
                className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 text-xs font-medium shrink-0"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Voice Presets */}
      <section className="studio-surface rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-white">Saved Voice Presets</h2>
        <form onSubmit={handleCreatePreset} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input
            type="text"
            required
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name (e.g., Lagos News)"
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs text-white"
          />
          <select
            value={presetVoiceId}
            onChange={(e) => setPresetVoiceId(e.target.value)}
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs text-white"
          >
            {config.voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <select
            value={presetLangCode}
            onChange={(e) => setPresetLangCode(e.target.value)}
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs text-white"
          >
            {config.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            value={presetEmotionId}
            onChange={(e) => setPresetEmotionId(e.target.value)}
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-xs text-white"
          >
            {config.emotionStyles.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Preset
          </button>
        </form>

        {presets.length === 0 ? (
          <p className="text-xs text-slate-400">No voice presets saved yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((p) => (
              <div key={p.id} className="rounded-xl bg-[#070B19] border border-slate-800 p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.voiceId} · {p.languageCode} · {p.emotionId}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUseVoiceInTts(p.voiceId, p.languageCode)}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-white"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    aria-label="Delete preset"
                    onClick={() => handleDeletePreset(p.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. MY PROJECTS                                                             */
/* -------------------------------------------------------------------------- */

interface ProjectsViewProps {
  projects: SavedProject[];
  onProjectsUpdated: (projects: SavedProject[]) => void;
  onReopenProject: (project: SavedProject) => void;
}

export function ProjectsView({ projects, onProjectsUpdated, onReopenProject }: ProjectsViewProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    const res = await voxApi.renameProject(id, renameValue.trim());
    onProjectsUpdated(res.projects);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const res = await voxApi.deleteProject(id);
    onProjectsUpdated(res.projects);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Reopen, rename, or remove saved voiceovers, scripts, translations, conversations, and audiobooks.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects..."
            className="w-full rounded-lg bg-[#0D1326] border border-slate-700 pl-9 pr-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="studio-surface rounded-2xl p-10 text-center space-y-2">
          <FolderOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-medium text-slate-200">No projects found</p>
          <p className="text-xs text-slate-400">
            Save work from Text-to-Speech, Script Writer, Translate &amp; Speak, or Audiobook Maker to manage it
            here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((proj) => (
            <div
              key={proj.id}
              className="studio-surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                {editingId === proj.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="rounded-lg bg-[#070B19] border border-blue-500 px-2.5 py-1 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(proj.id)}
                      className="p-1.5 rounded-lg bg-blue-600 text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <h2 className="font-display text-base font-semibold text-white truncate">{proj.title}</h2>
                )}
                <p className="text-xs text-slate-400 mt-0.5">
                  {proj.type} · {proj.languageCode} · Voice: {proj.voiceId} · Updated{' '}
                  {new Date(proj.updatedAt).toLocaleString()}
                </p>
                {proj.content && (
                  <p className="text-xs text-slate-500 truncate mt-1 max-w-2xl">{proj.content}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onReopenProject(proj)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  Reopen
                </button>
                <button
                  type="button"
                  aria-label="Rename project"
                  onClick={() => {
                    setEditingId(proj.id);
                    setRenameValue(proj.title);
                  }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Delete project"
                  onClick={() => handleDelete(proj.id)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. GENERATION HISTORY                                                      */
/* -------------------------------------------------------------------------- */

interface HistoryViewProps {
  history: HistoryItem[];
  onHistoryUpdated: (history: HistoryItem[]) => void;
}

export function HistoryView({ history, onHistoryUpdated }: HistoryViewProps) {
  const [filterKind, setFilterKind] = useState<'all' | 'audio' | 'script' | 'translation'>('all');

  const filtered = history.filter((h) => filterKind === 'all' || h.kind === filterKind);

  const handleDelete = async (id: string) => {
    const res = await voxApi.deleteHistoryItem(id);
    onHistoryUpdated(res.history);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Generation History</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Review generated audio, scripts, and translations. Re-download saved clips or delete records anytime.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D1326] border border-slate-800">
          {(['all', 'audio', 'script', 'translation'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKind(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                filterKind === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="studio-surface rounded-2xl p-10 text-center space-y-2">
          <History className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-medium text-slate-200">No history records yet</p>
          <p className="text-xs text-slate-400">
            Generated voiceovers, scripts, and translations appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="studio-surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-white truncate">{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                  {item.kind} · {item.languageCode}
                  {item.voiceId ? ` · ${item.voiceId}` : ''} · {item.charCount.toLocaleString()} chars
                  {item.durationSeconds ? ` · ${formatTimecode(item.durationSeconds)}` : ''} ·{' '}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 truncate mt-1">{item.summary}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.audioBase64 && item.mimeType && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const url = base64ToBlobUrl(item.audioBase64!, item.mimeType!);
                        const audio = new Audio(url);
                        audio.onended = () => URL.revokeObjectURL(url);
                        audio.onerror = () => URL.revokeObjectURL(url);
                        audio.play().catch(() => URL.revokeObjectURL(url));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white"
                    >
                      <Play className="w-3.5 h-3.5 text-blue-400" />
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerAudioDownload(
                          item.audioBase64!,
                          item.mimeType!,
                          `voxcraft-${item.id}.${item.format || 'wav'}`
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {(item.format || 'wav').toUpperCase()}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Delete history item"
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. SETTINGS & ACCOUNT                                                      */
/* -------------------------------------------------------------------------- */

interface SettingsViewProps {
  config: PublicAppConfig;
  session: UserSession;
  quota: UsageQuotaState;
  onSessionChange: (session: UserSession) => void;
  onOpenLegal: (tab: LegalTab) => void;
}

export function SettingsView({
  config,
  session,
  quota,
  onSessionChange,
  onOpenLegal,
}: SettingsViewProps) {
  const [loginEmail, setLoginEmail] = useState(session.email || '');
  const [loginName, setLoginName] = useState(session.displayName);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [waitlistEmail, setWaitlistEmail] = useState(session.email || '');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistMsg, setWaitlistMsg] = useState<string | null>(null);
  const [waitlistErr, setWaitlistErr] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    try {
      const res = await voxApi.login(loginEmail, loginName);
      onSessionChange(res.session);
      setAuthMsg('Account profile active. Your projects and preferences are synced to this profile.');
    } catch (err) {
      setAuthMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const handleLogout = async () => {
    const res = await voxApi.logout();
    onSessionChange(res.session);
    setLoginEmail('');
    setLoginName(res.session.displayName);
  };

  const handlePrefSave = async (updates: Partial<UserSession>) => {
    setSavingPrefs(true);
    try {
      const res = await voxApi.updatePreferences(updates);
      onSessionChange(res.session);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistErr(null);
    setWaitlistMsg(null);
    setWaitlistLoading(true);
    try {
      const res = await voxApi.joinProWaitlist(waitlistEmail);
      onSessionChange(res.session);
      setWaitlistMsg(res.message);
    } catch (err) {
      setWaitlistErr(err instanceof Error ? err.message : 'Could not join waitlist.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Settings &amp; Account</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage your creator profile, default studio preferences, plans, rewarded usage readiness, and AdSense status.
        </p>
      </div>

      {/* Account Session */}
      <div className="studio-surface rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                {session.isAuthenticated ? `Signed in as ${session.displayName}` : 'Guest Studio Workspace'}
              </h2>
              <p className="text-xs text-slate-400">
                {session.isAuthenticated
                  ? session.email
                  : 'Sign in with an email profile to preserve your projects and voice presets across sessions.'}
              </p>
            </div>
          </div>

          {session.isAuthenticated && (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              Switch Account
            </button>
          )}
        </div>

        <form onSubmit={handleSignIn} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <input
            type="text"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder="Display name"
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
          />
          <input
            type="email"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white"
          >
            <LogIn className="w-4 h-4" />
            {session.isAuthenticated ? 'Update Profile' : 'Save Profile & Sign In'}
          </button>
        </form>
        {authMsg && <p className="text-xs text-emerald-400">{authMsg}</p>}
      </div>

      {/* Plans, Rewarded Usage & Future Pro Tier */}
      <div className="studio-surface rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Subscription Plan &amp; Rewarded Usage Architecture
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              VoxCraft AI launches free with Google AdSense support and is built to add rewarded boosts and Pro plans cleanly.
            </p>
          </div>
          <span className="text-xs font-mono uppercase text-blue-300">
            Active Tier: {quota.planTier}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.plans.map((plan) => {
            const isActive = plan.id === quota.planTier;
            return (
              <div
                key={plan.id}
                className={`rounded-xl p-4 border space-y-3 ${
                  isActive
                    ? 'bg-blue-600/10 border-blue-500/40'
                    : 'bg-[#070B19] border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{plan.priceLabel}</p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? 'text-emerald-400' : 'text-violet-300'
                    }`}
                  >
                    {isActive ? 'Current Plan' : 'Planned Tier'}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {plan.highlights.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Rewarded Ad Boost Readiness + Pro Waitlist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="rounded-xl bg-[#070B19] border border-slate-800 p-4 space-y-2 text-xs">
            <h3 className="font-display text-sm font-semibold text-white">
              Rewarded Character Boosts
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Status:{' '}
              <span className="text-slate-200 font-medium">
                {config.adsense.rewardedAdUnitConfigured
                  ? 'Google Ad Manager Rewarded Ad Unit active'
                  : 'Ready for future Google Ad Manager Rewarded Ad Unit'}
              </span>
            </p>
            <p className="text-slate-500 leading-relaxed">
              To stay compliant with Google AdSense policies, standard display ads never reward clicks. When you attach a{' '}
              <code className="font-mono text-slate-300">GAM_REWARDED_AD_UNIT</code>, users can opt in to watch a rewarded ad for{' '}
              <span className="font-mono">+15,000</span> bonus daily characters.
            </p>
            {quota.bonusCharactersToday > 0 && (
              <p className="text-emerald-400 font-mono tabular-nums">
                Bonus unlocked today: +{quota.bonusCharactersToday.toLocaleString()} chars
              </p>
            )}
          </div>

          <div className="rounded-xl bg-[#070B19] border border-slate-800 p-4 space-y-2.5 text-xs">
            <h3 className="font-display text-sm font-semibold text-white">
              VoxCraft Pro Early-Access Waitlist
            </h3>
            <p className="text-slate-400">
              Want an ad-free studio and 1,000,000 daily characters when Pro subscriptions launch?
            </p>
            {session.onProWaitlist ? (
              <p className="text-emerald-400 font-medium">
                You are on the VoxCraft Pro waitlist ({session.email || waitlistEmail}).
              </p>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-lg bg-[#0D1326] border border-slate-700 px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={waitlistLoading}
                  className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-xs whitespace-nowrap"
                >
                  {waitlistLoading ? 'Joining...' : 'Join Waitlist'}
                </button>
              </form>
            )}
            {waitlistMsg && <p className="text-emerald-400">{waitlistMsg}</p>}
            {waitlistErr && <p className="text-rose-400">{waitlistErr}</p>}
          </div>
        </div>
      </div>

      {/* Studio Defaults */}
      <div className="studio-surface rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">Default Studio Preferences</h2>
          {savingPrefs && <span className="text-xs text-blue-400">Saving...</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Default Voice</label>
            <select
              value={session.preferredVoiceId}
              onChange={(e) => handlePrefSave({ preferredVoiceId: e.target.value })}
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
            <label className="block text-xs text-slate-400 mb-1">Default Language</label>
            <select
              value={session.preferredLanguageCode}
              onChange={(e) => handlePrefSave({ preferredLanguageCode: e.target.value })}
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
            <label className="block text-xs text-slate-400 mb-1">Default Audio Format</label>
            <select
              value={session.preferredFormat}
              onChange={(e) => handlePrefSave({ preferredFormat: e.target.value as AudioFormat })}
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white uppercase"
            >
              <option value="wav">WAV (Lossless 24kHz)</option>
              <option value="mp3">MP3 (128kbps)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Default Gemini Speech Model</label>
            <select
              value={session.preferredModel}
              onChange={(e) => handlePrefSave({ preferredModel: e.target.value as TtsModelId })}
              className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white"
            >
              {config.ttsModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Free Tier Quota & AdSense Readiness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="studio-surface rounded-2xl p-5 space-y-2 text-xs">
          <h3 className="font-display text-sm font-semibold text-white">Daily Usage Allowance</h3>
          <p className="text-slate-400">
            Daily Characters Used:{' '}
            <span className="text-white font-mono tabular-nums">
              {quota.charactersUsedToday.toLocaleString()} / {quota.effectiveDailyCharacterLimit.toLocaleString()}
            </span>
          </p>
          <p className="text-slate-400">
            Daily Generations:{' '}
            <span className="text-white font-mono tabular-nums">
              {quota.generationsToday} / {quota.dailyGenerationLimit}
            </span>
          </p>
          <p className="text-slate-400">
            Max Characters per Request:{' '}
            <span className="text-white font-mono tabular-nums">{quota.maxCharsPerRequest.toLocaleString()}</span>
          </p>
          <p className="text-slate-500 pt-1">{quota.resetNote}</p>
        </div>

        <div className="studio-surface rounded-2xl p-5 space-y-2 text-xs">
          <h3 className="font-display text-sm font-semibold text-white">Google AdSense &amp; Compliance</h3>
          <p className="text-slate-400">
            Ad Display Status:{' '}
            <span className="text-slate-200 font-medium">
              {config.adsense.enabled ? 'Configured & Active' : 'Disabled pending Publisher ID & approval'}
            </span>
          </p>
          <p className="text-slate-500">
            Public <code className="font-mono">/ads.txt</code> is served automatically. All ad slots stay separated from studio action controls.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => onOpenLegal('privacy')} className="text-blue-400 hover:underline">
              Privacy Policy
            </button>
            <button type="button" onClick={() => onOpenLegal('terms')} className="text-blue-400 hover:underline">
              Terms of Service
            </button>
            <button type="button" onClick={() => onOpenLegal('adsense')} className="text-blue-400 hover:underline">
              AdSense Notice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. HELP & SUPPORT                                                          */
/* -------------------------------------------------------------------------- */

interface HelpSupportViewProps {
  onOpenLegal: (tab: LegalTab) => void;
}

export function HelpSupportView({ onOpenLegal }: HelpSupportViewProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Help &amp; Support</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Practical guides for getting the cleanest voiceovers, dialogues, and pronunciation results.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="studio-surface rounded-2xl p-5 space-y-2">
          <h2 className="font-display text-base font-semibold text-white">Dialogue &amp; Expressive Cues</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            When using Gemini 3.8 Flash TTS in Conversation Studio or Text-to-Speech, you can insert natural vocal
            cues such as <code className="font-mono text-blue-300">&lt;breath&gt;</code>,{' '}
            <code className="font-mono text-blue-300">&lt;laugh&gt;</code>, or backchannel responses like{' '}
            <code className="font-mono text-blue-300">|yeah|</code> and{' '}
            <code className="font-mono text-blue-300">|mhm|</code>.
          </p>
        </div>

        <div className="studio-surface rounded-2xl p-5 space-y-2">
          <h2 className="font-display text-base font-semibold text-white">African Voices &amp; Tonal Marks</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            For Yoruba, Igbo, and Hausa, include standard diacritics and test short lines first with the Pronunciation
            Assistant. For Nigerian, Ghanaian, South African, or Kenyan English, VoxCraft AI uses Gemini Voice Design
            style instructions for regional cadence.
          </p>
        </div>

        <div className="studio-surface rounded-2xl p-5 space-y-2">
          <h2 className="font-display text-base font-semibold text-white">Long Audiobooks &amp; Chunking</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Audiobook Maker splits chapters automatically at sentence boundaries so words are never cut mid-sentence.
            Always generate every chapter completely before combining into a full audiobook export.
          </p>
        </div>

        <div className="studio-surface rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-white">Policies &amp; Contact</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenLegal('contact')}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
            >
              Contact Support
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
