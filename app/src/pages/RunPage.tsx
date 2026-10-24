// Teach mode: the plan as a coach uses it on the mat. One block at a time in
// large type, in the coach's order, with the round timer beside the blocks
// that are timed. Positional sparring's details stay folded until the coach
// chooses to show them, because the class feels the game before it hears the
// details.

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, X } from 'lucide-react';
import {
  blockLabel,
  blockSchedule,
  describeGameRounds,
  kindLabel,
  type ClassPlan,
  type ListItem,
  type Move,
} from '../lib/plan.ts';
import { navigate } from '../lib/router.ts';
import { RoundTimer } from '../components/RoundTimer.tsx';
import { ClipView } from '../components/ClipField.tsx';
import { t } from '../lib/i18n.ts';


/** Keeps the screen on while the class is being taught, so the timer stays
 *  visible and audible. The lock drops when the page hides, so it is taken
 *  again each time the page comes back. */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    let sentinel: Sentinel | null = null;
    let live = true;
    const take = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen')
        .then((s) => {
          if (live) sentinel = s;
          else void s.release();
        })
        .catch(() => {});
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', take);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

function BigList({ items }: { items: ListItem[] }) {
  const filled = items.filter((x) => x.text.trim());
  if (!filled.length) return null;
  return (
    <ul className="run-list">
      {filled.map((x) => (
        <li key={x.id}>{x.text}</li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="muted">{t('nothingPlanned')}</p>;
}

export function RunPage({ plan }: { plan: ClassPlan }) {
  const blocks = plan.blocks;
  const last = blocks.length - 1;
  const [step, setStepRaw] = useState(0);
  const [shownDetails, setShownDetails] = useState<Record<string, boolean>>({});
  const setStep = (s: number | ((s: number) => number)) => setStepRaw((cur) => Math.max(0, Math.min(last, typeof s === 'function' ? s(cur) : s)));
  const block = blocks[Math.min(step, last)];
  const showDetails = !!shownDetails[block.id];
  useWakeLock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') setStep((s) => s + 1);
      if (e.key === 'ArrowLeft') setStep((s) => s - 1);
      if (e.key === 'Escape') navigate({ name: 'edit', id: plan.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [plan.id, last]);

  // Braces matter: newer Chrome returns a promise from scrollTo, and React
  // would call that as the effect's clean-up and crash Teach mode.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Swipe left or right between blocks, as well as the buttons. Only a
  // mostly horizontal flick counts, so scrolling a long list never moves on.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || (e.target as HTMLElement).closest('input, textarea, .timer-queue')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setStep((s) => (dx < 0 ? s + 1 : s - 1));
  };

  // One schedule per timed block, by block id, so every timer can stay mounted.
  const schedules = useMemo(() => new Map(blocks.map((b) => [b.id, blockSchedule(b)])), [blocks]);
  const schedule = schedules.get(block.id);

  // Technique's moves, or the ones another block holds, each with its clip.
  const moves = (block.moves ?? []).filter((m) => m.name.trim() || m.notes.trim() || m.clip);
  let body;
  switch (block.kind) {
    case 'warmup':
      body = block.drills.some((d) => d.text.trim()) ? <BigList items={block.drills} /> : moves.length ? null : <Empty />;
      break;
    case 'concept':
      body = (
        <>
          <div className="eyebrow-strong ruled" style={{ marginBottom: 10 }}>
            {t('generalRule')}
          </div>
          <p className="run-big run-lead" style={{ fontSize: 'clamp(26px, 3.6vw, 36px)' }}>
            {block.rule || <span className="muted">{t('noRule')}</span>}
          </p>
          {block.notes && <p className="run-big muted">{block.notes}</p>}
        </>
      );
      break;
    case 'game':
      body = (
        <>
          <div className="run-block">
            <div className="eyebrow-strong ruled" style={{ marginBottom: 12 }}>
              {t('goalsAndMovements')}
            </div>
            {block.goals.length ? <BigList items={block.goals} /> : <Empty />}
          </div>
          <div className="run-block">
            <span className="pill">{describeGameRounds(block.rounds)}</span>
          </div>
          <div className="run-block run-reveal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="eyebrow-strong">{t('details')}</div>
              <button type="button" className="btn btn-secondary" onClick={() => setShownDetails((d) => ({ ...d, [block.id]: !d[block.id] }))}>
                {showDetails ? <EyeOff size={15} /> : <Eye size={15} />}
                {showDetails ? t('hide') : t('showDetails')}
              </button>
            </div>
            {showDetails ? (
              <div style={{ marginTop: 16 }}>
                <BigList items={block.details} />
                {block.transition && (
                  <p className="run-big">
                    <span className="sub-label">{t('transition')}</span>
                    <br />
                    {block.transition}
                  </p>
                )}
                {block.submission && (
                  <p className="run-big" style={{ marginBottom: 0 }}>
                    <span className="sub-label">{t('submission')}</span>
                    <br />
                    {block.submission}
                  </p>
                )}
              </div>
            ) : (
              <p className="section-hint" style={{ marginTop: 8 }}>
                {t('detailsLater')}
              </p>
            )}
          </div>
        </>
      );
      break;
    case 'gems': {
      body = (
        <>
          {moves.length === 0 && block.options.length === 0 && <Empty />}
          <RunMoves moves={moves} />
          {block.options.length > 0 && (
            <div className="run-block">
              <div className="eyebrow-strong ruled" style={{ marginBottom: 12 }}>
                {t('options')}
              </div>
              <BigList items={block.options} />
            </div>
          )}
        </>
      );
      break;
    }
    case 'freeRoll':
      body = block.notes ? <p className="run-big">{block.notes}</p> : <p className="run-big muted">{t('rollItOut')}</p>;
      break;
    case 'wrapup':
      body = (
        <>
          {block.question ? (
            <p className="run-big run-lead" style={{ fontSize: 'clamp(26px, 3.6vw, 36px)' }}>
              {block.question}
            </p>
          ) : moves.length ? null : (
            <Empty />
          )}
          {block.notes && <p className="run-big muted">{block.notes}</p>}
        </>
      );
      break;
  }

  const heading =
    block.kind === 'game'
      ? `${block.start || blockLabel(block)}${block.objective ? ` → ${block.objective}` : ''}`
      : block.kind === 'warmup' && !block.title.trim()
        ? t('sec.movement')
        : blockLabel(block);

  return (
    <div className="shell run" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="topbar" style={{ marginBottom: 18 }}>
        <span className="run-head-title">{plan.title || t('untitledClass')}</span>
        <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'edit', id: plan.id })}>
          <X size={17} /> {t('exit')}
        </button>
      </header>

      <nav className="run-progress" aria-label={t('classBlocks')}>
        {blocks.map((b, i) => (
          <button
            type="button"
            key={b.id}
            className={i === step ? 'active' : i < step ? 'done' : ''}
            onClick={() => setStep(i)}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="bar" />
            <span className="label">
              {i + 1} · {blockLabel(b)}
            </span>
          </button>
        ))}
      </nav>

      <div className={`run-stage ${schedule ? '' : 'solo'}`}>
        <div key={block.id}>
          <div className="run-kicker">
            <span className="num-tag">{String(step + 1).padStart(2, '0')}</span>
            <span className="eyebrow">{kindLabel(block.kind)}</span>
          </div>
          <h1 className="run-title">{heading}</h1>
          {body}
          {block.kind !== 'gems' && <RunMoves moves={moves} />}
        </div>
        {/* Every timer stays mounted, so stepping to another block mid-round
            never loses the clock; only the current block's timer shows. */}
        {blocks.map((b) => {
          const segments = schedules.get(b.id);
          return segments ? (
            <div className="card run-timer" key={b.id} hidden={b.id !== block.id}>
              <RoundTimer segments={segments} title={b.kind === 'game' && !b.title.trim() ? t('timerGame') : blockLabel(b)} />
            </div>
          ) : null;
        })}
      </div>

      <div className="run-nav">
        <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft size={16} /> <span className="run-nav-label">{step > 0 ? blockLabel(blocks[step - 1]) : t('back')}</span>
        </button>
        {step < last ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            <span className="run-nav-label">{blockLabel(blocks[step + 1])}</span> <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'edit', id: plan.id })}>
            {t('finishClass')}
          </button>
        )}
      </div>
    </div>
  );
}

function RunMoves({ moves }: { moves: Move[] }) {
  return moves.map((m, i) => (
    <div className="run-block" key={m.id}>
      <div className="eyebrow-strong ruled" style={{ marginBottom: 8 }}>
        {t('moveN', { n: i + 1 })}
      </div>
      <p className="run-big run-lead" style={{ fontSize: 'clamp(24px, 3.2vw, 32px)', marginBottom: 6 }}>
        {m.name || t('untitledMove')}
      </p>
      {m.clip && <ClipView clip={m.clip} label={m.name || t('moveN', { n: i + 1 })} />}
      {m.notes && <p className="run-big muted">{m.notes}</p>}
    </div>
  ));
}
