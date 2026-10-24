import { describe, expect, it } from 'vitest';
import { freshCopy, readBackup } from './carry.ts';
import { samplePlan } from './plan.ts';

describe('freshCopy', () => {
  it('is fresh with nothing, or only the untouched example', () => {
    expect(freshCopy([])).toBe(true);
    expect(freshCopy([samplePlan()])).toBe(true);
  });

  it('is not fresh once the coach has written a class', () => {
    const edited = { ...samplePlan(), updatedAt: '2099-01-01T00:00:00.000Z' };
    expect(freshCopy([samplePlan(), edited])).toBe(false);
  });
});

describe('readBackup', () => {
  it('reads all copied classes', () => {
    const text = JSON.stringify([samplePlan(), samplePlan()]);
    expect(readBackup(text)).toHaveLength(2);
    expect(readBackup(`\n${text}\n`)).toHaveLength(2);
  });

  it('leaves a single AI class and other text alone', () => {
    expect(readBackup('{"prancheta":1,"title":"x","blocks":[]}')).toBeNull();
    expect(readBackup('hello')).toBeNull();
    expect(readBackup(null)).toBeNull();
  });
});
