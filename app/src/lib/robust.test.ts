import { describe, expect, it, beforeEach } from 'vitest';
import { firstOf, normalizePlan, samplePlan } from './plan.ts';
import { loadPlans, PLANS_KEY, savePlans } from './storage.ts';
import { stepThrough } from '../components/RoundTimer.tsx';

describe('normalizePlan with damaged data', () => {
  it('replaces fields of the wrong type with defaults', () => {
    const p = normalizePlan({
      id: 'x',
      date: null,
      warmup: { drills: 'nope', minutes: 'ten' },
      gems: { moves: [null, { name: 'Knee cut', clip: { id: 'c1' } }, 'bad'], options: [{ text: 1 }] },
      game: { rounds: { minutes: -3, switchPartners: 'yes' } },
    })!;
    const [warmup, gems, game] = [firstOf(p, 'warmup')!, firstOf(p, 'gems')!, firstOf(p, 'game')!];
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(warmup.drills).toEqual([]);
    expect(warmup.minutes).toBe(10);
    expect(gems.moves).toHaveLength(1);
    expect(gems.moves[0]).toMatchObject({ name: 'Knee cut', notes: '', clip: { id: 'c1' } });
    expect(gems.options).toEqual([]);
    expect(game.rounds.minutes).toBe(3);
    expect(game.rounds.switchPartners).toBe(true);
  });

  it('replaces damaged blocks inside a new-style plan', () => {
    const p = normalizePlan({ id: 'y', blocks: [null, 'bad', { kind: 'freeRoll', rounds: 'many', notes: 3 }] })!;
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0]).toMatchObject({ kind: 'freeRoll', rounds: 4, notes: '' });
  });

  it('keeps a good plan exactly', () => {
    const s = samplePlan();
    expect(normalizePlan(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('keeps unreadable data aside instead of losing it', () => {
    localStorage.setItem(PLANS_KEY, '{broken');
    const { plans, damaged } = loadPlans();
    expect(plans).toEqual([]);
    expect(damaged).toBe(true);
    const kept = Object.keys(localStorage).find((k) => k.startsWith(`${PLANS_KEY}.damaged-`));
    expect(kept && localStorage.getItem(kept)).toBe('{broken');
  });

  it('round-trips plans', () => {
    const s = samplePlan();
    expect(savePlans([s])).toBe(true);
    expect(loadPlans().plans).toEqual([s]);
  });
});

describe('stepThrough', () => {
  const segs = [
    { kind: 'round' as const, label: 'R1', cue: '', seconds: 180 },
    { kind: 'rest' as const, label: 'Rest', cue: '', seconds: 30 },
    { kind: 'round' as const, label: 'R2', cue: '', seconds: 180 },
  ];
  it('lands in the right segment after time away', () => {
    expect(stepThrough(segs, 0, 200)).toEqual({ index: 1, remaining: 10, finished: false });
    expect(stepThrough(segs, 0, 250)).toEqual({ index: 2, remaining: 140, finished: false });
  });
  it('finishes when the whole schedule has passed', () => {
    expect(stepThrough(segs, 0, 1000).finished).toBe(true);
  });
});
