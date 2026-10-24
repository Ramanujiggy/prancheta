// The class plan model. Every class is made of the same five kinds of block:
//
//   Warm-up              — movement, ending close to the real thing
//   Concept              — the one rule the class is about
//   Positional sparring  — a game from a position toward a goal, taught as
//                          goals and movements first, details after
//   Technique            — the specific moves, their gems, and their options
//   Rolling              — live rounds
//
// plus an optional Wrap-up. A plan is an ordered list of blocks: the coach
// picks which kinds, how many of each and in what order (fixed vocabulary,
// free arrangement). Internally the kinds keep the keys they had when the
// class was five fixed sections ('game' is positional sparring, 'gems' is
// technique, 'freeRoll' is rolling), so older plans and files map straight on.
//
// Everything here is pure data + pure functions so it can be tested without
// a browser and stored as plain JSON.

import { getLang, t } from './i18n.ts';

export interface ListItem {
  id: string;
  text: string;
}

/** A short looping video of the technique. The video itself lives in IndexedDB (see clips.ts). */
export interface Clip {
  id: string;
  width: number;
  height: number;
}

export interface Move {
  id: string;
  name: string;
  notes: string;
  clip?: Clip;
}

export interface GameRounds {
  /** Rounds played before the players change sides. */
  roundsPerSide: number;
  minutes: number;
  /** Rest between rounds, in seconds. */
  restSeconds: number;
  /** Rotate partners between rounds. */
  switchPartners: boolean;
  /** After the first side's rounds, swap who starts in the position and repeat. */
  switchPositions: boolean;
}

export type BlockKind = 'warmup' | 'concept' | 'game' | 'gems' | 'freeRoll' | 'wrapup';

/** The five kinds every class is made of, in the order the class strip shows them. */
export const CORE_KINDS = ['warmup', 'concept', 'game', 'gems', 'freeRoll'] as const;
/** Every kind a coach can add, in the order the Add block sheet lists them. */
export const BLOCK_KINDS: BlockKind[] = [...CORE_KINDS, 'wrapup'];

interface BlockBase {
  id: string;
  /** The coach's own name for the block ("Takedown game"). Empty means the kind's name. */
  title: string;
  /** Moves with their clips, borrowed from Technique: a warm-up movement, a cool-down stretch.
      Technique blocks always have them; any other block can add some from its menu. */
  moves?: Move[];
}

export interface WarmupBlock extends BlockBase {
  kind: 'warmup';
  minutes: number;
  drills: ListItem[];
}

export interface ConceptBlock extends BlockBase {
  kind: 'concept';
  minutes: number;
  rule: string;
  notes: string;
}

export interface GameBlock extends BlockBase {
  kind: 'game';
  start: string;
  objective: string;
  /** General goals and movements toward the objective — no technique yet. */
  goals: ListItem[];
  /** General guidelines for beating the position, shown after the first rounds. */
  details: ListItem[];
  transition: string;
  submission: string;
  rounds: GameRounds;
}

export interface TechniqueBlock extends BlockBase {
  kind: 'gems';
  minutes: number;
  moves: Move[];
  options: ListItem[];
}

export interface RollingBlock extends BlockBase {
  kind: 'freeRoll';
  rounds: number;
  minutes: number;
  restSeconds: number;
  notes: string;
}

export interface WrapupBlock extends BlockBase {
  kind: 'wrapup';
  minutes: number;
  /** One question back to the class. */
  question: string;
  notes: string;
}

export type Block = WarmupBlock | ConceptBlock | GameBlock | TechniqueBlock | RollingBlock | WrapupBlock;
export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>;

export interface ClassPlan {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  createdAt: string;
  updatedAt: string;
  /** The class in teaching order. Never empty. */
  blocks: Block[];
}

const MOVEMENTS_EN = [
  'Forward rolls',
  'Backward rolls',
  'Shrimps',
  'Forward shrimps',
  'Cartwheels',
  'Technical stand-ups',
  'Bridges',
  'Granby rolls',
  'Sprawls',
  'Bear crawls',
  'Sit-throughs',
  'Hip switches',
  // Partner games last, so the warm-up ends close to the real thing.
  'Pummeling',
  'Grip fighting',
  'Hand fighting',
  'Sumo pushing',
];

const MOVEMENTS_PT = [
  'Rolamento para frente',
  'Rolamento para trás',
  'Fuga de quadril',
  'Fuga de quadril para frente',
  'Estrelinha',
  'Levantada técnica',
  'Ponte',
  'Rolamento granby',
  'Sprawl',
  'Andar de urso',
  'Sit-through',
  'Troca de quadril',
  'Pummeling',
  'Briga de pegada',
  'Briga de mão',
  'Sumô',
];

/** Movement drills to tap into the warm-up, in the app's language. */
export function movementSuggestions(): string[] {
  return getLang() === 'pt' ? MOVEMENTS_PT : MOVEMENTS_EN;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function item(text: string): ListItem {
  return { id: uid(), text };
}

export function move(name = '', notes = ''): Move {
  return { id: uid(), name, notes };
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
/** The class the coach most likely wants to teach: today's, else the next
 *  one coming up, else the most recent. Ties go to the last one edited. */
export function nextClass<P extends { date: string; updatedAt: string }>(plans: P[], today = todayISO()): P | undefined {
  const newestEdit = (a: P, b: P) => b.updatedAt.localeCompare(a.updatedAt);
  const ahead = plans.filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date) || newestEdit(a, b));
  if (ahead.length) return ahead[0];
  return [...plans].sort((a, b) => b.date.localeCompare(a.date) || newestEdit(a, b))[0];
}

/** Past this many classes the library tidies itself. */
export const SHELF_AFTER = 8;
/** How many past classes keep a full card once it does. */
export const RECENT_CARDS = 3;

export interface Shelf<P> {
  /** Today, what's coming, and the last three taught: full cards. */
  cards: P[];
  /** Everything older, filed by month (YYYY-MM), newest month first. */
  months: { month: string; plans: P[] }[];
}

/** Splits the library into cards and month folders once it grows, so a coach
 *  with a year of classes still sees this week's on one screen. */
export function shelveLibrary<P extends { date: string; updatedAt: string }>(plans: P[], today = todayISO()): Shelf<P> {
  const sorted = [...plans].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  if (sorted.length <= SHELF_AFTER) return { cards: sorted, months: [] };
  const ahead = sorted.filter((p) => p.date >= today);
  const past = sorted.filter((p) => p.date < today);
  const months: Shelf<P>['months'] = [];
  for (const p of past.slice(RECENT_CARDS)) {
    const month = p.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.plans.push(p);
    else months.push({ month, plans: [p] });
  }
  return { cards: [...ahead, ...past.slice(0, RECENT_CARDS)], months };
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export function defaultRounds(): GameRounds {
  return { roundsPerSide: 2, minutes: 3, restSeconds: 30, switchPartners: true, switchPositions: true };
}

/** A fresh, empty block of a kind. */
export function newBlock<K extends BlockKind>(kind: K): BlockOf<K>;
export function newBlock(kind: BlockKind): Block {
  const base = { id: uid(), title: '' };
  switch (kind) {
    case 'warmup':
      return { ...base, kind, minutes: 10, drills: [] };
    case 'concept':
      return { ...base, kind, minutes: 5, rule: '', notes: '' };
    case 'game':
      return { ...base, kind, start: '', objective: '', goals: [], details: [], transition: '', submission: '', rounds: defaultRounds() };
    case 'gems':
      return { ...base, kind, minutes: 15, moves: [move(), move()], options: [] };
    case 'freeRoll':
      return { ...base, kind, rounds: 4, minutes: 5, restSeconds: 60, notes: '' };
    case 'wrapup':
      return { ...base, kind, minutes: 3, question: '', notes: '' };
  }
}

/** A copy of a block with fresh ids all the way down. Clips are shared, not copied. */
export function copyBlock(block: Block): Block {
  const reid = <T extends { id: string }>(xs: T[]) => xs.map((x) => ({ ...x, id: uid() }));
  const b = { ...block, id: uid(), ...(block.moves ? { moves: reid(block.moves) } : {}) };
  switch (b.kind) {
    case 'warmup':
      return { ...b, drills: reid(b.drills) };
    case 'game':
      return { ...b, goals: reid(b.goals), details: reid(b.details), rounds: { ...b.rounds } };
    case 'gems':
      return { ...b, moves: reid(b.moves), options: reid(b.options) };
    default:
      return b;
  }
}

export type FormatKey = 'gameFirst' | 'techniqueFirst' | 'openMat' | 'drillingDay' | 'compPrep';

/** Ways to lay out a new class. Game first is the default: play, teach the fix, play again. */
export const FORMATS: Record<FormatKey, BlockKind[]> = {
  gameFirst: ['warmup', 'concept', 'game', 'gems', 'game', 'freeRoll'],
  techniqueFirst: ['warmup', 'concept', 'gems', 'game', 'freeRoll'],
  openMat: ['warmup', 'freeRoll'],
  drillingDay: ['warmup', 'gems', 'gems', 'freeRoll'],
  compPrep: ['warmup', 'game', 'game', 'game', 'freeRoll'],
};
export const FORMAT_ORDER = Object.keys(FORMATS) as FormatKey[];

export function formatBlocks(format: FormatKey): Block[] {
  const blocks = FORMATS[format].map((k) => newBlock(k));
  if (format === 'gameFirst') {
    // The second round of the game checks the fix, so it can be shorter.
    const second = blocks.filter((b): b is GameBlock => b.kind === 'game')[1];
    if (second) second.rounds.roundsPerSide = 1;
  }
  if (format === 'openMat') {
    const roll = blocks.find((b): b is RollingBlock => b.kind === 'freeRoll');
    if (roll) roll.rounds = 8;
  }
  return blocks;
}

/** A blank plan laid out in one of the formats. */
export function blankPlan(now = new Date(), format: FormatKey = 'gameFirst'): ClassPlan {
  const stamp = now.toISOString();
  return { id: uid(), title: '', date: todayISO(now), createdAt: stamp, updatedAt: stamp, blocks: formatBlocks(format) };
}

export function blocksOf<K extends BlockKind>(plan: ClassPlan, kind: K): BlockOf<K>[] {
  return plan.blocks.filter((b): b is BlockOf<K> => b.kind === kind);
}

export function firstOf<K extends BlockKind>(plan: ClassPlan, kind: K): BlockOf<K> | undefined {
  return blocksOf(plan, kind)[0];
}

/** Every move in the class, in order: Technique's and the ones other blocks hold. */
export function allMoves(plan: ClassPlan): Move[] {
  return plan.blocks.flatMap((b) => b.moves ?? []);
}

/** Replaces one block, matched by id. */
export function withBlock(plan: ClassPlan, block: Block): ClassPlan {
  return { ...plan, blocks: plan.blocks.map((b) => (b.id === block.id ? block : b)) };
}

/** Moves a block from one place in the class to another. */
export function moveBlock(plan: ClassPlan, from: number, to: number): ClassPlan {
  if (from === to || from < 0 || to < 0 || from >= plan.blocks.length || to >= plan.blocks.length) return plan;
  const blocks = [...plan.blocks];
  const [b] = blocks.splice(from, 1);
  blocks.splice(to, 0, b);
  return { ...plan, blocks };
}

// ─── Older plans: the five fixed sections ────────────────────────────────────

/** How a plan was stored before blocks could be added and moved: one of each, in a fixed order. */
export interface LegacySections {
  warmup: { minutes: number; drills: ListItem[] };
  concept: { minutes: number; rule: string; notes: string };
  game: Omit<GameBlock, 'id' | 'title' | 'kind'>;
  gems: { minutes: number; moves: Move[]; options: ListItem[] };
  freeRoll: { rounds: number; minutes: number; restSeconds: number; notes: string };
}
export type LegacyPlan = Omit<ClassPlan, 'blocks'> & LegacySections;

const strip = <B extends Block>(b: B): Omit<B, 'id' | 'title' | 'kind'> => {
  const { id: _id, title: _title, kind: _kind, ...rest } = b;
  return rest;
};

export function legacyBlank(now: Date): LegacyPlan {
  const { blocks: _, ...meta } = blankPlan(now);
  return { ...meta, ...legacySections(blankPlan(now, 'techniqueFirst')) };
}

/** Turns the five fixed sections into blocks, in the order they were always taught. */
export function fromLegacy(p: LegacyPlan): ClassPlan {
  const { warmup, concept, game, gems, freeRoll, ...meta } = p;
  const base = () => ({ id: uid(), title: '' });
  return {
    ...meta,
    blocks: [
      { ...base(), kind: 'warmup', ...warmup },
      { ...base(), kind: 'concept', ...concept },
      { ...base(), kind: 'game', ...game },
      { ...base(), kind: 'gems', ...gems },
      { ...base(), kind: 'freeRoll', ...freeRoll },
    ],
  };
}

/** The first block of each kind in the old fixed shape. Written next to the blocks for a
 *  while, so a copy of the app that hasn't updated yet can still open a class file. */
export function legacySections(plan: ClassPlan): LegacySections {
  const pick = <K extends (typeof CORE_KINDS)[number]>(kind: K) => strip(firstOf(plan, kind) ?? newBlock(kind));
  return { warmup: pick('warmup'), concept: pick('concept'), game: pick('game'), gems: pick('gems'), freeRoll: pick('freeRoll') };
}

/** A plan as it is written to storage and files. */
export function storedPlan(plan: ClassPlan): ClassPlan & LegacySections {
  return { ...plan, ...legacySections(plan) };
}

/** The example class: offensive opportunities from the leg drag. */
export function samplePlan(now = new Date()): ClassPlan {
  return getLang() === 'pt' ? samplePlanPt(now) : samplePlanEn(now);
}

function samplePlanEn(now: Date): ClassPlan {
  const plan = legacyBlank(now);
  return fromLegacy({
    ...plan,
    title: 'Leg drag to the back',
    warmup: {
      minutes: 10,
      drills: ['Forward rolls', 'Backward rolls', 'Shrimps', 'Forward shrimps', 'Cartwheels'].map(item),
    },
    concept: {
      minutes: 5,
      rule: 'Keep the hips pinned and the back opens up.',
      notes: 'The leg drag pins the hips to one side. Every option today comes from keeping them there.',
    },
    game: {
      ...plan.game,
      start: 'Leg drag',
      objective: 'Take the back',
      goals: [
        'Top: keep the hips pinned and move toward the back',
        'Bottom: square up, recover guard or come up on a single',
        'Reset if bottom recovers full guard',
      ].map(item),
      details: [
        'Chest to the far hip, not the near one',
        'Control the far sleeve or wrist before you move',
        'Step the back knee in behind as they turn away',
      ].map(item),
      transition: 'Leg drag → back take as they turn away',
      submission: 'Rear naked choke, or bow and arrow from the gi',
    },
    gems: {
      minutes: 15,
      moves: [
        move('Back take when they turn away', 'Seatbelt first, then the hook. Let them give you the turn.'),
        move('Far side knee cut', 'When they block the turn, cut back across to mount.'),
      ],
      options: ['Near side armbar if the far arm posts', 'Switch to the opposite leg drag'].map(item),
    },
  });
}

function samplePlanPt(now: Date): ClassPlan {
  const plan = legacyBlank(now);
  return fromLegacy({
    ...plan,
    title: 'Leg drag para as costas',
    warmup: {
      minutes: 10,
      drills: ['Rolamento para frente', 'Rolamento para trás', 'Fuga de quadril', 'Fuga de quadril para frente', 'Estrelinha'].map(item),
    },
    concept: {
      minutes: 5,
      rule: 'Prenda o quadril e as costas aparecem.',
      notes: 'O leg drag prende o quadril para um lado. Toda opção de hoje vem de manter ele ali.',
    },
    game: {
      ...plan.game,
      start: 'Leg drag',
      objective: 'Pegar as costas',
      goals: [
        'Por cima: prenda o quadril e vá para as costas',
        'Por baixo: fique de frente, recupere a guarda ou suba numa single leg',
        'Recomeça se quem está por baixo recuperar a guarda fechada',
      ].map(item),
      details: [
        'Peito no quadril de longe, não no de perto',
        'Controle a manga ou o punho de longe antes de se mexer',
        'Encaixe o joelho de trás quando ele virar de costas',
      ].map(item),
      transition: 'Leg drag → pegada de costas quando ele vira',
      submission: 'Mata-leão, ou arco e flecha de kimono',
    },
    gems: {
      minutes: 15,
      moves: [
        move('Pegada de costas quando ele vira', 'Primeiro a pegada de cinto, depois o gancho. Deixe ele te dar o giro.'),
        move('Passagem de joelho do outro lado', 'Quando ele bloqueia o giro, corte de volta para a montada.'),
      ],
      options: ['Chave de braço do lado de perto se ele apoiar o braço de longe', 'Troque para o leg drag do outro lado'].map(item),
    },
  });
}
// ─── Time ────────────────────────────────────────────────────────────────────

export function gameRoundCount(r: GameRounds): number {
  return Math.max(0, r.roundsPerSide) * (r.switchPositions ? 2 : 1);
}

/** Total seconds for a block of rounds with rest between (not after the last). */
function roundsSeconds(rounds: number, minutes: number, restSeconds: number): number {
  if (rounds <= 0) return 0;
  return rounds * minutes * 60 + (rounds - 1) * restSeconds;
}

export function blockMinutes(b: Block): number {
  switch (b.kind) {
    case 'game':
      return roundsSeconds(gameRoundCount(b.rounds), b.rounds.minutes, b.rounds.restSeconds) / 60;
    case 'freeRoll':
      return roundsSeconds(b.rounds, b.minutes, b.restSeconds) / 60;
    default:
      return b.minutes;
  }
}

/** A kind's name in the app's language. */
export function kindLabel(kind: BlockKind): string {
  return t(`sec.${kind}`);
}

/** What a kind of block holds, for the tags that tell blocks apart. */
export type BlockTrait = 'drills' | 'timer' | 'rounds' | 'moves' | 'clips' | 'focus' | 'notes' | 'goals' | 'question' | 'options';

export const KIND_TRAITS: Record<BlockKind, BlockTrait[]> = {
  warmup: ['drills', 'timer'],
  concept: ['focus', 'notes'],
  game: ['goals', 'rounds'],
  gems: ['moves', 'clips', 'options'],
  freeRoll: ['rounds', 'notes'],
  wrapup: ['question', 'notes'],
};

/** What the block is called: the coach's own name, or its kind's. */
export function blockLabel(b: Block): string {
  return b.title.trim() || kindLabel(b.kind);
}

/** Positional sparring and rolling: the minutes against a resisting partner. */
export function isLive(kind: BlockKind): boolean {
  return kind === 'game' || kind === 'freeRoll';
}

export interface TimelineSegment {
  id: string;
  kind: BlockKind;
  label: string;
  minutes: number;
}

export function timeline(plan: ClassPlan): TimelineSegment[] {
  return plan.blocks.map((b) => ({ id: b.id, kind: b.kind, label: blockLabel(b), minutes: blockMinutes(b) }));
}

export function totalMinutes(plan: ClassPlan): number {
  return plan.blocks.reduce((sum, b) => sum + blockMinutes(b), 0);
}

export interface KindShare {
  kind: BlockKind;
  /** How many blocks of this kind the class has. */
  count: number;
  minutes: number;
}

/** What the class is made of: the five kinds always, wrap-up only when used. */
export function composition(plan: ClassPlan): KindShare[] {
  const kinds: BlockKind[] = [...CORE_KINDS, ...(plan.blocks.some((b) => b.kind === 'wrapup') ? (['wrapup'] as const) : [])];
  return kinds.map((kind) => {
    const of = plan.blocks.filter((b) => b.kind === kind);
    return { kind, count: of.length, minutes: of.reduce((s, b) => s + blockMinutes(b), 0) };
  });
}

/** One line for a folded block: what's in it so far, or an invitation when it's empty. */
export function sectionSummary(b: Block): { filled: boolean; text: string } {
  const lines = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  const list = (xs: string[], empty: string) => {
    const kept = lines(xs);
    return { filled: kept.length > 0, text: kept.length ? kept.join(', ') : empty };
  };
  switch (b.kind) {
    case 'warmup':
      return list(b.drills.map((d) => d.text), t('sum.warmup'));
    case 'concept':
      return list([b.rule], t('sum.concept'));
    case 'game': {
      const ends = lines([b.start, b.objective]);
      return { filled: ends.length > 0, text: ends.length ? ends.join(' → ') : t('sum.game') };
    }
    case 'gems':
      return list(b.moves.map((m) => m.name), t('sum.gems'));
    case 'freeRoll':
      return b.rounds > 0
        ? { filled: true, text: t('roundsDescribe', { n: b.rounds, min: b.minutes }) }
        : { filled: false, text: t('sum.noRoll') };
    case 'wrapup':
      return list([b.question], t('sum.wrapup'));
  }
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes * 2) / 2;
  if (rounded < 60) return `${trimZero(rounded)} min`;
  // Past an hour, half minutes are noise: 66.5 reads as "1 h 7 min".
  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole - h * 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function trimZero(n: number): string {
  // Portuguese writes a half minute as 13,5.
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', getLang() === 'pt' ? ',' : '.');
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "2 × 3 min, switch partners, then switch positions" */
export function describeGameRounds(r: GameRounds): string {
  const parts = [t('roundsDescribe', { n: r.roundsPerSide, min: r.minutes })];
  if (r.switchPartners) parts.push(t('switchPartnersLower'));
  if (r.switchPositions) parts.push(t('thenSwitchPositionsLower'));
  return parts.join(', ');
}

// ─── Round schedule (for the mat timer) ──────────────────────────────────────

export interface RoundSegment {
  kind: 'round' | 'rest';
  label: string;
  /** What the coach calls out for this segment. */
  cue: string;
  seconds: number;
}

export function gameSchedule(game: GameBlock): RoundSegment[] {
  const r = game.rounds;
  const sides = r.switchPositions ? 2 : 1;
  const total = gameRoundCount(r);
  const position = game.start || t('thePosition');
  const out: RoundSegment[] = [];
  let n = 0;
  for (let side = 0; side < sides; side++) {
    for (let i = 0; i < r.roundsPerSide; i++) {
      n++;
      const first = i === 0;
      let cue: string;
      if (n === 1) cue = t('cueStartIn', { position });
      else if (first) cue = t('cueSwitchPositions');
      else if (r.switchPartners) cue = t('cueSwitchPartners');
      else cue = t('cueSameAgain');
      out.push({
        kind: 'round',
        label: t('roundNofM', { n, total }),
        cue: sides === 2 ? t('cueSide', { cue, side: side === 0 ? 'A' : 'B' }) : cue,
        seconds: r.minutes * 60,
      });
      if (n < total && r.restSeconds > 0) {
        const nextSwitchesSide = i === r.roundsPerSide - 1;
        out.push({
          kind: 'rest',
          label: t('rest'),
          cue: nextSwitchesSide ? t('nextSwitchPositions') : r.switchPartners ? t('nextSwitchPartners') : t('nextRound'),
          seconds: r.restSeconds,
        });
      }
    }
  }
  return out;
}

export function freeRollSchedule(f: RollingBlock): RoundSegment[] {
  const out: RoundSegment[] = [];
  for (let i = 1; i <= f.rounds; i++) {
    out.push({
      kind: 'round',
      label: t('rollNofM', { n: i, total: f.rounds }),
      cue: i === 1 ? t('cueSlapRoll') : t('cueNewPartner'),
      seconds: f.minutes * 60,
    });
    if (i < f.rounds && f.restSeconds > 0) {
      out.push({ kind: 'rest', label: t('rest'), cue: t('cueFindPartner'), seconds: f.restSeconds });
    }
  }
  return out;
}

/** The mat timer for a block, or null for the blocks that are talked through rather than timed. */
export function blockSchedule(b: Block): RoundSegment[] | null {
  switch (b.kind) {
    case 'warmup':
      return b.minutes > 0 ? [{ kind: 'round', label: kindLabel('warmup'), cue: t('cueKeepMoving'), seconds: b.minutes * 60 }] : [];
    case 'game':
      return gameSchedule(b);
    case 'freeRoll':
      return freeRollSchedule(b);
    default:
      return null;
  }
}

// ─── Normalisation (for imports and older saved data) ────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const list = (v: unknown, d: ListItem[]): ListItem[] =>
  Array.isArray(v)
    ? v
        .filter((x) => x && typeof x === 'object' && typeof (x as ListItem).text === 'string')
        .map((x) => ({ id: str((x as ListItem).id, '') || uid(), text: (x as ListItem).text }))
    : d;
const clip = (v: unknown): Clip | undefined => {
  const c = obj(v);
  return typeof c.id === 'string' && c.id ? { id: c.id, width: num(c.width, 400), height: num(c.height, 300) } : undefined;
};
const moves = (v: unknown, d: Move[]): Move[] =>
  Array.isArray(v)
    ? v
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const m = x as Obj;
          const c = clip(m.clip);
          return { id: str(m.id, '') || uid(), name: str(m.name, ''), notes: str(m.notes, ''), ...(c ? { clip: c } : {}) };
        })
    : d;

/** Rebuilds one block's fields from untrusted JSON, over a fresh block of that kind. */
function normalizeFields<K extends BlockKind>(kind: K, r: Obj, base: Block = newBlock(kind)): Block {
  switch (base.kind) {
    case 'warmup':
      return { ...base, minutes: num(r.minutes, base.minutes), drills: list(r.drills, base.drills) };
    case 'concept':
      return { ...base, minutes: num(r.minutes, base.minutes), rule: str(r.rule, base.rule), notes: str(r.notes, base.notes) };
    case 'game': {
      const gr = obj(r.rounds);
      return {
        ...base,
        start: str(r.start, base.start),
        objective: str(r.objective, base.objective),
        goals: list(r.goals, base.goals),
        details: list(r.details, base.details),
        transition: str(r.transition, base.transition),
        submission: str(r.submission, base.submission),
        rounds: {
          roundsPerSide: num(gr.roundsPerSide, base.rounds.roundsPerSide),
          minutes: num(gr.minutes, base.rounds.minutes),
          restSeconds: num(gr.restSeconds, base.rounds.restSeconds),
          switchPartners: bool(gr.switchPartners, base.rounds.switchPartners),
          switchPositions: bool(gr.switchPositions, base.rounds.switchPositions),
        },
      };
    }
    case 'gems':
      return { ...base, minutes: num(r.minutes, base.minutes), moves: moves(r.moves, base.moves), options: list(r.options, base.options) };
    case 'freeRoll':
      return {
        ...base,
        rounds: num(r.rounds, base.rounds),
        minutes: num(r.minutes, base.minutes),
        restSeconds: num(r.restSeconds, base.restSeconds),
        notes: str(r.notes, base.notes),
      };
    case 'wrapup':
      return { ...base, minutes: num(r.minutes, base.minutes), question: str(r.question, base.question), notes: str(r.notes, base.notes) };
  }
}

function normalizeBlock(raw: unknown): Block | null {
  const r = obj(raw);
  const kind = r.kind as BlockKind;
  if (!BLOCK_KINDS.includes(kind)) return null;
  const b = normalizeFields(kind, r);
  const out = { ...b, id: str(r.id, '') || b.id, title: str(r.title, '') };
  if (kind === 'gems') return out;
  const extra = moves(r.moves, []);
  return extra.length ? { ...out, moves: extra } : out;
}

/** Rebuilds a plan from untrusted JSON: every field takes the stored value only
 *  when it has the right type, otherwise a blank block's, so a damaged or
 *  hand-edited backup can never crash the screens that draw it. A plan saved
 *  before blocks could be moved (five fixed sections) comes back as those five
 *  blocks in their old order. */
export function normalizePlan(raw: unknown): ClassPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Obj;
  const base = blankPlan();
  const date = str(r.date, '');
  const meta = {
    id: str(r.id, '') || base.id,
    title: str(r.title, base.title),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : base.date,
    createdAt: str(r.createdAt, base.createdAt),
    updatedAt: str(r.updatedAt, base.updatedAt),
  };
  const blocks = Array.isArray(r.blocks) ? r.blocks.map(normalizeBlock).filter((b): b is Block => b !== null) : [];
  if (blocks.length) return { ...meta, blocks };
  // The five fixed sections. Missing ones come back blank, as they always did.
  return {
    ...meta,
    blocks: CORE_KINDS.map((kind) => normalizeFields(kind, obj(r[kind]))),
  };
}

export function duplicatePlan(plan: ClassPlan, now = new Date()): ClassPlan {
  const stamp = now.toISOString();
  return {
    ...plan,
    id: uid(),
    title: plan.title ? t('copyOf', { title: plan.title }) : '',
    createdAt: stamp,
    updatedAt: stamp,
    blocks: plan.blocks.map(copyBlock),
  };
}
