// Tally marks: how a coach counts rounds on a clipboard. One stroke per
// round, solid once it's done, half drawn while it's running, struck through
// in ink when the whole block is finished.

export function Tally({
  done,
  of,
  running = false,
  struck = false,
  height = 26,
  className = '',
}: {
  done: number;
  of: number;
  running?: boolean;
  struck?: boolean;
  height?: number;
  className?: string;
}) {
  const gap = height * 0.32;
  const width = Math.max(of, 1) * gap + gap;
  const stroke = Math.max(2, height * 0.11);
  return (
    <svg
      className={`tally ${className}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      strokeWidth={stroke}
      strokeLinecap="round"
    >
      {Array.from({ length: of }, (_, i) => {
        const x = gap * (i + 1) - gap / 2;
        return (
          <g key={i}>
            <line x1={x} y1={2} x2={x} y2={height - 2} className={i < done ? 'on' : 'off'} />
            {running && i === done && <line x1={x} y1={2} x2={x} y2={height * 0.55} className="on" />}
          </g>
        );
      })}
      {struck && <line x1={1} y1={height - 4} x2={width - 1} y2={4} className="strike" />}
    </svg>
  );
}

