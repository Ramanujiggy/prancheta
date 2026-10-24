import { GIFEncoder } from 'gifenc';
import { Packer } from 'docx';
import { buildClassDocument } from './exportDoc.ts';
import { firstOf, normalizePlan, samplePlan } from './plan.ts';
import { dataUrlToBlob } from './clips.ts';

function tinyGif(): Uint8Array {
  const gif = GIFEncoder();
  const palette = [
    [255, 255, 255],
    [19, 35, 59],
  ];
  gif.writeFrame(new Uint8Array([0, 1, 1, 0]), 2, 2, { palette, delay: 100 });
  gif.writeFrame(new Uint8Array([1, 0, 0, 1]), 2, 2, { delay: 100 });
  gif.finish();
  return gif.bytes();
}

describe('class document export', () => {
  it('embeds each technique clip as a GIF in the .docx', async () => {
    const plan = samplePlan();
    firstOf(plan, 'gems')!.moves[0] = { ...firstOf(plan, 'gems')!.moves[0], clip: { id: 'clip-1', width: 400, height: 226 } };
    const buf = await Packer.toBuffer(buildClassDocument(plan, new Map([['clip-1', { data: tinyGif(), type: 'gif' as const, still: false }]])));
    const zip = buf.toString('latin1');
    expect(zip).toMatch(/word\/media\/[^"]+\.gif/);
    expect(zip).toContain('word/document.xml');
  });

  it('still exports when a clip is missing from storage', async () => {
    const plan = samplePlan();
    firstOf(plan, 'gems')!.moves[0] = { ...firstOf(plan, 'gems')!.moves[0], clip: { id: 'gone', width: 400, height: 226 } };
    const buf = await Packer.toBuffer(buildClassDocument(plan, new Map()));
    expect(buf.toString('latin1')).not.toMatch(/word\/media\//);
  });
});

describe('backups with clips', () => {
  it('keeps clip images out of the plan itself', () => {
    const plan = normalizePlan({ ...samplePlan(), clipData: { a: 'data:image/gif;base64,R0lG' } });
    expect(plan).not.toHaveProperty('clipData');
  });

  it('turns a data URL back into a GIF blob', () => {
    const blob = dataUrlToBlob('data:image/gif;base64,R0lGODlh');
    expect(blob?.type).toBe('image/gif');
    expect(blob?.size).toBe(6);
  });
});

describe('video clips in the document', () => {
  it('places a still frame and says the clip plays in the class file', async () => {
    const plan = samplePlan();
    firstOf(plan, 'gems')!.moves[0] = { ...firstOf(plan, 'gems')!.moves[0], clip: { id: 'clip-1', width: 640, height: 360 } };
    // A 1×1 JPEG.
    const jpeg = Uint8Array.from(
      atob(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      ),
      (c) => c.charCodeAt(0),
    );
    const doc = buildClassDocument(plan, new Map([['clip-1', { data: jpeg, type: 'jpg' as const, still: true }]]));
    const zip = (await Packer.toBuffer(doc)).toString('latin1');
    expect(zip).toMatch(/word\/media\/[^"]+\.jpg/);
  });
});
