// The library's older classes, filed by month. A month folds to one ruled
// line; open it and each class is a single row. Classes that just got filed
// show as cards for a beat, then fold away, so the tidy-up is seen, not sprung.

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import { formatMinutes, totalMinutes, type ClassPlan } from '../lib/plan.ts';
import { hrefFor } from '../lib/router.ts';
import { dateLocale, t } from '../lib/i18n.ts';

const FILED_KEY = 'maestranada.filed';
/** More than this many at once (a restore, a first visit) file without the show. */
const MAX_FOLDING = 6;

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  const label = d.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString(dateLocale(), { weekday: 'short' }).replace('.', '');
  return `${d.getDate()} ${weekday}`;
}

function readFiled(): Set<string> | null {
  try {
    const raw = localStorage.getItem(FILED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeFiled(ids: string[]) {
  try {
    localStorage.setItem(FILED_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full: the fold just plays again next time.
  }
}

/** Classes filed since the coach last looked. They keep a card until it has
 *  folded away; then their month's count ticks. */
export function useJustFiled(months: { month: string; plans: ClassPlan[] }[]) {
  const filedIds = months.flatMap((m) => m.plans.map((p) => p.id));
  const [folding, setFolding] = useState<string[]>(() => {
    const seen = readFiled();
    const fresh = filedIds.filter((id) => !seen?.has(id));
    return fresh.length <= MAX_FOLDING ? fresh : [];
  });
  const [ticking, setTicking] = useState<Set<string>>(new Set());
  const key = filedIds.join(',');
  useEffect(() => writeFiled(filedIds), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = (id: string) => {
    setFolding((ids) => ids.filter((x) => x !== id));
    const month = months.find((m) => m.plans.some((p) => p.id === id))?.month;
    if (month) setTicking((s) => new Set(s).add(month));
  };
  return { folding, done, ticking };
}

function Month({ month, plans, ticking }: { month: string; plans: ClassPlan[]; ticking: boolean }) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // A closed month's rows stay out of the tab order and away from screen readers.
  useEffect(() => {
    body.current?.toggleAttribute('inert', !open);
  }, [open]);
  return (
    <section className={`shelf-month${open ? ' is-open' : ''}`}>
      <button type="button" className="shelf-month-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronRight size={16} className="shelf-chev" />
        <span className="shelf-month-name">{monthLabel(month)}</span>
        <span className={`shelf-count${ticking ? ' is-ticking' : ''}`}>
          {plans.length === 1 ? t('planCountOne') : t('planCountMany', { n: plans.length })}
        </span>
      </button>
      <div className="shelf-body" ref={body}>
        <ul className="shelf-rows">
          {plans.map((p) => (
            <li key={p.id} className="shelf-row">
              <a className="shelf-row-main" href={hrefFor({ name: 'edit', id: p.id })}>
                <span className="shelf-day">{dayLabel(p.date)}</span>
                <span className="shelf-title">{p.title || t('untitledClass')}</span>
                <span className="shelf-length">{formatMinutes(totalMinutes(p))}</span>
              </a>
              <a
                className="icon-btn"
                href={hrefFor({ name: 'run', id: p.id })}
                aria-label={`${t('teach')}: ${p.title || t('untitledClass')}`}
                title={t('teach')}
              >
                <Play size={15} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Shelf({ months, ticking }: { months: { month: string; plans: ClassPlan[] }[]; ticking: Set<string> }) {
  if (!months.length) return null;
  return (
    <div className="shelf">
      <div className="eyebrow ruled shelf-head">{t('earlierClasses')}</div>
      {months.map((m) => (
        <Month key={m.month} month={m.month} plans={m.plans} ticking={ticking.has(m.month)} />
      ))}
    </div>
  );
}
