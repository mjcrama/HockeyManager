// Shared SVG icon components used across the app

// Opstelling — dots in a 1-3-3-1 formation pattern
export function OpstellingIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <circle cx="12" cy="21" r="2"/>
      <circle cx="5"  cy="16" r="2"/>
      <circle cx="12" cy="16" r="2"/>
      <circle cx="19" cy="16" r="2"/>
      <circle cx="5"  cy="10" r="2"/>
      <circle cx="12" cy="10" r="2"/>
      <circle cx="19" cy="10" r="2"/>
      <circle cx="12" cy="4"  r="2"/>
    </svg>
  );
}

// Wedstrijd — stopwatch (also used for timer)
export function WedstrijdIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="14" r="8"/>
      <path d="M9 2 h6" strokeWidth="2.5"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="10" x2="12" y2="14"/>
      <line x1="12" y1="14" x2="16" y2="14"/>
    </svg>
  );
}

// Score — goal posts with net
export function ScoreIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 21 L2 3 L22 3 L22 21" strokeWidth="2.5"/>
      <line x1="2"  y1="8"  x2="22" y2="8"  strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="2"  y1="13" x2="22" y2="13" strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="2"  y1="18" x2="22" y2="18" strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="8"  y1="3"  x2="8"  y2="21" strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="15" y1="3"  x2="15" y2="21" strokeWidth="1" strokeOpacity="0.55"/>
    </svg>
  );
}

// Wissels — two arrows swapping (substitution)
export function WisselsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 4 21 8 17 12"/>
      <path d="M3 8 h18"/>
      <polyline points="7 20 3 16 7 12"/>
      <path d="M21 16 H3"/>
    </svg>
  );
}
