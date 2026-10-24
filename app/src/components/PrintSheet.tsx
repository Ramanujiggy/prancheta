// The paper version of a plan — hidden on screen, shown only when printing.
// One page a coach can fold into a gi pocket: a box to tick per block, the
// times in a right-hand column, and a grid only where you write by hand.

import type { ReactNode } from 'react';
import {
  blockLabel,
  blockMinutes,
  describeGameRounds,
  formatMinutes,
  totalMinutes,
  type Block,
  type ClassPlan,
  type Clip,
  type ListItem,
  type Move,
} from '../lib/plan.ts';
import { useClipStill } from '../lib/clips.ts';
import { formatRest } from './controls.tsx';
import { RankMark } from './Marks.tsx';
import { dateLocale, t } from '../lib/i18n.ts';

function Bullets({ items }: { items: ListItem[] }) {
  const filled = items.filter((x) => x.text.trim());
  if (!filled.length) return null;
  return (
    <ul>
      {filled.map((x) => (
        <li key={x.id}>{x.text}</li>
      ))}
    </ul>
  );
}

function BlockBox({ title, time, children }: { title: string; time: string; children: ReactNode }) {
  return (
    <section>
      <span className="ps-box" />
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      <span className="ps-time">{time}</span>
    </section>
  );
}

// Paper can't play a clip, so the printed sheet shows a still frame of it.
function PrintClip({ clip }: { clip: Clip }) {
  const url = useClipStill(clip);
  return url ? <img className="ps-clip" src={url} alt="" width={clip.width} height={clip.height} /> : null;
}

function Line({ k, v }: { k: string; v: string }) {
  if (!v.trim()) return null;
  return (
    <p>
      <span className="ps-k">{k}</span> {v}
    </p>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function BlockBody({ block }: { block: Block }) {
  switch (block.kind) {
    case 'warmup':
      return <Bullets items={block.drills} />;
    case 'concept':
      return (
        <>
          {block.rule && (
            <p>
              <strong>{t('generalRule')}:</strong> {block.rule}
            </p>
          )}
          {block.notes && <p>{block.notes}</p>}
        </>
      );
    case 'game':
      return (
        <>
          <p>
            <strong>
              {block.start || t('startPosition')} → {block.objective || t('objectiveLower')}
            </strong>
          </p>
          {block.goals.length > 0 && <h3>{t('goalsAndMovements')}</h3>}
          <Bullets items={block.goals} />
          {block.details.length > 0 && <h3>{t('details')}</h3>}
          <Bullets items={block.details} />
          <Line k={t('transition')} v={block.transition} />
          <Line k={t('submission')} v={block.submission} />
          <Line k={t('rounds')} v={`${describeGameRounds(block.rounds)} · ${t('restLower')} ${formatRest(block.rounds.restSeconds)}`} />
        </>
      );
    case 'gems':
      return (
        <>
          <PrintMoves moves={block.moves} />
          {block.options.length > 0 && <h3>{t('options')}</h3>}
          <Bullets items={block.options} />
        </>
      );
    case 'freeRoll':
      return (
        <>
          <p>
            {block.rounds} × {block.minutes} min · {t('restLower')} {formatRest(block.restSeconds)}
          </p>
          {block.notes && <p>{block.notes}</p>}
        </>
      );
    case 'wrapup':
      return (
        <>
          {block.question && (
            <p>
              <strong>{block.question}</strong>
            </p>
          )}
          {block.notes && <p>{block.notes}</p>}
        </>
      );
  }
}

export function PrintSheet({ plan }: { plan: ClassPlan }) {
  return (
    <div className="print-sheet">
      <div className="ps-head">
        <h1>
          <RankMark height={22} />
          {plan.title || t('untitledClass')}
        </h1>
        <div className="ps-meta">
          {formatDate(plan.date)}
          <br />
          {formatMinutes(totalMinutes(plan))}
        </div>
      </div>

      {plan.blocks.map((b) => (
        <BlockBox key={b.id} title={blockLabel(b)} time={formatMinutes(blockMinutes(b))}>
          <BlockBody block={b} />
          {b.kind !== 'gems' && b.moves && <PrintMoves moves={b.moves} />}
        </BlockBox>
      ))}

      <div className="ps-notes">
        <span className="ps-k">{t('notes')}</span>
      </div>
      <div className="ps-foot">
        <span>prancheta</span>
        <span>{plan.title}</span>
      </div>
    </div>
  );
}

/** Technique's moves, or the ones another block holds, each with a still of its clip. */
function PrintMoves({ moves }: { moves: Move[] }) {
  return moves
    .filter((m) => m.name.trim() || m.notes.trim() || m.clip)
    .map((m, i) => (
      <div key={m.id}>
        <h3>{t('moveNamed', { n: i + 1, name: m.name })}</h3>
        {m.clip && <PrintClip clip={m.clip} />}
        {m.notes && <p>{m.notes}</p>}
      </div>
    ));
}
