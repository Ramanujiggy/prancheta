// The brand marks. Rank is the logo: the end of a black belt with its red
// bar. Clipboard (planning) and Round (teaching, a belt seen from above with
// the round's time left in red) are its two smaller siblings, drawn in
// currentColor so they sit in buttons like any other icon.

export function RankMark({ height = 22 }: { height?: number }) {
  return (
    <svg className="rank-mark" width={height * 1.5} height={height} viewBox="0 0 60 40" aria-hidden>
      <rect x="0" y="4" width="60" height="32" rx="6" className="belt" />
      <rect x="32" y="4" width="15" height="32" className="bar" />
    </svg>
  );
}

export function ClipboardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="5" width="14" height="17" rx="3" />
      <rect x="8.5" y="2" width="7" height="5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function RoundIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="3.2">
      <circle cx="12" cy="12" r="8" opacity="0.38" />
      <path d="M12 4A8 8 0 0 1 18.13 6.86" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="wordmark">
      <RankMark />
      Prancheta
    </span>
  );
}
