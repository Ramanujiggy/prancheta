import { buildClassFile, looksLikeClassFile, readClassFile } from './classFile.ts';
import { firstOf, samplePlan } from './plan.ts';

const VIDEO = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t';
const POSTER = 'data:image/jpeg;base64,/9j/4AAQ';

function planWithClip() {
  const plan = samplePlan();
  const gems = firstOf(plan, 'gems')!;
  gems.moves[0] = { ...gems.moves[0], clip: { id: 'clip-1', width: 640, height: 360 } };
  return plan;
}

describe('class file', () => {
  it('plays each clip in place, looping and silent, with its still frame', () => {
    const html = buildClassFile(planWithClip(), { 'clip-1': VIDEO, 'clip-1.poster': POSTER });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const video = doc.querySelector('video[data-clip="clip-1"]')!;
    expect(video.getAttribute('src')).toBe(VIDEO);
    expect(video.getAttribute('poster')).toBe(POSTER);
    for (const a of ['autoplay', 'loop', 'muted', 'playsinline']) expect(video.hasAttribute(a)).toBe(true);
    expect(doc.querySelector('h1')?.textContent).toBe(planWithClip().title);
  });

  it('imports back into the same plan with its clip and still frame', () => {
    const plan = planWithClip();
    const html = buildClassFile(plan, { 'clip-1': VIDEO, 'clip-1.poster': POSTER });
    expect(looksLikeClassFile(html)).toBe(true);
    const back = readClassFile(html)!;
    expect(back.clipData).toEqual({ 'clip-1': VIDEO, 'clip-1.poster': POSTER });
    const { clipData: _, ...restored } = back;
    expect(restored).toEqual(plan);
  });

  it('keeps GIF clips as images', () => {
    const html = buildClassFile(planWithClip(), { 'clip-1': 'data:image/gif;base64,R0lGODlh' });
    expect(readClassFile(html)?.clipData).toEqual({ 'clip-1': 'data:image/gif;base64,R0lGODlh' });
    expect(html).toContain('<img data-clip="clip-1"');
  });

  it('survives text that looks like HTML or a closing script tag', () => {
    const plan = planWithClip();
    plan.title = 'Guard </script><script>alert(1)</script> & "pass"';
    firstOf(plan, 'concept')!.notes = '<b>not bold</b>';
    const html = buildClassFile(plan);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script')).toHaveLength(2);
    expect(doc.querySelector('b')).toBeNull();
    expect(readClassFile(html)?.title).toBe(plan.title);
  });

  it('is not confused with a JSON backup or another web page', () => {
    expect(looksLikeClassFile('[{"id":"x"}]')).toBe(false);
    expect(looksLikeClassFile('<!doctype html><html><body>hi</body></html>')).toBe(false);
    expect(readClassFile('<!doctype html><html><body>hi</body></html>')).toBeNull();
  });
});
