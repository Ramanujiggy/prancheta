import { clampClip, fitSize, frameDelay, frameTimes } from './gif.ts';

describe('fitSize', () => {
  it('shrinks landscape and portrait video to the longest side, keeping even sizes', () => {
    expect(fitSize(1920, 1080)).toEqual({ width: 400, height: 226 });
    expect(fitSize(1080, 1920)).toEqual({ width: 226, height: 400 });
  });

  it('never enlarges a small video', () => {
    expect(fitSize(320, 240)).toEqual({ width: 320, height: 240 });
  });
});

describe('frameTimes', () => {
  it('samples ten frames a second across the clip', () => {
    const t = frameTimes(2, 1.5, 10);
    expect(t).toHaveLength(15);
    expect(t[0]).toBe(2);
    expect(t[14]).toBeCloseTo(3.4);
  });

  it('stops at the end of the video', () => {
    const t = frameTimes(9, 4, 10);
    expect(t).toHaveLength(10);
    expect(Math.max(...t)).toBeLessThan(10);
  });
});

describe('clip settings', () => {
  it('slow motion doubles how long each frame shows', () => {
    expect(frameDelay(false)).toBe(100);
    expect(frameDelay(true)).toBe(200);
  });

  it('keeps the clip inside the video and within 1 to 8 seconds', () => {
    expect(clampClip({ start: 28, length: 6, slowMotion: false }, 30)).toEqual({ start: 24, length: 6, slowMotion: false });
    expect(clampClip({ start: 0, length: 20, slowMotion: false }, 30).length).toBe(8);
    expect(clampClip({ start: 0, length: 6, slowMotion: false }, 2.5)).toEqual({ start: 0, length: 2.5, slowMotion: false });
  });
});
