interface LogoProps {
  compact?: boolean;
  onClick?: () => void;
}

export function Logo({ compact = false, onClick }: LogoProps) {
  const content = (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="28" height="28" rx="7" fill="url(#voxcraft-logo-grad)" />
        <path
          d="M6.5 14V14M10 10.5V17.5M14 7V21M18 10.5V17.5M21.5 12.5V15.5"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="voxcraft-logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-white">
          VoxCraft <span className="text-blue-400">AI</span>
        </span>
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      >
        {content}
      </button>
    );
  }

  return content;
}
