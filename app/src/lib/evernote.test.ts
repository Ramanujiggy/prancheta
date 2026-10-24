import { GIFEncoder } from 'gifenc';
import { GifReader } from 'omggif';
import { md5 } from './md5.ts';
import { countNotes, looksLikeEnex, noteLines, noteToPlan, readEnex, sectionKind } from './evernote.ts';
import { frameSeconds } from './gifClip.ts';

const bytes = (s: string) => new TextEncoder().encode(s);

/** A tiny animated GIF, one colour per frame. */
function gif(frames: number, shade = 0): Uint8Array {
  const enc = GIFEncoder();
  for (let i = 0; i < frames; i++) {
    enc.writeFrame(new Uint8Array(4).fill(0), 2, 2, { palette: [[shade, i * 40, 0], [0, 0, 0]], delay: 100 });
  }
  enc.finish();
  return enc.bytes();
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

function resource(b: Uint8Array, mime = 'image/gif') {
  return `<resource><data encoding="base64">\n${b64(b).replace(/(.{60})/g, '$1\n')}\n</data><mime>${mime}</mime><width>2</width><height>2</height></resource>`;
}

function enex(notes: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20261023T120000Z" application="Evernote" version="10.0">
${notes.join('\n')}
</en-export>`;
}

function note(title: string, body: string, resources: string, created = '20240314T190000Z') {
  return `<note><title>${title}</title><created>${created}</created><content><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>${body}</en-note>]]></content>${resources}</note>`;
}

describe('md5', () => {
  it('matches the standard test vectors', () => {
    expect(md5(bytes(''))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5(bytes('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5(bytes('The quick brown fox jumps over the lazy dog'))).toBe('9e107d9d372bb6826bd81d3542a419d6');
    expect(md5(bytes('1234567890'.repeat(8)))).toBe('57edf4a22be3c955ac49da2e2107b67a');
  });
});

describe('noteLines', () => {
  it('reads divs, line breaks, lists and pictures in order', () => {
    const lines = noteLines(
      '<en-note><div>Leg drag to the back</div><div><br/></div><ul><li>Pin the knee</li><li>Hip to hip</li></ul><en-media type="image/gif" hash="ABC"/><div>a &amp; b<br/>c</div><en-media type="image/png" hash="def"/></en-note>',
    );
    expect(lines).toEqual([
      'Leg drag to the back',
      'Pin the knee',
      'Hip to hip',
      { image: true, hash: 'abc' },
      'a & b',
      'c',
      { image: true, hash: 'def' },
    ]);
  });
});

describe('readEnex and noteToPlan', () => {
  const g1 = gif(3, 10);
  const g2 = gif(4, 200);
  const legDrag = note(
    'Leg drag &amp; back take',
    `<div>Warm up: shrimps, leg drag entries</div>
     <div>Focus: chest to chest before the back</div>
     <div>Leg drag pass</div><en-media type="image/gif" hash="${md5(g1)}"/>
     <div>Pin the hip, knee on the mat</div><div>Head on the far side</div>
     <div>Back take when they turn away</div><div><en-media type="image/gif" hash="${md5(g2)}"/></div>
     <div>Seat belt first, then hooks</div>`,
    // Out of order on purpose: the hash decides.
    resource(g2) + resource(bytes('not a gif'), 'image/png') + resource(g1),
  );
  const plain = note('Open mat', '<div>Just rolls today</div>', '', '20250102T080000Z');
  const file = enex([legDrag, plain]);

  it('spots an export and counts its notes', () => {
    expect(looksLikeEnex(file)).toBe(true);
    expect(looksLikeEnex('{"prancheta":1}')).toBe(false);
    expect(countNotes(file)).toBe(2);
  });

  it('reads each note with its GIFs matched by hash', () => {
    const [a, b] = [...readEnex(file)];
    expect(a.title).toBe('Leg drag & back take');
    expect(a.date).toBe('2024-03-14');
    expect(a.images).toEqual([g1, g2]);
    expect(a.pieces).toContain(0);
    expect(b).toMatchObject({ title: 'Open mat', date: '2025-01-02', images: [] });
  });

  it('makes each GIF a technique named by the line above it, with the lines below as notes', () => {
    const [a] = [...readEnex(file)];
    const plan = noteToPlan(a, [
      { id: 'c1', width: 2, height: 2 },
      { id: 'c2', width: 2, height: 2 },
    ]);
    expect(plan.title).toBe('Leg drag & back take');
    expect(plan.date).toBe('2024-03-14');
    expect(plan.blocks.map((b) => b.kind)).toEqual(['concept', 'gems']);
    const concept = plan.blocks[0];
    expect(concept.kind === 'concept' && concept.notes).toBe('Warm up: shrimps, leg drag entries\nFocus: chest to chest before the back');
    expect(plan.blocks[1].moves).toMatchObject([
      { name: 'Leg drag pass', notes: 'Pin the hip, knee on the mat\nHead on the far side', clip: { id: 'c1' } },
      { name: 'Back take when they turn away', notes: 'Seat belt first, then hooks', clip: { id: 'c2' } },
    ]);
  });

  it('keeps a technique card when its GIF could not be made into a clip', () => {
    const [a] = [...readEnex(file)];
    const plan = noteToPlan(a, [undefined, { id: 'c2', width: 2, height: 2 }]);
    expect(plan.blocks[1].moves?.[0]).toMatchObject({ name: 'Leg drag pass' });
    expect(plan.blocks[1].moves?.[0].clip).toBeUndefined();
  });

  it('puts a note with no GIFs into a Concept block', () => {
    const [, b] = [...readEnex(file)];
    const plan = noteToPlan(b, []);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0]).toMatchObject({ kind: 'concept', notes: 'Just rolls today' });
  });

  it('brings in GIFs the text never shows, and leaves a long line in the notes rather than as a name', () => {
    const long = 'This is a long sentence about the position that is clearly a note, not the name of a move';
    const n = note('X', `<div>${long}</div><en-media type="image/gif" hash="${md5(g1)}"/>`, resource(g1) + resource(g2));
    const [x] = [...readEnex(enex([n]))];
    expect(x.images).toEqual([g1, g2]);
    const plan = noteToPlan(x, []);
    expect(plan.blocks[0]).toMatchObject({ kind: 'concept', notes: long });
    expect(plan.blocks[1].moves?.map((m) => m.name)).toEqual(['', '']);
  });

  it('decodes the test GIFs frame by frame', () => {
    const r = new GifReader(g2);
    expect(r.numFrames()).toBe(4);
    expect(frameSeconds(r.frameInfo(0).delay)).toBe(0.1);
    expect(frameSeconds(0)).toBe(0.1);
  });

  it('keeps the place of a GIF the export left out, and never gives it another GIF', () => {
    const n = note('Y', `<div>Move 1:</div><en-media type="image/gif" hash="${'0'.repeat(32)}"/><div>Move 2:</div><en-media type="image/gif" hash="${md5(g2)}"/>`, resource(g2));
    const [y] = [...readEnex(enex([n]))];
    expect(y.images).toEqual([null, g2]);
    const plan = noteToPlan(y, [undefined, { id: 'c2', width: 2, height: 2 }]);
    expect(plan.blocks.map((b) => b.kind)).toEqual(['gems']);
    expect(plan.blocks[0].moves).toMatchObject([{ name: 'Move 1' }, { name: 'Move 2', clip: { id: 'c2' } }]);
    expect(plan.blocks[0].moves?.[0].clip).toBeUndefined();
  });

  it('reads a note from an export that stops partway', () => {
    const cut = enex([legDrag]).replace(/<\/note>[\s\S]*$/, '');
    const [a] = [...readEnex(cut)];
    expect(a.title).toBe('Leg drag & back take');
    expect(a.images).toEqual([g1, g2]);
  });

  it('reads the created date even with whitespace around it', () => {
    const n = note('Z', '<div>x</div>', '').replace('<created>20240314T190000Z</created>', '<created>\n      20261020T015103Z\n    </created>');
    expect([...readEnex(enex([n]))][0].date).toBe('2026-10-20');
  });
});

describe('sections', () => {
  it('spots section headings, not notes that mention them', () => {
    expect(sectionKind('[Movement section]')).toBe('warmup');
    expect(sectionKind('Warm up with:')).toBe('warmup');
    expect(sectionKind('[Concept section]')).toBe('concept');
    expect(sectionKind('[Game around that concept/objective]')).toBe('game');
    expect(sectionKind('[Then the gems]')).toBe('gems');
    expect(sectionKind('[Free roll]')).toBe('freeRoll');
    expect(sectionKind('Free roll')).toBe('freeRoll');
    expect(sectionKind('Aquecimento:')).toBe('warmup');
    expect(sectionKind('Just rolls today')).toBeNull();
    expect(sectionKind('Move 1:')).toBeNull();
    expect(sectionKind('Positional spar from leg drag to take the back :')).toBeNull();
    expect(sectionKind('General rule: offensive opportunities from leg drag')).toBeNull();
  });

  it('turns a sectioned note into blocks of each kind', () => {
    const g1 = gif(2, 1);
    const g2 = gif(2, 2);
    const g3 = gif(2, 3);
    const body = [
      '<div>Warm up with:</div><div>[Movement section]</div><div>Forward rolls</div><div>Shrimps</div><div><br/></div>',
      '<div>[Concept section]</div><div>General rule: offensive opportunities from leg drag</div>',
      '<div>[Game around that concept/objective]</div><div>Positional spar from leg drag to take the back :</div>',
      '<div>Show general goals first</div><div>Rounds: </div><div>2x3 minutes, switch partners, then switch positions?</div>',
      `<div>[Then the gems]</div><div>Move 1: </div><en-media type="image/gif" hash="${md5(g1)}"/><div><br/></div>`,
      `<en-media type="image/gif" hash="${md5(g2)}"/><div>Options:</div><en-media type="image/gif" hash="${md5(g3)}"/>`,
      '<div>[Free roll]</div>',
    ].join('');
    const [x] = [...readEnex(enex([note('Class', body, resource(g1) + resource(g2) + resource(g3))]))];
    const clips = [1, 2, 3].map((i) => ({ id: `c${i}`, width: 2, height: 2 }));
    const plan = noteToPlan(x, clips);
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll']);
    const [warmup, concept, game, gems] = plan.blocks;
    expect(warmup.kind === 'warmup' && warmup.drills.map((d) => d.text)).toEqual(['Forward rolls', 'Shrimps']);
    expect(concept).toMatchObject({ rule: 'General rule: offensive opportunities from leg drag' });
    expect(game).toMatchObject({ objective: 'Positional spar from leg drag to take the back :', rounds: { roundsPerSide: 2, minutes: 3 } });
    expect(game.kind === 'game' && game.goals.map((g) => g.text)).toEqual(['Show general goals first']);
    expect(gems.moves).toMatchObject([
      { name: 'Move 1', clip: { id: 'c1' } },
      { name: 'Move 1 (2)', clip: { id: 'c2' } },
      { name: 'Options', clip: { id: 'c3' } },
    ]);
  });

  it('reads a note with no headings by its Game, Move, Details and Troubleshooting lines', () => {
    // A tiny PNG: stills come in too, not only GIFs.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const pics = [gif(2, 5), png, gif(2, 6), gif(2, 7)];
    const pic = (b: Uint8Array, type = 'image/gif') => `<en-media hash="${md5(b)}" type="${type}"/>`;
    const body = [
      '<div>Warm up:</div><div>Forward Rolls</div><div>Shrimps</div>',
      `<div>Warm up Games: </div><div>Game 1: Pinning/ Guard retention</div>${pic(pics[0])}`,
      '<div>Top player keeps shoulders pinned</div><div>Bottom player recovers knee shield</div>',
      `<div>Game 2: winning the battle at 50/50 half guard. </div>${pic(pics[1], 'image/png')}<div>Top player clears the frames</div>`,
      '<div>Move: Fight up to dog fight: Troubleshooting</div><ol><li><div>Details: </div></li><ol><li><div>Strong grip</div></li></ol></ol>',
      `<div>Troubleshooting: on the way to the underhook</div><div>Knee bump to clear cross face</div>${pic(pics[2])}<div>Dog fight underhook details.</div>`,
      `<div>Move: Cross Arm Drag into Spring Sweep:</div>${pic(pics[3])}<div>Details: </div><ol><li><div>Use the elbow to frame</div></li></ol>`,
    ].join('');
    const [n] = [...readEnex(enex([note('Half Guard', body, pics.map((b) => resource(b)).join(''))]))];
    expect(n.images).toEqual(pics);
    const plan = noteToPlan(n, pics.map((_, i) => ({ id: `p${i}`, width: 2, height: 2 })));
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'game', 'game', 'gems']);
    const [warmup, g1, g2, gems] = plan.blocks;
    expect(warmup.kind === 'warmup' && warmup.drills.map((d) => d.text)).toEqual(['Forward Rolls', 'Shrimps']);
    expect(g1).toMatchObject({ objective: 'Pinning/ Guard retention', moves: [{ clip: { id: 'p0' } }] });
    expect(g1.kind === 'game' && g1.goals.map((g) => g.text)).toEqual(['Top player keeps shoulders pinned', 'Bottom player recovers knee shield']);
    expect(g2).toMatchObject({ objective: 'winning the battle at 50/50 half guard.', moves: [{ clip: { id: 'p1' } }] });
    expect(gems.moves).toMatchObject([
      { name: 'Fight up to dog fight: Troubleshooting', notes: 'Strong grip' },
      { name: 'Troubleshooting: on the way to the underhook', notes: 'Knee bump to clear cross face\nDog fight underhook details.', clip: { id: 'p2' } },
      { name: 'Cross Arm Drag into Spring Sweep', notes: 'Use the elbow to frame', clip: { id: 'p3' } },
    ]);
    expect(gems.moves?.[0].clip).toBeUndefined();
  });
});
