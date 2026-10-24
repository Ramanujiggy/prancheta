// Bringing classes in from Evernote. Evernote exports any number of notes as
// one .enex file: XML holding each note's text and every picture in it, the
// pictures as base64. The text points at each picture by the MD5 of its bytes.
//
// One note becomes one class, read line by line (see noteToPlan). Headings
// such as "Warm up:" or "[Concept section]" open blocks, "Game 1: …" opens a
// game, "Move: …" a technique, and each picture (a GIF or a still) lands on a
// technique card. The coach's words come over as written.
//
// This file only reads; turning each picture into a clip happens in gifClip.ts.

import { md5 } from './md5.ts';
import { item, move, newBlock, todayISO, uid, type Block, type BlockKind, type ClassPlan, type Clip, type Move } from './plan.ts';

export interface EnexNote {
  title: string;
  /** YYYY-MM-DD, from when the note was made. */
  date?: string;
  /** The note's lines in order, with a number where each picture sits (an index into images). */
  pieces: Array<string | number>;
  /** Each picture's bytes, or null where the note shows one the export didn't include. */
  images: Array<Uint8Array | null>;
}

/** Longest line that still reads as a technique's name rather than a sentence of notes. */
const NAME_MAX = 70;

export function looksLikeEnex(text: string): boolean {
  return text.slice(0, 4000).includes('<en-export');
}

/** How many notes the export holds, without reading them. */
export function countNotes(text: string): number {
  let n = 0;
  for (let i = text.indexOf('<note>'); i >= 0; i = text.indexOf('<note>', i + 6)) n++;
  return n;
}

/** The notes in the export, one at a time, so a big export never sits in memory twice. */
export function* readEnex(text: string): Generator<EnexNote> {
  let from = 0;
  for (;;) {
    const start = text.indexOf('<note>', from);
    if (start < 0) return;
    // An export cut short (Evernote on iPhone can stop after the GIFs it has
    // downloaded) still gives the note's text and whatever GIFs made it in.
    let end = text.indexOf('</note>', start);
    if (end < 0) end = text.length;
    from = end + 7;
    yield readNote(text.slice(start + 6, end));
  }
}

function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m?.[1];
}

function unescapeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** A picture's type from its first bytes: GIF, PNG, JPEG or WebP. */
export function imageType(b: Uint8Array): string | null {
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

function readNote(xml: string): EnexNote {
  const title = unescapeXml(tag(xml, 'title') ?? '').trim();
  const created = /^(\d{4})(\d{2})(\d{2})T/.exec((tag(xml, 'created') ?? '').trim());
  const date = created ? `${created[1]}-${created[2]}-${created[3]}` : undefined;

  // Every picture the note carries, by its MD5.
  const files: Array<{ hash: string; bytes: Uint8Array }> = [];
  const resourceRe = /<resource>([\s\S]*?)<\/resource>/g;
  for (let m = resourceRe.exec(xml); m; m = resourceRe.exec(xml)) {
    const data = tag(m[1], 'data');
    if (!data) continue;
    let bytes: Uint8Array;
    try {
      bytes = base64Bytes(data);
    } catch {
      continue;
    }
    if (imageType(bytes)) files.push({ hash: md5(bytes), bytes });
  }

  // The note's text is XHTML, usually wrapped in CDATA; without it, it is escaped.
  const raw = tag(xml, 'content') ?? '';
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  const content = cdata ? cdata[1] : unescapeXml(raw);
  const images: Array<Uint8Array | null> = [];
  const used = new Set<number>();
  const pieces: Array<string | number> = [];
  for (const p of noteLines(content)) {
    if (typeof p === 'string') {
      pieces.push(p);
      continue;
    }
    if (!p.image) continue;
    // Match by hash. A picture the export left out (Evernote on a phone only
    // exports what it has downloaded) keeps its place, without its file.
    let i = files.findIndex((f, k) => !used.has(k) && f.hash === p.hash);
    if (i < 0 && !p.hash) i = files.findIndex((_, k) => !used.has(k));
    if (i >= 0) used.add(i);
    pieces.push(images.length);
    images.push(i >= 0 ? files[i].bytes : null);
  }
  // Pictures the text never shows still come over, at the end.
  files.forEach((f, k) => {
    if (used.has(k)) return;
    pieces.push(images.length);
    images.push(f.bytes);
  });
  return { title, date, pieces, images };
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE', 'HR']);

/** A note's text as lines, with a marker for each attachment: whether it's a picture, and its hash. */
export function noteLines(enml: string): Array<string | { image: boolean; hash: string }> {
  const html = enml.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!DOCTYPE[\s\S]*?>/i, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: Array<string | { image: boolean; hash: string }> = [];
  let line = '';
  const breakLine = () => {
    const l = line.replace(/\s+/g, ' ').trim();
    if (l) out.push(l);
    line = '';
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      line += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const name = el.tagName.toUpperCase();
    if (name === 'EN-MEDIA') {
      breakLine();
      const type = (el.getAttribute('type') ?? '').toLowerCase();
      out.push({ image: type.startsWith('image/'), hash: (el.getAttribute('hash') ?? '').toLowerCase() });
      // HTML ignores the "/>" on <en-media/>, so whatever follows lands inside it.
      el.childNodes.forEach(walk);
      return;
    }
    if (name === 'BR') return breakLine();
    const block = BLOCK_TAGS.has(name);
    if (block) breakLine();
    // A ticked box in an Evernote checklist.
    if (name === 'EN-TODO') line += el.getAttribute('checked') === 'true' ? '☑ ' : '☐ ';
    el.childNodes.forEach(walk);
    if (block) breakLine();
    // Table cells sit side by side on one line.
    if (name === 'TD' || name === 'TH') line += '  ';
  };
  doc.body.childNodes.forEach(walk);
  breakLine();
  return out;
}

// A line like "[Concept section]", "Warm up with:" or "Free roll" starts a
// block of that kind. Checked in this order, so "[Game around that concept]" is
// a game. English and Portuguese.
const SECTION_WORDS: Array<[BlockKind, RegExp]> = [
  ['game', /\b(game|spar\w*|positional|jogo|posicional)/i],
  ['gems', /\b(gems?|techniques?|moves|t[ée]cnicas?|golpes)\b/i],
  ['freeRoll', /\b(free ?roll\w*|rolling|rolls?|rola\w*|treino livre|livre)\b/i],
  ['warmup', /\b(warm[ -]?ups?|movements?|aquec\w*|movimentos?)\b/i],
  ['wrapup', /\b(wrap[ -]?ups?|cool[ -]?down|fechamento|encerramento)\b/i],
  ['concept', /\b(concepts?|focus|conceitos?|foco)\b/i],
];

/** The kind of block a line opens, if it reads as a section heading rather than notes. */
export function sectionKind(line: string): BlockKind | null {
  if (/\d/.test(line) || line.length > 60) return null;
  const found = SECTION_WORDS.find(([, re]) => re.test(line));
  if (!found) return null;
  const words = line.replace(/[[\]:]/g, ' ').trim().split(/\s+/).length;
  // "[Game around that concept/objective]", "Warm up with:"
  if (/^\[.*\]$/.test(line) || (line.endsWith(':') && words <= 4)) return found[0];
  // A bare line counts only when it's nothing but the heading: "Free roll", not "Just rolls today".
  const rest = line.replace(found[1], ' ').replace(/[^\p{L}\s]/gu, ' ').trim().toLowerCase();
  return rest.split(/\s+/).every((w) => !w || /^(section|seção|secao|with|com)$/.test(w)) ? found[0] : null;
}

/** "2x3 minutes", "3 x 5 min": rounds per side, then minutes. */
const ROUNDS = /\b(\d{1,2})\s*[x×]\s*(\d{1,2})\s*min/i;
/** "Game 1: Pinning", "Jogo 2 - Meia guarda": a new game, named by the rest. */
const GAME = /^(?:game|jogo)\s*\d*\s*[:.\-–]\s*(.*)$/i;
/** "Move: Cross arm drag", "Técnica 2:": a new technique, named by the rest. */
const MOVE = /^(?:move|technique|t[ée]cnica|golpe)\s*\d*\s*[:.\-–]\s*(.*)$/i;
/** "Troubleshooting: on the way to the underhook": a technique of its own, named in full. */
const TROUBLE = /^(?:troubleshoot\w*|problemas?)\b/i;
/** A label with nothing after it, such as "Details:", which only introduces the lines below. */
const LABEL = /^(?:details?|detalhes?|notes?|notas?)\s*:?\s*$/i;

/** A technique's name from a line: "Move 1:" → "Move 1". */
const cleanName = (line: string) => line.replace(/[\s:–-]+$/, '').trim();

/**
 * The class a note becomes, read line by line. `clips` lines up with
 * note.images; a picture that could not be made into a clip leaves its
 * technique card without one.
 *
 * - A heading ("Warm up:", "[Concept section]", "Free roll") opens a block of
 *   that kind; "Game 1: …" opens a game, "Move: …" or "Troubleshooting: …"
 *   a technique card in a Technique block.
 * - A picture fills the open technique card if it has none yet; otherwise
 *   it becomes a card of its own, named by the short line just above it.
 * - Other lines go where that block keeps its words: warm-up drills, the
 *   concept's focus and notes, the game's objective and goals, the
 *   technique card's notes.
 * - Text before any heading goes to a Concept block.
 */
export function noteToPlan(note: EnexNote, clips: Array<Clip | undefined>, now = new Date()): ClassPlan {
  const blocks: Block[] = [];
  const preamble: string[] = [];
  // The open block and technique card. `fresh`: nothing has gone into the
  // block yet, so a second heading for the same kind reuses it. `awaiting`:
  // the card came from a "Move: …" line and its picture hasn't come yet.
  const st: { block: Block | null; card: Move | null; fresh: boolean; awaiting: boolean } = {
    block: null,
    card: null,
    fresh: false,
    awaiting: false,
  };
  const { pieces } = note;

  const open = (kind: BlockKind) => {
    st.card = null;
    st.awaiting = false;
    if (st.block?.kind === kind && st.fresh) return st.block;
    st.block = kind === 'gems' ? { ...newBlock('gems'), moves: [] } : newBlock(kind);
    blocks.push(st.block);
    st.fresh = true;
    return st.block;
  };
  const addCard = (name: string) => {
    const b: Block = st.block ?? open('gems');
    st.card = move(name);
    st.awaiting = false;
    b.moves = [...(b.moves ?? []), st.card];
    st.fresh = false;
    return st.card;
  };

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const next = pieces[i + 1];
    if (typeof p === 'number') {
      const current = st.card as Move | null;
      // A card from "Move: …" waiting for its picture takes it.
      let target = current && st.awaiting ? current : null;
      st.awaiting = false;
      if (!target) {
        const above = pieces[i - 1];
        let name = typeof above === 'string' && above.length <= NAME_MAX && !isMarker(above) ? cleanName(above) : '';
        // A second picture straight after the first shows more of the same move.
        if (!name && typeof above === 'number' && current?.name) name = numbered(st.block?.moves ?? [], current.name);
        // A picture right under "Game 1: Pinning" is the game's own.
        if (!name && st.block?.kind === 'game' && typeof above === 'string' && GAME.test(above)) name = st.block.objective;
        target = addCard(name);
      }
      const clip = clips[p];
      if (clip) target.clip = clip;
      // Outside Technique a picture stands alone; the lines after it belong to the block.
      if (st.block?.kind !== 'gems') st.card = null;
      continue;
    }

    const kind = sectionKind(p);
    if (kind) {
      open(kind);
      continue;
    }
    const game = GAME.exec(p);
    if (game) {
      const g = open('game') as Extract<Block, { kind: 'game' }>;
      g.objective = cleanName(game[1]) || cleanName(p);
      st.fresh = false;
      continue;
    }
    const moveLine = MOVE.exec(p);
    if (moveLine || TROUBLE.test(p)) {
      if (st.block?.kind !== 'gems') open('gems');
      addCard(moveLine ? cleanName(moveLine[1]) || cleanName(p) : cleanName(p));
      st.awaiting = true;
      continue;
    }
    if (LABEL.test(p)) continue;
    // A short line right above a picture is that picture's name, unless an open card is waiting for one.
    if (typeof next === 'number' && p.length <= NAME_MAX && !st.awaiting) continue;

    if (st.card) {
      const c = st.card as Move;
      c.notes = c.notes ? `${c.notes}\n${p}` : p;
    } else if (st.block) {
      addText(st.block, p);
      st.fresh = false;
    } else {
      preamble.push(p);
    }
  }

  if (preamble.length) blocks.unshift({ ...newBlock('concept'), notes: preamble.join('\n') });
  for (const b of blocks) {
    if (b.kind === 'game') setRounds(b);
    if (b.kind === 'gems' && !b.moves.length) b.moves = [move()];
    if (b.kind !== 'gems' && b.moves && !b.moves.length) delete b.moves;
  }
  if (!blocks.length) blocks.push(newBlock('concept'));

  const stamp = now.toISOString();
  return {
    id: uid(),
    title: note.title,
    date: note.date ?? todayISO(now),
    createdAt: stamp,
    updatedAt: stamp,
    blocks,
  };
}

const isMarker = (line: string) => sectionKind(line) !== null || GAME.test(line) || MOVE.test(line) || TROUBLE.test(line) || LABEL.test(line);

/** "Move 1" → "Move 1 (2)", then "(3)": the next picture of the same move. */
function numbered(moves: Move[], name: string): string {
  const base = name.replace(/ \(\d+\)$/, '');
  const n = moves.filter((m) => m.name === base || m.name.startsWith(`${base} (`)).length;
  return `${base} (${n + 1})`;
}

/** Puts a line where that kind of block keeps its words. */
function addText(b: Block, line: string) {
  switch (b.kind) {
    case 'warmup':
      b.drills.push(item(line));
      return;
    case 'concept':
      // The first line is the focus; the rest is how it's explained.
      if (!b.rule) b.rule = line;
      else b.notes = b.notes ? `${b.notes}\n${line}` : line;
      return;
    case 'game':
      if (!b.objective) b.objective = line;
      else b.goals.push(item(line));
      return;
    case 'gems':
      b.options.push(item(line));
      return;
    case 'freeRoll':
    case 'wrapup':
      b.notes = b.notes ? `${b.notes}\n${line}` : line;
  }
}

/** "2x3 minutes" in a game's goals sets its rounds; a bare "Rounds:" above it goes too. */
function setRounds(game: Extract<Block, { kind: 'game' }>) {
  const at = game.goals.findIndex((g) => ROUNDS.test(g.text));
  if (at < 0) return;
  const [, n, min] = ROUNDS.exec(game.goals[at].text)!;
  game.rounds = { ...game.rounds, roundsPerSide: Number(n), minutes: Number(min) };
  game.goals = game.goals.filter((g, i) => i !== at && !/^(rounds?|rodadas?)\s*:?$/i.test(g.text));
}
