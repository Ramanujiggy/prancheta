// The fields inside each kind of block, as the editor shows them when the
// block is open. Optional parts stay folded into "+ Label" chips until used.

import type { ReactNode } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import {
  describeGameRounds,
  gameRoundCount,
  item,
  move,
  movementSuggestions,
  type Block,
  type BlockOf,
  type GameBlock,
  type Move,
} from '../lib/plan.ts';
import { Field, Stepper, TextArea, TextInput, Toggle, formatRest } from './controls.tsx';
import { EditableList } from './EditableList.tsx';
import { ClipField } from './ClipField.tsx';
import { t } from '../lib/i18n.ts';

/** The parts of a block a coach can leave out. Folded into "+ Label" chips until used. */
export function Extras({ items }: { items: { key: string; label: string; onReveal: () => void }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="extras">
      <span className="extras-label">{t('addIfYouWant')}</span>
      <div className="chips">
        {items.map((x) => (
          <button type="button" key={x.key} className="chip" onClick={x.onReveal}>
            <Plus size={12} /> {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubPanel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="subpanel">
      <div className="eyebrow-strong">{title}</div>
      {hint && (
        <p className="section-hint" style={{ margin: '4px 0 12px' }}>
          {hint}
        </p>
      )}
      {!hint && <div style={{ height: 10 }} />}
      {children}
    </div>
  );
}

function MinutesStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="time-row">
      <Stepper label={t('time')} value={value} onChange={onChange} min={0} max={90} format={(v) => t('minutes', { n: v })} />
    </div>
  );
}

/** Which optional parts are open, kept by the editor so they stay open while the coach types. */
export interface Reveal {
  isShown: (key: string, has: boolean) => boolean;
  extra: (key: string, label: string, has: boolean) => { key: string; label: string; onReveal: () => void }[];
  /** The id of the element that wraps an optional part, so revealing it can focus its field. */
  extraId: (key: string) => string;
}

interface Props<K extends Block['kind']> {
  block: BlockOf<K>;
  set: (b: BlockOf<K>) => void;
  reveal: Reveal;
}

function WarmupFields({ block, set }: Props<'warmup'>) {
  const unused = movementSuggestions().filter((s) => !block.drills.some((d) => d.text.trim().toLowerCase() === s.toLowerCase()));
  return (
    <>
      <MinutesStepper value={block.minutes} onChange={(minutes) => set({ ...block, minutes })} />
      <EditableList items={block.drills} onChange={(drills) => set({ ...block, drills })} placeholder={t('addDrill')} />
      {unused.length > 0 && (
        <div className="extras">
          <span className="extras-label">{t('tapToAdd')}</span>
          <div className="chips chips-scroll">
            {unused.map((s) => (
              <button type="button" key={s} className="chip" onClick={() => set({ ...block, drills: [...block.drills, item(s)] })}>
                <Plus size={12} /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ConceptFields({ block, set, reveal }: Props<'concept'>) {
  const has = !!block.notes.trim();
  return (
    <>
      <MinutesStepper value={block.minutes} onChange={(minutes) => set({ ...block, minutes })} />
      <Field label={t('generalRule')}>
        {(id) => <TextInput id={id} value={block.rule} placeholder={t('rulePh')} onChange={(rule) => set({ ...block, rule })} />}
      </Field>
      {reveal.isShown('explain', has) && (
        <div id={reveal.extraId('explain')}>
          <Field label={t('explainLabel')}>
            {(id) => <TextArea id={id} value={block.notes} placeholder={t('explainPh')} onChange={(notes) => set({ ...block, notes })} />}
          </Field>
        </div>
      )}
      <Extras items={reveal.extra('explain', t('explainLabel'), has)} />
    </>
  );
}

function GameFields({ block, set, reveal, earlier }: Props<'game'> & { earlier?: { n: number; game: GameBlock } }) {
  const rounds = block.rounds;
  const setRounds = (r: Partial<GameBlock['rounds']>) => set({ ...block, rounds: { ...rounds, ...r } });
  const blank = !block.start.trim() && !block.objective.trim() && block.goals.length === 0;
  const hasTransition = !!block.transition.trim();
  const hasSubmission = !!block.submission.trim();
  return (
    <>
      {blank && earlier && (
        <div>
          <button
            type="button"
            className="chip"
            onClick={() => {
              const g = earlier.game;
              set({ ...block, start: g.start, objective: g.objective, goals: g.goals.map((x) => item(x.text)), transition: g.transition, submission: g.submission });
            }}
          >
            <Copy size={12} /> {t('sameAsBlock', { n: String(earlier.n).padStart(2, '0') })}
          </button>
        </div>
      )}
      <div className="grid-2">
        <Field label={t('startPosition')}>
          {(id) => <TextInput id={id} value={block.start} placeholder={t('startPh')} onChange={(start) => set({ ...block, start })} />}
        </Field>
        <Field label={t('objective')}>
          {(id) => (
            <TextInput id={id} value={block.objective} placeholder={t('objectivePh')} onChange={(objective) => set({ ...block, objective })} />
          )}
        </Field>
      </div>

      <SubPanel title={t('goalsTitle')} hint={t('goalsHint')}>
        <EditableList items={block.goals} onChange={(goals) => set({ ...block, goals })} placeholder={t('goalsPh')} />
      </SubPanel>

      {reveal.isShown('details', block.details.length > 0) && (
        <div id={reveal.extraId('details')}>
          <SubPanel title={t('details')} hint={t('detailsHint')}>
            <EditableList items={block.details} onChange={(details) => set({ ...block, details })} placeholder={t('detailsPh')} />
          </SubPanel>
        </div>
      )}

      {(reveal.isShown('transition', hasTransition) || reveal.isShown('submission', hasSubmission)) && (
        <div className="grid-2">
          {reveal.isShown('transition', hasTransition) && (
            <div id={reveal.extraId('transition')}>
              <Field label={t('transitionLabel')}>
                {(id) => (
                  <TextInput
                    id={id}
                    value={block.transition}
                    placeholder={t('transitionPh')}
                    onChange={(transition) => set({ ...block, transition })}
                  />
                )}
              </Field>
            </div>
          )}
          {reveal.isShown('submission', hasSubmission) && (
            <div id={reveal.extraId('submission')}>
              <Field label={t('submissionLabel')}>
                {(id) => (
                  <TextInput
                    id={id}
                    value={block.submission}
                    placeholder={t('submissionPh')}
                    onChange={(submission) => set({ ...block, submission })}
                  />
                )}
              </Field>
            </div>
          )}
        </div>
      )}

      <Extras
        items={[
          ...reveal.extra('details', t('detailsChip'), block.details.length > 0),
          ...reveal.extra('transition', t('transition'), hasTransition),
          ...reveal.extra('submission', t('submission'), hasSubmission),
        ]}
      />

      <SubPanel title={t('rounds')}>
        <div className="stepper-row">
          <Stepper
            label={rounds.switchPositions ? t('roundsPerSide') : t('rounds')}
            value={rounds.roundsPerSide}
            min={1}
            max={12}
            onChange={(roundsPerSide) => setRounds({ roundsPerSide })}
          />
          <Stepper
            label={t('length')}
            value={rounds.minutes}
            min={1}
            max={15}
            format={(v) => t('minutes', { n: v })}
            onChange={(minutes) => setRounds({ minutes })}
          />
          <Stepper
            label={t('rest')}
            value={rounds.restSeconds}
            min={0}
            max={180}
            step={15}
            format={formatRest}
            onChange={(restSeconds) => setRounds({ restSeconds })}
          />
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14 }}>
          <Toggle label={t('switchPartners')} checked={rounds.switchPartners} onChange={(switchPartners) => setRounds({ switchPartners })} />
          <Toggle
            label={t('thenSwitchPositions')}
            checked={rounds.switchPositions}
            onChange={(switchPositions) => setRounds({ switchPositions })}
          />
        </div>
        <p className="section-hint" style={{ marginTop: 12 }}>
          {describeGameRounds(rounds)} · {t('roundsInAll', { n: gameRoundCount(rounds) })}
        </p>
      </SubPanel>
    </>
  );
}

function TechniqueFields({
  block,
  set,
  reveal,
  notify,
  askRemoveMove,
}: Props<'gems'> & { notify: (m: string) => void; askRemoveMove: (moveId: string) => void }) {
  return (
    <>
      <MinutesStepper value={block.minutes} onChange={(minutes) => set({ ...block, minutes })} />
      <MoveCards moves={block.moves} onChange={(moves) => set({ ...block, moves })} notify={notify} askRemoveMove={askRemoveMove} />
      {reveal.isShown('options', block.options.length > 0) && (
        <div id={reveal.extraId('options')}>
          <SubPanel title={t('options')} hint={t('optionsHint')}>
            <EditableList items={block.options} onChange={(options) => set({ ...block, options })} placeholder={t('optionsPh')} />
          </SubPanel>
        </div>
      )}
      <Extras items={reveal.extra('options', t('optionsChip'), block.options.length > 0)} />
    </>
  );
}

/** Move cards: a name, details and a clip each, with Add move under them. Technique is built
 *  on these; any other block can hold some too (a warm-up movement with its clip). */
export function MoveCards({
  moves,
  onChange,
  notify,
  askRemoveMove,
}: {
  moves: Move[];
  onChange: (moves: Move[]) => void;
  notify: (m: string) => void;
  askRemoveMove: (moveId: string) => void;
}) {
  const setMove = (id: string, patch: Partial<Move>) => onChange(moves.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <>
      {moves.map((m, i) => (
        <div className="move-card" key={m.id}>
          <div className="move-head">
            <span className="move-num" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <TextInput
              value={m.name}
              aria-label={t('moveN', { n: i + 1 })}
              placeholder={t('moveNamePh')}
              onChange={(name) => setMove(m.id, { name })}
            />
            <button
              type="button"
              className="icon-btn danger"
              aria-label={t('removeMoveN', { n: i + 1 })}
              onClick={() =>
                m.name.trim() || m.notes.trim() || m.clip
                  ? askRemoveMove(m.id)
                  : onChange(moves.filter((x) => x.id !== m.id))
              }
            >
              <X size={16} />
            </button>
          </div>
          <TextArea value={m.notes} rows={2} placeholder={t('moveNotesPh')} onChange={(notes) => setMove(m.id, { notes })} />
          <ClipField clip={m.clip} notify={notify} onChange={(clip) => setMove(m.id, { clip })} />
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-secondary" onClick={() => onChange([...moves, move()])}>
          <Plus size={15} /> {t('addMove')}
        </button>
      </div>
    </>
  );
}

function RollingFields({ block, set, reveal }: Props<'freeRoll'>) {
  const has = !!block.notes.trim();
  return (
    <>
      <div className="stepper-row">
        <Stepper label={t('rounds')} value={block.rounds} min={0} max={12} onChange={(rounds) => set({ ...block, rounds })} />
        <Stepper
          label={t('length')}
          value={block.minutes}
          min={1}
          max={15}
          format={(v) => t('minutes', { n: v })}
          onChange={(minutes) => set({ ...block, minutes })}
        />
        <Stepper
          label={t('rest')}
          value={block.restSeconds}
          min={0}
          max={180}
          step={15}
          format={formatRest}
          onChange={(restSeconds) => set({ ...block, restSeconds })}
        />
      </div>
      {reveal.isShown('rollNotes', has) && (
        <div id={reveal.extraId('rollNotes')}>
          <Field label={t('notes')}>
            {(id) => (
              <TextArea id={id} value={block.notes} rows={2} placeholder={t('freeRollNotesPh')} onChange={(notes) => set({ ...block, notes })} />
            )}
          </Field>
        </div>
      )}
      <Extras items={reveal.extra('rollNotes', t('notes'), has)} />
    </>
  );
}

function WrapupFields({ block, set, reveal }: Props<'wrapup'>) {
  const has = !!block.notes.trim();
  return (
    <>
      <MinutesStepper value={block.minutes} onChange={(minutes) => set({ ...block, minutes })} />
      <Field label={t('questionLabel')}>
        {(id) => <TextInput id={id} value={block.question} placeholder={t('questionPh')} onChange={(question) => set({ ...block, question })} />}
      </Field>
      {reveal.isShown('wrapNotes', has) && (
        <div id={reveal.extraId('wrapNotes')}>
          <Field label={t('notes')}>
            {(id) => (
              <TextArea id={id} value={block.notes} rows={2} placeholder={t('wrapupNotesPh')} onChange={(notes) => set({ ...block, notes })} />
            )}
          </Field>
        </div>
      )}
      <Extras items={reveal.extra('wrapNotes', t('notes'), has)} />
    </>
  );
}

export function BlockFields({
  block,
  set,
  reveal,
  notify,
  askRemoveMove,
  earlierGame,
}: {
  block: Block;
  set: (b: Block) => void;
  reveal: Reveal;
  notify: (m: string) => void;
  askRemoveMove: (moveId: string) => void;
  /** The nearest positional sparring block before this one, to copy its position from. */
  earlierGame?: { n: number; game: GameBlock };
}) {
  switch (block.kind) {
    case 'warmup':
      return <WarmupFields block={block} set={set} reveal={reveal} />;
    case 'concept':
      return <ConceptFields block={block} set={set} reveal={reveal} />;
    case 'game':
      return <GameFields block={block} set={set} reveal={reveal} earlier={earlierGame} />;
    case 'gems':
      return <TechniqueFields block={block} set={set} reveal={reveal} notify={notify} askRemoveMove={askRemoveMove} />;
    case 'freeRoll':
      return <RollingFields block={block} set={set} reveal={reveal} />;
    case 'wrapup':
      return <WrapupFields block={block} set={set} reveal={reveal} />;
  }
}
