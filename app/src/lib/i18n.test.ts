import { DICTS, setLang, t, type Key } from './i18n.ts';
import { describeGameRounds, gameSchedule, samplePlan, firstOf } from './plan.ts';
import { fileSlug } from './files.ts';
import { buildClassFile } from './classFile.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('languages', () => {
  afterEach(() => setLang('en'));

  it('gives every Portuguese line the same placeholders as the English one', () => {
    for (const key of Object.keys(DICTS.en) as Key[]) {
      expect(DICTS.pt[key], key).not.toBe('');
      expect(placeholders(DICTS.pt[key]), key).toEqual(placeholders(DICTS.en[key]));
    }
  });

  it('speaks Portuguese in the round cues once switched', () => {
    setLang('pt');
    const plan = samplePlan();
    expect(plan.title).toBe('Leg drag para as costas');
    expect(describeGameRounds(firstOf(plan, 'game')!.rounds)).toBe('2 × 3 min, troca de parceiro, depois troca de posição');
    expect(gameSchedule(firstOf(plan, 'game')!)[0]).toMatchObject({ label: 'Round 1 de 4', cue: 'Começa em Leg drag · Lado A' });
    expect(t('moveNamed', { n: 2, name: 'Upa' })).toBe('Técnica 2: Upa');
  });

  it('writes the class file in the language the app is in', () => {
    setLang('pt');
    const html = buildClassFile(samplePlan());
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('Técnica');
    expect(html).toContain('Feito com a Prancheta');
  });

  it('keeps accents out of file names', () => {
    expect(fileSlug('Saídas da montada')).toBe('saidas-da-montada');
  });
});
