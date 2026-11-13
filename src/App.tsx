import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LandingPage } from './pages/LandingPage';
import { StudioShell } from './pages/StudioShell';
import { voxApi } from './services/api';
import type {
  HistoryItem,
  PublicAppConfig,
  SavedProject,
  StudioView,
  UsageQuotaState,
  UserSession,
  VoicePreset,
} from './types/voxcraft';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [config, setConfig] = useState<PublicAppConfig | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [quota, setQuota] = useState<UsageQuotaState | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [inStudio, setInStudio] = useState(false);
  const [studioInitialView, setStudioInitialView] = useState<StudioView>('dashboard');

  const refreshHistory = useCallback(async () => {
    try {
      const res = await voxApi.listHistory();
      setHistory(res.history);
    } catch {
      // Ignore silent refresh error
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cfg, sess, projRes, histRes] = await Promise.all([
        voxApi.getConfig(),
        voxApi.getSession(),
        voxApi.listProjects(),
        voxApi.listHistory(),
      ]);
      setConfig(cfg);
      setSession(sess.session);
      setQuota(sess.quota);
      setFavourites(sess.favourites);
      setPresets(sess.presets);
      setProjects(projRes.projects);
      setHistory(histRes.history);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to connect to VoxCraft AI backend.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleEnterStudio = (initialView: StudioView = 'dashboard') => {
    setStudioInitialView(initialView);
    setInStudio(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B19] text-slate-200 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Loading VoxCraft AI studio...</p>
      </div>
    );
  }

  if (loadError || !config || !session || !quota) {
    return (
      <div className="min-h-screen bg-[#070B19] text-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="font-display text-xl font-bold text-white">Connection Error</h1>
        <p className="text-sm text-slate-400 max-w-md">{loadError || 'Studio configuration failed to load.'}</p>
        <button
          type="button"
          onClick={bootstrap}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!inStudio) {
    return <LandingPage config={config} onEnterStudio={handleEnterStudio} />;
  }

  return (
    <StudioShell
      config={config}
      initialView={studioInitialView}
      session={session}
      quota={quota}
      favourites={favourites}
      presets={presets}
      projects={projects}
      history={history}
      onBackToHome={() => setInStudio(false)}
      onSessionChange={async (nextSession) => {
        setSession(nextSession);
        const [projRes, histRes, sessRes] = await Promise.all([
          voxApi.listProjects(),
          voxApi.listHistory(),
          voxApi.getSession(),
        ]);
        setProjects(projRes.projects);
        setHistory(histRes.history);
        setQuota(sessRes.quota);
        setFavourites(sessRes.favourites);
        setPresets(sessRes.presets);
      }}
      onQuotaUpdate={setQuota}
      onFavouritesChange={setFavourites}
      onPresetsChange={setPresets}
      onProjectsChange={setProjects}
      onHistoryRefresh={refreshHistory}
    />
  );
}
