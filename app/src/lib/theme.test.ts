import { describe, expect, it } from 'vitest';
import { resolveTheme, THEMES } from './theme.ts';

describe('theme', () => {
  it('auto follows the phone: light by day, navy at night', () => {
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('auto', true)).toBe('navy');
  });

  it('a picked look ignores the phone', () => {
    for (const th of THEMES.filter((x) => x !== 'auto')) {
      expect(resolveTheme(th, true)).toBe(th);
      expect(resolveTheme(th, false)).toBe(th);
    }
  });
});
