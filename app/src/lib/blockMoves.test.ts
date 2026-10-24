import { describe, expect, it } from 'vitest';
import { allMoves, blankPlan, copyBlock, move, newBlock, normalizePlan, type ClassPlan } from './plan.ts';
import { classForAi, planFromJson, planToJson } from './aiClass.ts';
import { buildClassFile } from './classFile.ts';

// A warm-up holding a technique with a clip, the way the block menu's Add technique leaves it.
function planWithWarmupTechnique(): ClassPlan {
  const warmup = newBlock('warmup');
  warmup.moves = [{ ...move(), name: 'Technical stand-up', notes: 'Hand behind, hips back', clip: { id: 'clip-1', width: 360, height: 640 } }];
  return { ...blankPlan(), blocks: [warmup, newBlock('gems')] };
}

describe('techniques in any block', () => {
  it('counts their clips with the class, so pruning never deletes them', () => {
    expect(allMoves(planWithWarmupTechnique()).map((m) => m.clip?.id)).toContain('clip-1');
  });

  it('survive a save and reload', () => {
    const back = normalizePlan(JSON.parse(JSON.stringify(planWithWarmupTechnique())))!;
    expect(back.blocks[0].moves?.[0]).toMatchObject({ name: 'Technical stand-up', clip: { id: 'clip-1' } });
  });

  it('get new ids when the block is duplicated', () => {
    const b = planWithWarmupTechnique().blocks[0];
    expect(copyBlock(b).moves?.[0].id).not.toBe(b.moves?.[0].id);
  });

  it('travel through the AI format', () => {
    const json = planToJson(planWithWarmupTechnique()) as { blocks: { moves?: unknown }[] };
    expect(json.blocks[0].moves).toEqual([{ name: 'Technical stand-up', notes: 'Hand behind, hips back', clip: 1 }]);
    const read = planFromJson(json);
    expect('plan' in read && read.plan.blocks[0].moves?.[0].name).toBe('Technical stand-up');
  });

  it('get their clips back when the AI moves them', () => {
    localStorage.clear();
    const plan = planWithWarmupTechnique();
    plan.blocks[1].moves = [{ ...move('Leg drag'), clip: { id: 'clip-2', width: 640, height: 360 } }, move('No clip yet')];
    // The class goes to the AI, which moves the warm-up technique into Technique and renames it.
    const sent = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(classForAi(plan, 'en'))![1]);
    expect(sent.from).toBe(plan.id);
    expect(sent.blocks[1].moves).toEqual([
      { name: 'Leg drag', notes: '', clip: 2 },
      { name: 'No clip yet', notes: '' },
    ]);
    const answer = {
      prancheta: 1,
      from: sent.from,
      title: 'Leg drag',
      blocks: [
        { kind: 'warmup', drills: ['Shrimps'] },
        { kind: 'technique', moves: [{ name: 'Leg drag pass', clip: 2 }, { name: 'Stand-up', notes: '', clip: 1 }, { name: 'Made up', clip: 9 }] },
      ],
    };
    const read = planFromJson(answer);
    if (!('plan' in read)) throw new Error('not read');
    expect(read.plan.blocks[1].moves).toMatchObject([
      { name: 'Leg drag pass', clip: { id: 'clip-2', width: 640 } },
      { name: 'Stand-up', clip: { id: 'clip-1' } },
      { name: 'Made up' },
    ]);
    expect(read.plan.blocks[1].moves?.[2].clip).toBeUndefined();
    // An answer that dropped "from" still gets the class sent last.
    const { from: _, ...lost } = answer;
    const again = planFromJson(lost);
    expect('plan' in again && again.plan.blocks[1].moves?.[0].clip?.id).toBe('clip-2');
  });

  it('leave other blocks without moves when they have none', () => {
    const read = planFromJson({ blocks: [{ kind: 'warmup', drills: ['Shrimps'] }] });
    expect('plan' in read && read.plan.blocks[0].moves).toBeUndefined();
  });

  it('show in the class file', () => {
    expect(buildClassFile(planWithWarmupTechnique())).toContain('Technical stand-up');
  });
});
