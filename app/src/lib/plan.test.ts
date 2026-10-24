import {
  blankPlan,
  blockMinutes,
  composition,
  copyBlock,
  describeGameRounds,
  duplicatePlan,
  firstOf,
  formatBlocks,
  FORMAT_ORDER,
  formatClock,
  formatMinutes,
  nextClass,
  shelveLibrary,
  SHELF_AFTER,
  freeRollSchedule,
  gameRoundCount,
  gameSchedule,
  moveBlock,
  newBlock,
  normalizePlan,
  samplePlan,
  sectionSummary,
  storedPlan,
  totalMinutes,
} from './plan.ts';
import { parseHash, hrefFor } from './router.ts';

const NOW = new Date('2026-10-20T10:00:00Z');
const kinds = (p: { blocks: { kind: string }[] }) => p.blocks.map((b) => b.kind);

describe('class plan', () => {
  it('starts game first: spar, teach the fix, spar again, roll', () => {
    const p = blankPlan(NOW);
    expect(p.date).toBe('2026-10-20');
    expect(kinds(p)).toEqual(['warmup', 'concept', 'game', 'gems', 'game', 'freeRoll']);
    expect(firstOf(p, 'gems')!.moves).toHaveLength(2);
    expect(firstOf(p, 'game')!.rounds).toMatchObject({ roundsPerSide: 2, minutes: 3, switchPartners: true, switchPositions: true });
    // The second game checks the fix, so it is shorter.
    expect(p.blocks[4]).toMatchObject({ kind: 'game', rounds: { roundsPerSide: 1 } });
  });

  it('lays out every format, and each block has its own id', () => {
    expect(kinds(blankPlan(NOW, 'techniqueFirst'))).toEqual(['warmup', 'concept', 'gems', 'game', 'freeRoll']);
    expect(kinds(blankPlan(NOW, 'openMat'))).toEqual(['warmup', 'freeRoll']);
    expect(kinds(blankPlan(NOW, 'drillingDay'))).toEqual(['warmup', 'gems', 'gems', 'freeRoll']);
    expect(kinds(blankPlan(NOW, 'compPrep'))).toEqual(['warmup', 'game', 'game', 'game', 'freeRoll']);
    for (const f of FORMAT_ORDER) {
      const ids = formatBlocks(f).map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('carries the leg drag example', () => {
    const p = samplePlan(NOW);
    expect(kinds(p)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll']);
    expect(firstOf(p, 'warmup')!.drills.map((d) => d.text)).toEqual([
      'Forward rolls',
      'Backward rolls',
      'Shrimps',
      'Forward shrimps',
      'Cartwheels',
    ]);
    expect(firstOf(p, 'game')!.start).toBe('Leg drag');
    expect(firstOf(p, 'game')!.objective).toBe('Take the back');
  });

  it('describes 2 × 3 min, switch partners, then switch positions', () => {
    const r = newBlock('game').rounds;
    expect(describeGameRounds(r)).toBe('2 × 3 min, switch partners, then switch positions');
    expect(gameRoundCount(r)).toBe(4);
    expect(gameRoundCount({ ...r, switchPositions: false })).toBe(2);
  });

  it('adds up the class length including rest between rounds', () => {
    const p = samplePlan(NOW);
    // warm-up 10 + concept 5 + game (4×3 min + 3×30 s = 13.5) + gems 15 + free roll (4×5 + 3×1 = 23)
    expect(totalMinutes(p)).toBeCloseTo(66.5);
    expect(formatMinutes(66.5)).toBe('1 h 7 min');
    expect(formatMinutes(83)).toBe('1 h 23 min');
    expect(formatMinutes(6.5)).toBe('6.5 min');
    expect(formatMinutes(45)).toBe('45 min');
    // The game-first blank adds a second, shorter game: 2×3 min + 30 s.
    expect(totalMinutes(blankPlan(NOW))).toBeCloseTo(66.5 + 6.5);
  });

  it('says what the class is made of, kind by kind', () => {
    const p = blankPlan(NOW, 'compPrep');
    const c = composition(p);
    expect(c.map((x) => x.kind)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll']);
    expect(c.find((x) => x.kind === 'game')).toMatchObject({ count: 3, minutes: 3 * 13.5 });
    expect(c.find((x) => x.kind === 'concept')).toMatchObject({ count: 0, minutes: 0 });
    const withWrap = { ...p, blocks: [...p.blocks, newBlock('wrapup')] };
    expect(composition(withWrap).at(-1)).toMatchObject({ kind: 'wrapup', count: 1, minutes: 3 });
  });
});

describe('next class', () => {
  const p = (id: string, date: string, updatedAt = '2026-01-01') => ({ id, date, updatedAt });
  it("picks today's class, then the next one coming, then the latest", () => {
    expect(nextClass([p('a', '2026-10-20'), p('b', '2026-10-23'), p('c', '2026-10-25')], '2026-10-23')?.id).toBe('b');
    expect(nextClass([p('a', '2026-10-20'), p('c', '2026-10-27'), p('d', '2026-10-25')], '2026-10-23')?.id).toBe('d');
    expect(nextClass([p('a', '2026-10-20'), p('b', '2026-10-22')], '2026-10-23')?.id).toBe('b');
    expect(nextClass([p('a', '2026-10-23', '2026-10-01'), p('b', '2026-10-23', '2026-10-02')], '2026-10-23')?.id).toBe('b');
    expect(nextClass([], '2026-10-23')).toBeUndefined();
  });
});

describe('arranging blocks', () => {
  it('moves a block to a new place and leaves the rest in order', () => {
    const p = blankPlan(NOW, 'techniqueFirst');
    const m = moveBlock(p, 2, 3);
    expect(kinds(m)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll']);
    expect(moveBlock(p, 0, 9)).toBe(p);
  });

  it('copies a block with fresh ids but shares its clips', () => {
    const g = newBlock('gems');
    g.moves[0] = { ...g.moves[0], name: 'Knee cut', clip: { id: 'c1', width: 1, height: 1 } };
    const c = copyBlock(g);
    expect(c.id).not.toBe(g.id);
    expect(c.kind).toBe('gems');
    if (c.kind !== 'gems') return;
    expect(c.moves[0].id).not.toBe(g.moves[0].id);
    expect(c.moves[0]).toMatchObject({ name: 'Knee cut', clip: { id: 'c1' } });
  });

  it('times each kind of block', () => {
    expect(blockMinutes(newBlock('warmup'))).toBe(10);
    expect(blockMinutes(newBlock('freeRoll'))).toBe(23);
    expect(blockMinutes({ ...newBlock('freeRoll'), rounds: 0 })).toBe(0);
  });
});

describe('round schedule', () => {
  it('switches partners between rounds and positions between sides', () => {
    const s = gameSchedule({ ...newBlock('game'), start: 'Leg drag' });
    const rounds = s.filter((x) => x.kind === 'round');
    expect(rounds.map((r) => r.cue)).toEqual([
      'Start in Leg drag · Side A',
      'Switch partners · Side A',
      'Switch positions · Side B',
      'Switch partners · Side B',
    ]);
    expect(s.filter((x) => x.kind === 'rest')).toHaveLength(3);
    expect(s.at(-1)?.kind).toBe('round');
  });

  it('omits rest segments when rest is zero', () => {
    expect(freeRollSchedule({ ...newBlock('freeRoll'), restSeconds: 0 }).every((x) => x.kind === 'round')).toBe(true);
  });

  it('formats a countdown clock', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(-1)).toBe('0:00');
  });
});

describe('older plans and files', () => {
  // A plan as the app saved it before blocks could be added and moved.
  const legacy = {
    id: 'old-1',
    title: 'Mount escapes',
    date: '2026-09-01',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    warmup: { minutes: 8, drills: [{ id: 'd1', text: 'Bridges' }] },
    concept: { minutes: 4, rule: 'Elbows in first', notes: '' },
    game: {
      start: 'Mount',
      objective: 'Escape',
      goals: [{ id: 'g1', text: 'Bottom: elbow to knee' }],
      details: [],
      transition: '',
      submission: '',
      rounds: { roundsPerSide: 3, minutes: 2, restSeconds: 15, switchPartners: false, switchPositions: true },
    },
    gems: { minutes: 12, moves: [{ id: 'm1', name: 'Upa', notes: 'Trap the arm', clip: { id: 'clip-9', width: 640, height: 360 } }], options: [] },
    freeRoll: { rounds: 3, minutes: 6, restSeconds: 60, notes: 'From mount' },
  };

  it('opens as the same five blocks, in the order they were taught', () => {
    const p = normalizePlan(JSON.parse(JSON.stringify(legacy)))!;
    expect(p).toMatchObject({ id: 'old-1', title: 'Mount escapes', date: '2026-09-01' });
    expect(kinds(p)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll']);
    expect(p.blocks[0]).toMatchObject({ title: '', minutes: 8, drills: [{ id: 'd1', text: 'Bridges' }] });
    expect(p.blocks[1]).toMatchObject({ rule: 'Elbows in first' });
    expect(p.blocks[2]).toMatchObject({ start: 'Mount', rounds: { roundsPerSide: 3, switchPartners: false } });
    expect(p.blocks[3]).toMatchObject({ moves: [{ name: 'Upa', clip: { id: 'clip-9' } }] });
    expect(p.blocks[4]).toMatchObject({ rounds: 3, minutes: 6, notes: 'From mount' });
    expect(p).not.toHaveProperty('warmup');
  });

  it('fills missing fields so partial JSON still renders', () => {
    const p = normalizePlan({ id: 'abc', title: 'Old', game: { start: 'Mount' } });
    expect(p?.id).toBe('abc');
    expect(firstOf(p!, 'game')?.start).toBe('Mount');
    expect(firstOf(p!, 'game')?.rounds.minutes).toBe(3);
    expect(firstOf(p!, 'warmup')?.drills).toEqual([]);
    expect(normalizePlan('nope')).toBeNull();
  });

  it('saves the first block of each kind in the old shape too, for apps not yet updated', () => {
    const p = blankPlan(NOW, 'openMat');
    const roll = firstOf(p, 'freeRoll')!;
    roll.notes = 'Start standing';
    const s = JSON.parse(JSON.stringify(storedPlan(p)));
    expect(s.freeRoll).toMatchObject({ rounds: 8, notes: 'Start standing' });
    expect(s.freeRoll).not.toHaveProperty('kind');
    expect(s.concept).toMatchObject({ rule: '' });
    // And the new app reads the blocks, not the copy.
    expect(normalizePlan(s)).toEqual(p);
  });

  it('keeps a rearranged class exactly, names and all', () => {
    const p = blankPlan(NOW, 'compPrep');
    p.blocks[1].title = 'Takedown game';
    p.blocks.push(newBlock('wrapup'));
    const back = normalizePlan(JSON.parse(JSON.stringify(storedPlan(moveBlock(p, 5, 0)))))!;
    expect(kinds(back)).toEqual(['wrapup', 'warmup', 'game', 'game', 'game', 'freeRoll']);
    expect(back.blocks[2].title).toBe('Takedown game');
  });

  it('drops blocks of a kind it does not know, but keeps the rest', () => {
    const p = normalizePlan({ id: 'x', blocks: [{ kind: 'yoga', minutes: 5 }, { kind: 'concept', rule: 'Hips first' }] })!;
    expect(kinds(p)).toEqual(['concept']);
    expect(p.blocks[0]).toMatchObject({ rule: 'Hips first', minutes: 5, title: '' });
  });

  it('duplicates with fresh ids', () => {
    const p = samplePlan(NOW);
    const d = duplicatePlan(p, NOW);
    expect(d.id).not.toBe(p.id);
    expect(d.title).toBe('Leg drag to the back (copy)');
    const [a, b] = [firstOf(p, 'warmup')!, firstOf(d, 'warmup')!];
    expect(b.id).not.toBe(a.id);
    expect(b.drills[0].id).not.toBe(a.drills[0].id);
    expect(b.drills[0].text).toBe(a.drills[0].text);
  });
});

describe('router', () => {
  it('round-trips routes through the hash', () => {
    for (const r of [{ name: 'library' }, { name: 'edit', id: 'x1' }, { name: 'run', id: 'x1' }] as const) {
      expect(parseHash(hrefFor(r))).toEqual(r);
    }
    expect(parseHash('#/garbage')).toEqual({ name: 'library' });
  });
});

describe('folded block summaries', () => {
  it('invites the coach in when a block is empty', () => {
    expect(sectionSummary(newBlock('warmup'))).toEqual({ filled: false, text: 'Pick a few drills' });
    expect(sectionSummary(newBlock('game')).filled).toBe(false);
    expect(sectionSummary(newBlock('wrapup'))).toEqual({ filled: false, text: 'Ask one question to close' });
  });

  it('shows what is planned once there is something', () => {
    const p = samplePlan(NOW);
    expect(sectionSummary(firstOf(p, 'warmup')!).text.startsWith('Forward rolls, Backward rolls')).toBe(true);
    expect(sectionSummary({ ...firstOf(p, 'game')!, start: 'Leg drag', objective: ' ' })).toEqual({ filled: true, text: 'Leg drag' });
    expect(sectionSummary({ ...firstOf(p, 'freeRoll')!, rounds: 0 }).filled).toBe(false);
  });
});

describe('library shelf', () => {
  const at = (date: string, i = 0) => ({ id: `${date}-${i}`, date, updatedAt: `2026-10-0${i}T00:00:00Z` });

  it('leaves a small library alone', () => {
    const plans = Array.from({ length: SHELF_AFTER }, (_, i) => at(`2026-0${(i % 9) + 1}-10`));
    const shelf = shelveLibrary(plans, '2026-10-20');
    expect(shelf.months).toEqual([]);
    expect(shelf.cards).toHaveLength(SHELF_AFTER);
  });

  it('keeps what is coming plus the last three taught, and files the rest by month', () => {
    const plans = [
      at('2026-10-22'),
      at('2026-10-20'),
      at('2026-10-18'),
      at('2026-10-15'),
      at('2026-10-13'),
      at('2026-10-11'),
      at('2026-10-08'),
      at('2026-09-29'),
      at('2026-09-03'),
      at('2026-08-14'),
    ];
    const shelf = shelveLibrary(plans, '2026-10-20');
    expect(shelf.cards.map((p) => p.date)).toEqual(['2026-10-22', '2026-10-20', '2026-10-18', '2026-10-15', '2026-10-13']);
    expect(shelf.months.map((m) => [m.month, m.plans.map((p) => p.date)])).toEqual([
      ['2026-10', ['2026-10-11', '2026-10-08']],
      ['2026-09', ['2026-09-29', '2026-09-03']],
      ['2026-08', ['2026-08-14']],
    ]);
  });
});
