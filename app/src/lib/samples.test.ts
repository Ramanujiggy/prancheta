import { templates } from './samples.ts';
import { setLang } from './i18n.ts';
import { firstOf, gameSchedule, totalMinutes } from './plan.ts';

describe('templates', () => {
  afterEach(() => setLang('en'));

  it.each(['en', 'pt'] as const)('each builds a complete class with fresh ids (%s)', (lang) => {
    setLang(lang);
    for (const t of templates()) {
      const a = t.build();
      const b = t.build();
      expect(a.title).toBe(t.title);
      expect(a.id).not.toBe(b.id);
      const game = firstOf(a, 'game')!;
      expect(firstOf(a, 'warmup')!.drills.length).toBeGreaterThan(0);
      expect(firstOf(a, 'concept')!.rule).not.toBe('');
      expect(game.goals.length).toBeGreaterThan(0);
      expect(firstOf(a, 'gems')!.moves.every((m) => m.name)).toBe(true);
      expect(totalMinutes(a)).toBeGreaterThan(30);
      expect(gameSchedule(game)[0].cue).toContain(game.start);
    }
  });

  it('uses unique keys', () => {
    const all = templates();
    expect(new Set(all.map((t) => t.key)).size).toBe(all.length);
  });
});
