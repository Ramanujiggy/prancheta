// The class at a glance. The strip says what the class is made of: the five
// kinds of block, always in the same order, each with its minutes and a tally
// mark per block. A kind the class doesn't use stays faint, one tap from being
// added, so the coach always sees the whole set without being made to use it.
// Live time (positional sparring and rolling) is marked in red.
//
// The timeline in the margin is the class in teaching order. Its colours walk
// from light ink to full ink, the way a class builds from movement to rolling.

import { Plus } from 'lucide-react';
import {
  composition,
  formatMinutes,
  isLive,
  timeline,
  totalMinutes,
  type BlockKind,
  type ClassPlan,
} from '../lib/plan.ts';
import { t } from '../lib/i18n.ts';

export const KIND_COLORS: Record<BlockKind, string> = {
  warmup: 'var(--sec-1)',
  concept: 'var(--sec-2)',
  game: 'var(--sec-3)',
  gems: 'var(--sec-4)',
  freeRoll: 'var(--sec-5)',
  wrapup: 'var(--sec-2)',
};

export function ClassStrip({
  plan,
  onAdd,
  onJump,
}: {
  plan: ClassPlan;
  onAdd: (kind: BlockKind) => void;
  onJump: (kind: BlockKind) => void;
}) {
  const parts = composition(plan);
  const total = totalMinutes(plan);
  const live = parts.filter((p) => isLive(p.kind)).reduce((s, p) => s + p.minutes, 0);
  return (
    <div className="class-strip" role="group" aria-label={t('stripLabel')}>
      {parts.map((p) => {
        const name = t(`short.${p.kind}`);
        const used = p.count > 0;
        return (
          <button
            type="button"
            key={p.kind}
            className={`strip-kind${used ? '' : ' unused'}${isLive(p.kind) ? ' live' : ''}`}
            onClick={() => (used ? onJump(p.kind) : onAdd(p.kind))}
            aria-label={used ? `${t('stripJump', { name })}, ${formatMinutes(p.minutes)}` : t('stripAdd', { name })}
          >
            <span className="strip-tally" aria-hidden>
              {used ? Array.from({ length: Math.min(p.count, 5) }, (_, i) => <i key={i} />) : <Plus size={11} />}
            </span>
            <span className="strip-name">{name}</span>
            {used && <span className="strip-min">{Math.round(p.minutes)}</span>}
          </button>
        );
      })}
      {total > 0 && <span className="strip-live">{t('stripLive', { pct: Math.round((live / total) * 100) })}</span>}
    </div>
  );
}

export function Timeline({ plan, onJump }: { plan: ClassPlan; onJump?: (id: string) => void }) {
  const segments = timeline(plan);
  const total = totalMinutes(plan);
  return (
    <div className="card">
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {t('classLength')}
      </div>
      <div className="timeline-total">{formatMinutes(total)}</div>
      <div className="timeline-bar" aria-hidden>
        {segments.map((s) => (
          <span key={s.id} style={{ flexGrow: Math.max(s.minutes, 0.001), background: KIND_COLORS[s.kind] }} />
        ))}
      </div>
      <div className="timeline-rows">
        {segments.map((s, i) => (
          <button type="button" key={s.id} className="timeline-row" onClick={() => onJump?.(s.id)}>
            <span className="timeline-dot" style={{ background: KIND_COLORS[s.kind] }} />
            <span className="timeline-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="timeline-label">{s.label}</span>
            <span className="time">{formatMinutes(s.minutes)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
