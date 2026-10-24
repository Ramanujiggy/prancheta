import { describe, expect, it } from 'vitest';
import { classForAi, classFormat, extractJson, planToJson, kindFrom, planFromJson, readAiReply } from './aiClass.ts';
import { blocksOf, samplePlan, storedPlan, type ClassPlan } from './plan.ts';

const ok = (r: ReturnType<typeof readAiReply>): { plan: ClassPlan; skipped: number } => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('reading an AI reply', () => {
  it('takes the JSON out of a fenced block with chat around it', () => {
    const reply = 'Sure! Here is your class:\n\n```json\n{"title":"Half guard","blocks":[{"kind":"warmup","drills":["Shrimps"]}]}\n```\n\nWant changes?';
    const { plan } = ok(readAiReply(reply));
    expect(plan.title).toBe('Half guard');
    expect(blocksOf(plan, 'warmup')[0].drills.map((d) => d.text)).toEqual(['Shrimps']);
  });

  it('reads JSON with no fence, curly quotes, comments and trailing commas', () => {
    const reply = `Here you go {
      // the class
      “title”: “Open mat”,
      "blocks": [ { "kind": "rolling", "rounds": 6, }, ],
    } enjoy`;
    const { plan } = ok(readAiReply(reply));
    expect(plan.title).toBe('Open mat');
    expect(blocksOf(plan, 'freeRoll')[0].rounds).toBe(6);
  });

  it('says when the reply was cut off, has no JSON, or is empty', () => {
    expect(readAiReply('```json\n{"title":"x","blocks":[{"kind":"warmup"')).toEqual({ error: 'cutOff' });
    expect(readAiReply('I can help with that! What position?')).toEqual({ error: 'noJson' });
    expect(readAiReply('   ')).toEqual({ error: 'empty' });
    expect(readAiReply('{"title":"x"}')).toEqual({ error: 'noBlocks' });
    expect(readAiReply('{"blocks":[{"kind":"yoga"}]}')).toEqual({ error: 'noBlocks' });
  });

  it('skips braces inside strings when finding the object', () => {
    const r = extractJson('{"title":"Use {frames}","blocks":[]} trailing }');
    expect(r).toEqual({ value: { title: 'Use {frames}', blocks: [] } });
  });
});

describe('class JSON in the AI format', () => {
  it('maps every kind and field onto the plan', () => {
    const { plan, skipped } = ok(
      readAiReply(
        JSON.stringify({
          prancheta: 1,
          title: 'Leg drag',
          date: '2026-11-02',
          blocks: [
            { kind: 'warmup', minutes: '8 min', drills: '- Rolls\n- Shrimps' },
            { kind: 'concept', rule: 'Pin the hips', notes: ['One', 'Two'] },
            {
              kind: 'positionalSparring',
              title: 'Leg drag game',
              start: 'Leg drag',
              objective: 'Back',
              goals: ['Pin'],
              details: [{ text: 'Far hip' }],
              rounds: { roundsPerSide: '3', minutes: 2, restSeconds: 20, switchPartners: 'no', switchPositions: false },
            },
            { kind: 'technique', moves: [{ name: 'Back take', notes: 'Seatbelt', gems: ['Hook last'] }, 'Knee cut'], options: ['Armbar'] },
            { kind: 'rolling', rounds: 5, minutes: 6, restSeconds: 45 },
            { kind: 'wrapup', question: 'What opened the back?' },
            { kind: 'meditation', minutes: 5 },
          ],
        }),
      ),
    );
    expect(skipped).toBe(1);
    expect(plan.date).toBe('2026-11-02');
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll', 'wrapup']);
    const [warmup, concept, game, gems, roll, wrap] = plan.blocks;
    expect(warmup).toMatchObject({ minutes: 8 });
    expect(warmup.kind === 'warmup' && warmup.drills.map((d) => d.text)).toEqual(['Rolls', 'Shrimps']);
    expect(concept).toMatchObject({ rule: 'Pin the hips', notes: 'One\nTwo' });
    expect(game).toMatchObject({
      title: 'Leg drag game',
      start: 'Leg drag',
      rounds: { roundsPerSide: 3, minutes: 2, restSeconds: 20, switchPartners: false, switchPositions: false },
    });
    expect(game.kind === 'game' && game.details[0].text).toBe('Far hip');
    expect(gems.kind === 'gems' && gems.moves.map((m) => [m.name, m.notes])).toEqual([
      ['Back take', 'Seatbelt\nHook last'],
      ['Knee cut', ''],
    ]);
    expect(roll).toMatchObject({ rounds: 5, minutes: 6, restSeconds: 45 });
    expect(wrap).toMatchObject({ question: 'What opened the back?' });
  });

  it('understands kinds in other words, Portuguese included', () => {
    expect(kindFrom('Positional Sparring')).toBe('game');
    expect(kindFrom('específico')).toBe('game');
    expect(kindFrom('Técnica')).toBe('gems');
    expect(kindFrom('Rola livre')).toBe('freeRoll');
    expect(kindFrom('warm-up')).toBe('warmup');
    expect(kindFrom('freeRoll')).toBe('freeRoll');
    expect(kindFrom('yoga')).toBeNull();
  });

  it('fills what the AI left out with the blank block defaults', () => {
    const { plan } = ok(readAiReply('{"blocks":[{"kind":"positionalSparring","start":"Mount"},{"kind":"technique"}]}'));
    const [game, gems] = plan.blocks;
    expect(game).toMatchObject({ start: 'Mount', objective: '', rounds: { roundsPerSide: 2, minutes: 3 } });
    expect(gems.kind === 'gems' && gems.moves).toHaveLength(2);
  });

  it('reads a flat game: minutes count as a round only next to a round count', () => {
    const flat = ok(readAiReply('{"blocks":[{"kind":"game","rounds":4,"minutes":2,"rest":15}]}')).plan.blocks[0];
    expect(flat).toMatchObject({ rounds: { roundsPerSide: 4, minutes: 2, restSeconds: 15 } });
    const whole = ok(readAiReply('{"blocks":[{"kind":"game","minutes":12}]}')).plan.blocks[0];
    expect(whole).toMatchObject({ rounds: { roundsPerSide: 2, minutes: 3 } });
  });

  it('always makes a new class, never one that would replace a plan here', () => {
    const sample = samplePlan();
    const { plan } = ok(planFromJson(storedPlan(sample)));
    expect(plan.id).not.toBe(sample.id);
    expect(plan.blocks.map((b) => b.kind)).toEqual(sample.blocks.map((b) => b.kind));
    expect(plan.title).toBe(sample.title);
  });

  it('accepts the class wrapped in another object', () => {
    expect(ok(readAiReply('{"class":{"title":"X","blocks":[{"kind":"concept","rule":"R"}]}}')).plan.title).toBe('X');
  });
});

describe('the class format', () => {
  it("keeps a coach's pasted notes as written instead of adding to them", () => {
    expect(classFormat('en')).toContain('keep them as I wrote them');
    expect(classFormat('pt')).toContain('mantenha do jeito que eu escrevi');
  });

  it('asks the AI to check with the coach before guessing at what matters', () => {
    expect(classFormat('en')).toContain('ask me first');
    expect(classFormat('pt')).toContain('me pergunte antes');
  });

  it('asks for a file first, with a code block when the chat cannot make files', () => {
    expect(classFormat('en')).toContain('prancheta-class.json');
    expect(classFormat('pt')).toContain('prancheta-aula.json');
  });

  it('reads back as the usual class when pasted in unfilled', () => {
    for (const lang of ['en', 'pt'] as const) {
      const { plan } = ok(readAiReply(classFormat(lang)));
      expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'concept', 'game', 'gems', 'game', 'freeRoll']);
    }
  });

  it('comes back filled in from a chat reply', () => {
    const filled = classFormat('en')
      .replace('"title": ""', '"title": "Half guard sweeps"')
      .replace('"rule": ""', '"rule": "Underhook before you move"');
    const { plan } = ok(readAiReply(`Here's the plan:\n${filled.slice(filled.indexOf('```json'))}\nWant changes?`));
    expect(plan.title).toBe('Half guard sweeps');
    expect(blocksOf(plan, 'concept')[0].rule).toBe('Underhook before you move');
  });
});

describe('a saved class back to the AI', () => {
  it('round-trips through the AI format as a new class with the same content', () => {
    const sample = samplePlan();
    for (const lang of ['en', 'pt'] as const) {
      const { plan } = ok(readAiReply(classForAi(sample, lang)));
      expect(plan.id).not.toBe(sample.id);
      expect(plan.title).toBe(sample.title);
      expect(plan.blocks.map((b) => b.kind)).toEqual(sample.blocks.map((b) => b.kind));
      expect(blocksOf(plan, 'gems')[0].moves.map((m) => m.name)).toEqual(blocksOf(sample, 'gems')[0].moves.map((m) => m.name));
      expect(blocksOf(plan, 'game')[0].goals.map((g) => g.text)).toEqual(blocksOf(sample, 'game')[0].goals.map((g) => g.text));
    }
  });

  it('sends plain words, not ids or clips', () => {
    const sample = samplePlan();
    const gems = blocksOf(sample, 'gems')[0];
    gems.moves[0] = { ...gems.moves[0], clip: { id: 'clip1', width: 640, height: 360 } };
    const json = JSON.stringify(planToJson(sample));
    expect(json).not.toContain('"id"');
    expect(json).not.toContain('clip1');
    expect(json).toContain('"positionalSparring"');
    expect(classForAi(sample, 'en')).toContain('Change only what I ask');
    expect(classForAi(sample, 'pt')).toContain('Mude só o que eu pedir');
  });
});
