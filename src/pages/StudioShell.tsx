import { useState } from 'react';
import {
  BookOpen,
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  Home,
  Languages,
  LayoutDashboard,
  Megaphone,
  Menu,
  Mic2,
  Scissors,
  Settings,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { AdSlot } from '../components/AdSlot';
import { AdBlockNotice } from '../components/AdBlockNotice';
import { LegalModal, type LegalTab } from '../components/LegalModal';
import { DashboardView } from './studio/DashboardView';
import { TextToSpeechView } from './studio/TextToSpeechView';
import {
  BusinessAdvertView,
  ScriptWriterView,
  YouTubeVoiceoverView,
} from './studio/ScriptStudioViews';
import { TranslateSpeakView } from './studio/TranslateSpeakView';
import { ConversationStudioView } from './studio/ConversationStudioView';
import { AudiobookMakerView } from './studio/AudiobookMakerView';
import { AudioEditingStudioView } from './studio/AudioEditingStudioView';
import {
  HelpSupportView,
  HistoryView,
  ProjectsView,
  SettingsView,
  VoiceLibraryView,
} from './studio/LibraryManagementViews';
import { voxApi } from '../services/api';
import { extractWaveformPeaks } from '../utils/audioProcessor';
import type {
  EditorClip,
  GeneratedAudioClip,
  HistoryItem,
  PublicAppConfig,
  SavedProject,
  StudioView,
  UsageQuotaState,
  UserSession,
  VoicePreset,
} from '../types/voxcraft';

interface StudioShellProps {
  config: PublicAppConfig;
  initialView: StudioView;
  session: UserSession;
  quota: UsageQuotaState;
  favourites: string[];
  presets: VoicePreset[];
  projects: SavedProject[];
  history: HistoryItem[];
  onBackToHome: () => void;
  onSessionChange: (session: UserSession) => void;
  onQuotaUpdate: (quota: UsageQuotaState) => void;
  onFavouritesChange: (favs: string[]) => void;
  onPresetsChange: (presets: VoicePreset[]) => void;
  onProjectsChange: (projects: SavedProject[]) => void;
  onHistoryRefresh: () => void;
}

const NAV_ITEMS: { id: StudioView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tts', label: 'Text to Speech', icon: Mic2 },
  { id: 'script-writer', label: 'AI Script Writer', icon: FileText },
  { id: 'youtube', label: 'YouTube Voiceover', icon: Video },
  { id: 'advert', label: 'Business Advert Generator', icon: Megaphone },
  { id: 'translate', label: 'Translate and Speak', icon: Languages },
  { id: 'conversation', label: 'Conversation Studio', icon: Users },
  { id: 'audiobook', label: 'Audiobook Maker', icon: BookOpen },
  { id: 'audio-editor', label: 'Audio Editing Studio', icon: Scissors },
  { id: 'voice-library', label: 'Voice Library', icon: Volume2 },
  { id: 'projects', label: 'My Projects', icon: FolderOpen },
  { id: 'history', label: 'Generation History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help and Support', icon: HelpCircle },
];

export function StudioShell({
  config,
  initialView,
  session,
  quota,
  favourites,
  presets,
  projects,
  history,
  onBackToHome,
  onSessionChange,
  onQuotaUpdate,
  onFavouritesChange,
  onPresetsChange,
  onProjectsChange,
  onHistoryRefresh,
}: StudioShellProps) {
  const [activeView, setActiveView] = useState<StudioView>(initialView);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  // Cross-module studio handoff state
  const [ttsDraftText, setTtsDraftText] = useState('');
  const [ttsDraftVoiceId, setTtsDraftVoiceId] = useState(session.preferredVoiceId);
  const [ttsDraftLangCode, setTtsDraftLangCode] = useState(session.preferredLanguageCode);

  const [sessionClips, setSessionClips] = useState<GeneratedAudioClip[]>([]);
  const [editorClips, setEditorClips] = useState<EditorClip[]>([]);

  const handleAudioGenerated = (clip: GeneratedAudioClip) => {
    setSessionClips((prev) => [clip, ...prev]);
    onHistoryRefresh();
  };

  const handleSendToEditor = async (
    clip: Pick<EditorClip, 'title' | 'audioBase64' | 'mimeType' | 'durationSeconds'>
  ) => {
    let peaks = Array.from({ length: 48 }, () => 0.35);
    let duration = clip.durationSeconds;
    try {
      const extracted = await extractWaveformPeaks(clip.audioBase64, 48);
      peaks = extracted.peaks;
      if (extracted.durationSeconds > 0) duration = extracted.durationSeconds;
    } catch {
      // Fallback safely
    }

    const startOffset =
      editorClips.length === 0
        ? 0
        : Number(
            (
              editorClips.reduce(
                (max, c) => Math.max(max, c.startOffsetSeconds + c.durationSeconds),
                0
              ) + 0.15
            ).toFixed(2)
          );

    const newEditorClip: EditorClip = {
      id: `ed_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      title: clip.title,
      audioBase64: clip.audioBase64,
      mimeType: clip.mimeType,
      durationSeconds: duration,
      startOffsetSeconds: startOffset,
      volume: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      waveformPeaks: peaks,
    };
    setEditorClips((prev) => [...prev, newEditorClip]);
    setActiveView('audio-editor');
  };

  const handleSendToTts = (text: string, languageCode: string, voiceId?: string) => {
    setTtsDraftText(text);
    setTtsDraftLangCode(languageCode);
    if (voiceId) setTtsDraftVoiceId(voiceId);
    setActiveView('tts');
  };

  const handleReopenProject = (project: SavedProject) => {
    setTtsDraftText(project.content);
    setTtsDraftLangCode(project.languageCode);
    setTtsDraftVoiceId(project.voiceId);
    if (project.type === 'translation') {
      setActiveView('translate');
    } else if (project.type === 'audiobook') {
      setActiveView('audiobook');
    } else if (project.type === 'conversation') {
      setActiveView('conversation');
    } else if (project.type === 'youtube') {
      setActiveView('youtube');
    } else if (project.type === 'advert') {
      setActiveView('advert');
    } else {
      setActiveView('tts');
    }
  };

  const handleToggleFavourite = async (voiceId: string) => {
    const res = await voxApi.toggleFavourite(voiceId);
    onFavouritesChange(res.favourites);
  };

  const navigate = (view: StudioView) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  const activeNavMeta = NAV_ITEMS.find((i) => i.id === activeView);

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 xl:w-68 shrink-0 flex-col border-r border-slate-800/80 bg-[#050814]">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <Logo onClick={onBackToHome} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-2">
          <div className="rounded-xl bg-[#0D1326] border border-slate-800 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Daily Chars Left</span>
              <span className="font-mono tabular-nums text-white font-semibold">
                {quota.charactersRemainingToday.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (quota.charactersRemainingToday /
                        Math.max(1, quota.effectiveDailyCharacterLimit ?? quota.dailyCharacterLimit)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
            {quota.bonusCharactersToday > 0 && (
              <div className="text-[11px] text-violet-300 font-mono tabular-nums pt-0.5">
                +{quota.bonusCharactersToday.toLocaleString()} bonus chars active
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onBackToHome}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Back to Homepage
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#050814] border-r border-slate-800 flex flex-col h-full">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <Logo onClick={onBackToHome} />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left ${
                      active
                        ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-[#070B19]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open studio navigation"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-400 truncate">
              <span className="hidden sm:inline">Studio</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-medium text-white truncate">{activeNavMeta?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs font-mono tabular-nums text-slate-400">
              {quota.charactersRemainingToday.toLocaleString()} chars left
            </span>
            <button
              type="button"
              onClick={() => navigate('settings')}
              className="px-3 py-1.5 rounded-lg bg-[#0D1326] border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 whitespace-nowrap"
            >
              {session.isAuthenticated ? session.displayName : 'Sign In / Profile'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <AdBlockNotice adsense={config.adsense} variant="studio" />

          {activeView === 'dashboard' && (
            <DashboardView
              config={config}
              session={session}
              quota={quota}
              favourites={favourites}
              projects={projects}
              history={history}
              onNavigate={navigate}
              onUseVoiceInTts={(vId) => {
                setTtsDraftVoiceId(vId);
                navigate('tts');
              }}
              onReopenProject={handleReopenProject}
            />
          )}

          {activeView === 'tts' && (
            <TextToSpeechView
              config={config}
              quota={quota}
              initialText={ttsDraftText}
              initialVoiceId={ttsDraftVoiceId}
              initialLanguageCode={ttsDraftLangCode}
              onQuotaUpdate={onQuotaUpdate}
              onAudioGenerated={handleAudioGenerated}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'script-writer' && (
            <ScriptWriterView
              config={config}
              onQuotaUpdate={onQuotaUpdate}
              onSendToTts={handleSendToTts}
              onAudioGenerated={handleAudioGenerated}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'youtube' && (
            <YouTubeVoiceoverView
              config={config}
              onQuotaUpdate={onQuotaUpdate}
              onSendToTts={handleSendToTts}
              onAudioGenerated={handleAudioGenerated}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'advert' && (
            <BusinessAdvertView
              config={config}
              onQuotaUpdate={onQuotaUpdate}
              onSendToTts={handleSendToTts}
              onAudioGenerated={handleAudioGenerated}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'translate' && (
            <TranslateSpeakView
              config={config}
              onQuotaUpdate={onQuotaUpdate}
              onAudioGenerated={handleAudioGenerated}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'conversation' && (
            <ConversationStudioView
              config={config}
              onQuotaUpdate={onQuotaUpdate}
              onAudioGenerated={handleAudioGenerated}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'audiobook' && (
            <AudiobookMakerView
              config={config}
              onQuotaUpdate={onQuotaUpdate}
              onProjectSaved={onProjectsChange}
              onSendToEditor={handleSendToEditor}
            />
          )}

          {activeView === 'audio-editor' && (
            <AudioEditingStudioView
              editorClips={editorClips}
              sessionClips={sessionClips}
              onUpdateClips={setEditorClips}
            />
          )}

          {activeView === 'voice-library' && (
            <VoiceLibraryView
              config={config}
              favourites={favourites}
              presets={presets}
              onToggleFavourite={handleToggleFavourite}
              onPresetsUpdated={onPresetsChange}
              onUseVoiceInTts={(vId, lang) => {
                setTtsDraftVoiceId(vId);
                if (lang) setTtsDraftLangCode(lang);
                navigate('tts');
              }}
            />
          )}

          {activeView === 'projects' && (
            <ProjectsView
              projects={projects}
              onProjectsUpdated={onProjectsChange}
              onReopenProject={handleReopenProject}
            />
          )}

          {activeView === 'history' && (
            <HistoryView history={history} onHistoryUpdated={() => onHistoryRefresh()} />
          )}

          {activeView === 'settings' && (
            <SettingsView
              config={config}
              session={session}
              quota={quota}
              onSessionChange={onSessionChange}
              onOpenLegal={setLegalTab}
            />
          )}

          {activeView === 'help' && <HelpSupportView onOpenLegal={setLegalTab} />}

          <AdSlot placement="studio-footer" adsense={config.adsense} />
        </main>
      </div>

      <LegalModal
        activeTab={legalTab}
        onClose={() => setLegalTab(null)}
        onSwitchTab={(tab) => setLegalTab(tab)}
      />
    </div>
  );
}
