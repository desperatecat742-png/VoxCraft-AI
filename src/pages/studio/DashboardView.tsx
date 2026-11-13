import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderOpen,
  History,
  Languages,
  Megaphone,
  Mic2,
  Scissors,
  Sparkles,
  Star,
  Users,
  Video,
  Volume2,
} from 'lucide-react';
import { AdSlot } from '../../components/AdSlot';
import type {
  HistoryItem,
  PublicAppConfig,
  SavedProject,
  StudioView,
  UsageQuotaState,
  UserSession,
} from '../../types/voxcraft';

interface DashboardViewProps {
  config: PublicAppConfig;
  session: UserSession;
  quota: UsageQuotaState;
  favourites: string[];
  projects: SavedProject[];
  history: HistoryItem[];
  onNavigate: (view: StudioView) => void;
  onUseVoiceInTts: (voiceId: string) => void;
  onReopenProject: (project: SavedProject) => void;
}

export function DashboardView({
  config,
  session,
  quota,
  favourites,
  projects,
  history,
  onNavigate,
  onUseVoiceInTts,
  onReopenProject,
}: DashboardViewProps) {
  const favouriteVoiceObjects = config.voices.filter((v) => favourites.includes(v.id));

  const featureCards: {
    view: StudioView;
    title: string;
    desc: string;
    icon: typeof Mic2;
  }[] = [
    {
      view: 'tts',
      title: 'Text to Speech',
      desc: 'Generate natural voiceovers in WAV or MP3 with emotion and pronunciation controls.',
      icon: Mic2,
    },
    {
      view: 'script-writer',
      title: 'AI Script Writer',
      desc: 'Draft hooks, transitions, and calls to action tailored for your audience.',
      icon: FileText,
    },
    {
      view: 'youtube',
      title: 'YouTube Voiceover',
      desc: 'Create documentary, explainer, or faceless channel narration ready for export.',
      icon: Video,
    },
    {
      view: 'advert',
      title: 'Business Advert Generator',
      desc: 'Produce promotional scripts with estimated read durations and commercial voiceovers.',
      icon: Megaphone,
    },
    {
      view: 'translate',
      title: 'Translate and Speak',
      desc: 'Translate scripts side-by-side and generate target-language speech.',
      icon: Languages,
    },
    {
      view: 'conversation',
      title: 'Conversation Studio',
      desc: 'Build multi-speaker podcasts and interviews with distinct AI voices.',
      icon: Users,
    },
    {
      view: 'audiobook',
      title: 'Audiobook Maker',
      desc: 'Split long chapters cleanly at sentence boundaries and export combined audio.',
      icon: BookOpen,
    },
    {
      view: 'audio-editor',
      title: 'Audio Editing Studio',
      desc: 'Arrange generated clips on a timeline with volume, fades, and master mix export.',
      icon: Scissors,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="studio-surface-elevated rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Welcome back, {session.displayName}
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Your VoxCraft AI studio is ready. Create voiceovers, write scripts, translate narration, or edit clips in
            one workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('tts')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            Quick Voice Generation
          </button>
        </div>
      </div>

      {/* Key Quota & Production Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="studio-surface rounded-xl p-5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-400">Available Daily Characters</p>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              {quota.planTier === 'pro' ? 'Pro Plan' : 'Free Plan'}
            </button>
          </div>
          <p className="font-display text-2xl font-bold text-white font-mono tabular-nums">
            {quota.charactersRemainingToday.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            of {quota.effectiveDailyCharacterLimit.toLocaleString()} / day
            {quota.bonusCharactersToday > 0 ? ` (+${quota.bonusCharactersToday.toLocaleString()} bonus)` : ''}
          </p>
        </div>

        <div className="studio-surface rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-slate-400">Daily Generations Left</p>
          <p className="font-display text-2xl font-bold text-white font-mono tabular-nums">
            {quota.generationsRemainingToday}
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {quota.generationsToday} used today
          </p>
        </div>

        <div className="studio-surface rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-slate-400">Total Generated Audio</p>
          <p className="font-display text-2xl font-bold text-white font-mono tabular-nums">
            {quota.totalGeneratedAudioCount}
          </p>
          <p className="text-xs text-slate-500">Clips synthesized in account</p>
        </div>

        <div className="studio-surface rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-slate-400">Saved Projects</p>
          <p className="font-display text-2xl font-bold text-white font-mono tabular-nums">
            {projects.length}
          </p>
          <p className="text-xs text-slate-500">Scripts, translations &amp; books</p>
        </div>
      </div>

      <AdSlot placement="dashboard-panel" adsense={config.adsense} />

      {/* Favourite Voices */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">Favourite Voices</h2>
          <button
            type="button"
            onClick={() => onNavigate('voice-library')}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Browse Voice Library →
          </button>
        </div>
        {favouriteVoiceObjects.length === 0 ? (
          <div className="studio-surface rounded-xl p-5 text-sm text-slate-400 flex items-center justify-between gap-4">
            <span>No favourite voices saved yet. Star any voice in the Voice Library to pin it here.</span>
            <button
              type="button"
              onClick={() => onNavigate('voice-library')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white shrink-0"
            >
              Explore Voices
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favouriteVoiceObjects.map((voice) => (
              <div key={voice.id} className="studio-surface rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    <p className="font-display text-sm font-semibold text-white truncate">{voice.name}</p>
                    <span className="text-xs text-slate-400">· {voice.genderLabel}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-1">{voice.timbre}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUseVoiceInTts(voice.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium shrink-0"
                >
                  Use Voice
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick-Access Feature Cards */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-white">Production Studios</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.view}
                type="button"
                onClick={() => onNavigate(card.view)}
                className="studio-surface hover:border-blue-500/40 rounded-xl p-5 text-left transition-colors flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Projects & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="studio-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Recent Projects
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View All
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              No saved projects yet. Save any script, translation, or voiceover project to access it quickly here.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {projects.slice(0, 4).map((proj) => (
                <div key={proj.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{proj.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {proj.type} · {proj.languageCode} · {new Date(proj.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onReopenProject(proj)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 shrink-0"
                  >
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="studio-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-violet-400" />
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Full History
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              Your generated voiceovers, scripts, and translations will appear here automatically.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {history.slice(0, 4).map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.kind} · {item.charCount.toLocaleString()} chars ·{' '}
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Volume2 className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
