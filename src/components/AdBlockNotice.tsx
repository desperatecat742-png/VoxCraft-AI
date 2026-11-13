import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, X } from 'lucide-react';
import type { AdSensePublicConfig } from '../types/voxcraft';

const DISMISS_STORAGE_KEY = 'voxcraft_adblock_notice_dismissed';

interface AdBlockNoticeProps {
  adsense?: AdSensePublicConfig;
  variant?: 'landing' | 'studio';
}

async function detectAdBlocker(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  // Signal 1: Cosmetic filter DOM bait check
  let cosmeticBlocked = false;
  const bait = document.createElement('div');
  bait.className = 'adsbox ad-banner ad-unit pub_300x250';
  bait.setAttribute('aria-hidden', 'true');
  bait.style.position = 'fixed';
  bait.style.left = '-9999px';
  bait.style.top = '-9999px';
  bait.style.width = '10px';
  bait.style.height = '10px';
  bait.style.pointerEvents = 'none';
  bait.textContent = '\u00a0';
  document.body.appendChild(bait);

  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    const style = window.getComputedStyle(bait);
    if (
      bait.offsetHeight === 0 ||
      bait.offsetWidth === 0 ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      cosmeticBlocked = true;
    }
  } finally {
    bait.remove();
  }

  if (cosmeticBlocked) {
    return true;
  }

  // Signal 2: Network filter check on Google AdSense script (only when online)
  if (navigator.onLine === false) {
    return false;
  }

  try {
    await fetch(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
      }
    );
    return false;
  } catch {
    return true;
  }
}

export function AdBlockNotice({ adsense, variant = 'studio' }: AdBlockNoticeProps) {
  const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [checking, setChecking] = useState(false);
  const [stillBlockedMsg, setStillBlockedMsg] = useState(false);

  const runCheck = useCallback(async (isManualRecheck = false) => {
    if (!adsense?.enabled) return;
    setChecking(true);
    setStillBlockedMsg(false);
    const blocked = await detectAdBlocker();
    setAdBlockerDetected(blocked);
    setChecking(false);
    if (!blocked) {
      try {
        sessionStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      setDismissed(false);
    } else if (isManualRecheck) {
      setStillBlockedMsg(true);
    }
  }, [adsense?.enabled]);

  useEffect(() => {
    if (!adsense?.enabled) return;
    const timer = window.setTimeout(() => {
      void runCheck(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [adsense?.enabled, runCheck]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  if (!adsense?.enabled || !adBlockerDetected || dismissed) {
    return null;
  }

  const containerClass =
    variant === 'landing'
      ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4'
      : 'w-full';

  return (
    <div className={containerClass} role="region" aria-label="Ad-blocker notice">
      <div className="rounded-2xl bg-[#0D1326] border border-amber-500/35 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="font-display text-sm sm:text-base font-semibold text-white">
              Ad Blocker Detected — Help Keep VoxCraft AI Free
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              Display ads are our only source of revenue to pay for AI voice synthesis and keep every studio tool free.
              Please consider pausing your ad blocker or allowlisting this site.
            </p>
            {stillBlockedMsg && (
              <p className="text-xs text-amber-300 pt-0.5">
                An ad blocker still appears active. Allowlist this site in your browser extension and reload or re-check.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={checking}
            onClick={() => void runCheck(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : "I've Allowed Ads"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss ad-blocker notice"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            Continue Free
          </button>
        </div>
      </div>
    </div>
  );
}
