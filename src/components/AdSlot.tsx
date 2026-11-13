import { useEffect, useRef } from 'react';
import type { AdSensePublicConfig } from '../types/voxcraft';

interface AdSlotProps {
  placement: 'homepage-banner' | 'dashboard-panel' | 'studio-footer' | 'guide-sidebar';
  adsense?: AdSensePublicConfig;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Google AdSense responsive display slot.
 * Renders real AdSense `<ins class="adsbygoogle">` markup using the configured Publisher ID
 * without fake/simulated ad visuals, and remains isolated from audio generation & playback controls.
 */
export function AdSlot({ placement, adsense }: AdSlotProps) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!adsense?.enabled || !adsense.publisherId || pushedRef.current) {
      return;
    }
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // Ignore silently if blocked by browser privacy extensions or pending domain verification
    }
  }, [adsense?.enabled, adsense?.publisherId]);

  if (!adsense || !adsense.enabled || !adsense.publisherId) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      data-ad-placement={placement}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2"
    >
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={adsense.publisherId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
