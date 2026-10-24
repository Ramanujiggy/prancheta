// Planning a class with an AI chat. The coach takes the class format (JSON,
// with a line on what each block is for) into the chat where they're already
// talking the class through, and the AI hands it back filled in. The app
// pulls the JSON out of the reply and builds a normal plan from it, ready
// for clips and sharing.
//
// AI replies are messy: code fences, a sentence before and after, trailing
// commas, curly quotes, "3 min" where a number belongs, a list written as one
// string, a block kind in its own words. Everything here is forgiving about
// that, and only gives up with a reason the coach can act on.
//
// The class JSON (version 1). Every field is optional except `blocks`:
//
//   { "prancheta": 1, "title": "...", "date": "YYYY-MM-DD",
//     "blocks": [
//       { "kind": "warmup",    "title": "", "minutes": 10, "drills": ["..."] },
//       { "kind": "concept",   "minutes": 5, "rule": "...", "notes": "..." },
//       { "kind": "positionalSparring", "start": "...", "objective": "...",
//         "goals": ["..."], "details": ["..."], "transition": "...", "submission": "...",
//         "rounds": { "roundsPerSide": 2, "minutes": 3, "restSeconds": 30,
//                     "switchPartners": true, "switchPositions": true } },
//       { "kind": "technique", "minutes": 15, "moves": [{ "name": "...", "notes": "..." }], "options": ["..."] },
//       { "kind": "rolling",   "rounds": 4, "minutes": 5, "restSeconds": 60, "notes": "..." },
//       { "kind": "wrapup",    "minutes": 3, "question": "...", "notes": "..." } ] }
//
// A backup or class file's own JSON (internal kinds, `{id, text}` list items)
// reads too, so the same importer takes either.
//
// Clips never go to the AI. A class sent with "Change it with AI" numbers
// each move's clip ("clip": 1) and says which class it came from ("from");
// the app remembers which clip each number stands for, so the AI's answer
// gets its clips back on whichever moves carry those numbers.

import { allMoves, blankPlan, normalizePlan, uid, type Block, type BlockKind, type ClassPlan, type Clip, type Move } from './plan.ts';
import { getLang, type Lang } from './i18n.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── Pulling the JSON out of a chat reply ────────────────────────────────────

/** The first balanced {...} in the text, skipping braces inside strings. */
function firstObject(text: string, from: number): string | null {
  const start = text.indexOf('{', from);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  // Cut off before it closed: hand back the rest so the error says so.
  return text.slice(start);
}

/** Fixes the slips chat models make in JSON: curly quotes, comments, trailing commas. */
function repair(json: string): string {
  return json
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
}

export type ReadError = 'empty' | 'noJson' | 'cutOff' | 'badJson' | 'noBlocks';

/** The JSON object in a chat reply, or why there isn't one. */
export function extractJson(text: string): { value: unknown } | { error: ReadError } {
  if (!text.trim()) return { error: 'empty' };
  // Prefer what's inside a ```json fence, then any {...} at all.
  const fenced = [...text.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = [...fenced, text];
  let cutOff = false;
  let found = false;
  for (const c of candidates) {
    let at = 0;
    for (let obj = firstObject(c, at); obj; obj = firstObject(c, at)) {
      found = true;
      at = c.indexOf(obj, at) + 1;
      for (const attempt of [obj, repair(obj)]) {
        try {
          const value = JSON.parse(attempt);
          if (isObj(value)) return { value };
        } catch {
          // try the repaired text, then the next object
        }
      }
      if (!obj.trimEnd().endsWith('}')) cutOff = true;
    }
  }
  if (!found) return { error: 'noJson' };
  return { error: cutOff ? 'cutOff' : 'badJson' };
}

// ─── From the AI's words to the plan's shape ─────────────────────────────────

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/** What a chat model, or a coach, might call each kind. */
const KIND_WORDS: Record<BlockKind, string[]> = {
  warmup: ['warmup', 'warm', 'movement', 'aquecimento', 'movimentacao', 'aquecimentomovimentacao'],
  concept: ['concept', 'conceito', 'theme', 'tema', 'rule', 'principle'],
  game: [
    'game',
    'positionalsparring',
    'positionalgame',
    'sparring',
    'positional',
    'specific',
    'specifictraining',
    'situational',
    'especifico',
    'jogoposicional',
    'treinoespecifico',
  ],
  gems: ['gems', 'technique', 'techniques', 'tecnica', 'tecnicas', 'drilling', 'drill', 'instruction', 'pulodogato'],
  freeRoll: ['freeroll', 'rolling', 'roll', 'rolls', 'rola', 'rolalivre', 'livesparring', 'live', 'liverolling', 'treinolivre'],
  wrapup: ['wrapup', 'fechamento', 'cooldown', 'debrief', 'review', 'closing'],
};
const KIND_OF = new Map<string, BlockKind>(
  (Object.entries(KIND_WORDS) as [BlockKind, string[]][]).flatMap(([k, words]) => words.map((w) => [w, k] as const)),
);

export function kindFrom(v: unknown): BlockKind | null {
  return typeof v === 'string' ? (KIND_OF.get(plain(v)) ?? null) : null;
}

/** The first of several possible keys that's present. */
const pick = (r: Obj, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null);

function text(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join('\n');
  return undefined;
}

/** "3", "3 min", "2.5" → a number; anything else is left out. */
function count(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function yes(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const w = plain(v);
    if (['true', 'yes', 'sim', 'y'].includes(w)) return true;
    if (['false', 'no', 'nao', 'n'].includes(w)) return false;
  }
  return undefined;
}

/** A list as `{id, text}` items, from strings, one string with a line per item, or items already. */
function items(v: unknown): { id: string; text: string }[] | undefined {
  const raw = typeof v === 'string' ? v.split(/\n+/) : Array.isArray(v) ? v : undefined;
  if (!raw) return undefined;
  return raw
    .map((x) => (isObj(x) ? { id: typeof x.id === 'string' && x.id ? x.id : uid(), text: text(pick(x, 'text', 'name', 'title')) ?? '' } : { id: uid(), text: text(x) ?? '' }))
    .map((x) => ({ ...x, text: x.text.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '') }))
    .filter((x) => x.text);
}

function moves(v: unknown): Obj[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .map((m): Obj | null => {
      if (typeof m === 'string') return m.trim() ? { name: m.trim(), notes: '' } : null;
      if (!isObj(m)) return null;
      // Keep what a backup carries (id, clip); take the AI's words for the rest.
      const notes = [text(pick(m, 'notes', 'description', 'details', 'steps')), text(pick(m, 'gems', 'keyDetails', 'tips'))]
        .filter(Boolean)
        .join('\n');
      return { ...m, name: text(pick(m, 'name', 'title', 'move', 'technique')) ?? '', notes };
    })
    .filter((m): m is Obj => m !== null && !!(m.name || m.notes));
}

/** One block in the shape normalizePlan reads, or null if its kind is unknown. */
function block(raw: unknown): Obj | null {
  if (!isObj(raw)) return null;
  const kind = kindFrom(pick(raw, 'kind', 'type', 'block'));
  if (!kind) return null;
  const r = raw;
  const out: Obj = { ...r, kind, title: text(pick(r, 'title', 'name', 'label')) ?? '' };
  const minutes = count(pick(r, 'minutes', 'duration', 'durationMinutes', 'time'));
  if (minutes !== undefined) out.minutes = minutes;
  switch (kind) {
    case 'warmup':
      out.drills = items(pick(r, 'drills', 'movements', 'exercises', 'items'));
      break;
    case 'concept':
      out.rule = text(pick(r, 'rule', 'concept', 'principle', 'idea'));
      out.notes = text(pick(r, 'notes', 'description', 'explanation'));
      break;
    case 'game': {
      const gr = isObj(r.rounds) ? r.rounds : r;
      out.start = text(pick(r, 'start', 'startPosition', 'position', 'startingPosition'));
      out.objective = text(pick(r, 'objective', 'goal', 'win', 'winCondition'));
      out.goals = items(pick(r, 'goals', 'movements', 'focus'));
      out.details = items(pick(r, 'details', 'keyDetails', 'tips'));
      out.transition = text(r.transition);
      out.submission = text(pick(r, 'submission', 'finish'));
      const perSide = count(pick(gr, 'roundsPerSide', 'rounds', 'count'));
      out.rounds = {
        roundsPerSide: perSide,
        // Flat on the block, "minutes" is a round's length only next to a round count;
        // alone it's the length of the whole game, which the rounds already decide.
        minutes: count(gr === r ? (pick(r, 'roundMinutes') ?? (perSide !== undefined ? r.minutes : undefined)) : pick(gr, 'minutes', 'roundMinutes')),
        restSeconds: count(pick(gr, 'restSeconds', 'rest')),
        switchPartners: yes(gr.switchPartners),
        switchPositions: yes(gr.switchPositions),
      };
      delete out.minutes;
      break;
    }
    case 'gems':
      out.moves = moves(pick(r, 'moves', 'techniques', 'items'));
      out.options = items(pick(r, 'options', 'counters', 'followUps'));
      break;
    case 'freeRoll':
      out.rounds = count(pick(r, 'rounds', 'count'));
      out.minutes = count(pick(r, 'minutes', 'roundMinutes'));
      out.restSeconds = count(pick(r, 'restSeconds', 'rest'));
      out.notes = text(pick(r, 'notes', 'description'));
      break;
    case 'wrapup':
      out.question = text(pick(r, 'question', 'prompt'));
      out.notes = text(pick(r, 'notes', 'description'));
      break;
  }
  // Any other block can hold a few moves too (a warm-up movement), in Technique's shape.
  if (kind !== 'gems') {
    const extra = moves(pick(r, 'moves', 'techniques'));
    if (extra?.length) out.moves = extra;
    else delete out.moves;
  }
  return out;
}

export type AiImport = { plan: ClassPlan; skipped: number } | { error: ReadError };

/** Builds a new plan from class JSON, in the format above or a backup's. */
export function planFromJson(value: unknown, now = new Date()): AiImport {
  let root = isObj(value) ? value : {};
  // { "class": {...} } and friends.
  for (const k of ['class', 'plan', 'aula', 'classPlan']) if (isObj(root[k])) root = root[k] as Obj;
  const found = pick(root, 'blocks', 'sections', 'blocos');
  if (!Array.isArray(found)) return { error: 'noBlocks' };
  const rawBlocks = withClips(found, clipsSentFrom(typeof root.from === 'string' ? root.from : undefined));
  const blocks = rawBlocks.map(block).filter((b): b is Obj => b !== null);
  if (!blocks.length) return { error: 'noBlocks' };
  const plan = normalizePlan({ ...root, blocks });
  if (!plan) return { error: 'noBlocks' };
  // Always a new class: an AI reply must never overwrite one that's here.
  const fresh = blankPlan(now);
  return {
    plan: {
      ...plan,
      id: fresh.id,
      title: text(pick(root, 'title', 'name', 'titulo')) ?? '',
      date: typeof root.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(root.date) ? root.date : fresh.date,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
    },
    skipped: rawBlocks.length - blocks.length,
  };
}

// ─── Clips through the AI ────────────────────────────────────────────────────

const AI_CLIPS_KEY = 'prancheta.aiClips';
/** Classes sent to an AI that are remembered, newest last. */
const AI_CLIPS_KEEP = 20;

type Sent = { from: string; clips: Clip[] };

function sentList(): Sent[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(AI_CLIPS_KEY) ?? '[]');
    return Array.isArray(v) ? (v as Sent[]).filter((x) => isObj(x) && typeof x.from === 'string' && Array.isArray(x.clips)) : [];
  } catch {
    return [];
  }
}

/** The clips of a class, in the order planToJson numbers them. */
function clipOrder(plan: ClassPlan): Clip[] {
  return allMoves(plan).flatMap((m) => (m.clip ? [m.clip] : []));
}

/** Remembers what each clip number stands for, so the AI's answer can get them back. */
function rememberClips(plan: ClassPlan) {
  const clips = clipOrder(plan);
  if (!clips.length) return;
  const list = [...sentList().filter((x) => x.from !== plan.id), { from: plan.id, clips }].slice(-AI_CLIPS_KEEP);
  try {
    localStorage.setItem(AI_CLIPS_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the answer comes back without its clips, as before.
  }
}

/** The clips a sent class carried. An answer that lost "from" gets the class sent last. */
function clipsSentFrom(from: string | undefined): Clip[] | undefined {
  const list = sentList();
  return (from && list.find((x) => x.from === from)?.clips) || (from ? undefined : list[list.length - 1]?.clips);
}

/** Swaps each move's clip number for the clip it stands for, and drops numbers that stand for nothing. */
function withClips(rawBlocks: unknown[], clips: Clip[] | undefined): unknown[] {
  return rawBlocks.map((b) => {
    if (!isObj(b) || !Array.isArray(b.moves)) return b;
    const moves = b.moves.map((m) => {
      if (!isObj(m) || isObj(m.clip) || m.clip === undefined) return m;
      const { clip: ref, ...rest } = m;
      const n = typeof ref === 'number' ? ref : typeof ref === 'string' ? Number(ref.replace(/\D/g, '')) : NaN;
      const clip = Number.isInteger(n) && n > 0 ? clips?.[n - 1] : undefined;
      return clip ? { ...rest, clip } : rest;
    });
    return { ...b, moves };
  });
}

/** The whole trip: a pasted chat reply to a new plan. */
export function readAiReply(reply: string, now = new Date()): AiImport {
  const found = extractJson(reply);
  return 'error' in found ? found : planFromJson(found.value, now);
}

// ─── The class format the coach hands to their AI ────────────────────────────
//
// The coach takes this into a chat they're already having, where the AI
// knows the class they have in mind, and the AI hands it back filled in.
// A bare schema fills worse than one with a line on what each block is for,
// so the format travels with short instructions and a blank template.

/** The usual class, every field empty: warm-up, concept, spar, technique, spar again, roll. */
const TEMPLATE = {
  prancheta: 1,
  title: '',
  blocks: [
    { kind: 'warmup', title: '', minutes: 10, drills: [''] },
    { kind: 'concept', title: '', minutes: 5, rule: '', notes: '' },
    {
      kind: 'positionalSparring',
      title: '',
      start: '',
      objective: '',
      goals: [''],
      details: [''],
      transition: '',
      submission: '',
      rounds: { roundsPerSide: 2, minutes: 3, restSeconds: 30, switchPartners: true, switchPositions: true },
    },
    { kind: 'technique', title: '', minutes: 15, moves: [{ name: '', notes: '' }], options: [''] },
    {
      kind: 'positionalSparring',
      title: '',
      start: '',
      objective: '',
      goals: [''],
      details: [''],
      transition: '',
      submission: '',
      rounds: { roundsPerSide: 1, minutes: 3, restSeconds: 30, switchPartners: true, switchPositions: true },
    },
    { kind: 'rolling', title: '', rounds: 4, minutes: 5, restSeconds: 60, notes: '' },
  ],
};

/** What each block is for and the rules for its fields. Shared by the blank format and a class sent back for changes. */
const GUIDE: Record<Lang, string> = {
  en: `How the format works. A class is an ordered list of blocks, each with a "kind":
- "warmup": movement to wake the body up, ending close to the real thing. minutes, drills (short lines).
- "concept" (Concept / Focus): the focus of today's class, the one idea everything comes back to. minutes, rule (one sentence), notes.
- "positionalSparring": sparring from a position toward a goal. Goals and movements first, details once they've felt it. start (start position), objective, goals, details, transition, submission, rounds (roundsPerSide, minutes, restSeconds, switchPartners, switchPositions).
- "technique": the moves that win the game. minutes, moves (each a name, with the key details in notes), options (what to do when the move is stopped).
- "rolling": live rounds. rounds, minutes per round, restSeconds, notes.
- "wrapup" (optional): minutes, question (one question back to the class), notes.
Any other block can also have "moves" in the same shape as technique's when a specific technique belongs there (a warm-up movement, a drill to show). Leave it out otherwise.
Add, remove, repeat or reorder blocks to fit the class. "title" is my own name for a block; leave it "" to use the kind's name. Keep the keys and "kind" values exactly as written. Numbers are plain numbers (3, not "3 min"). Keep every line short, the way a coach writes on a clipboard.`,

  pt: `Como o formato funciona. A aula é uma lista ordenada de blocos, cada um com um "kind":
- "warmup": aquecimento e movimentação, terminando perto da luta de verdade. minutes, drills (linhas curtas).
- "concept" (Conceito / Foco): o foco da aula de hoje, a ideia que guia todo o resto. minutes, rule (uma frase), notes.
- "positionalSparring": treino específico de uma posição até um objetivo. Primeiro objetivos e movimentos, os detalhes depois que sentirem a posição. start (posição inicial), objective, goals, details, transition, submission, rounds (roundsPerSide, minutes, restSeconds, switchPartners, switchPositions).
- "technique": as técnicas que vencem o jogo. minutes, moves (cada uma com name, e os detalhes-chave, o pulo do gato, em notes), options (o que fazer quando a técnica é bloqueada).
- "rolling": rola livre. rounds, minutes por round, restSeconds, notes.
- "wrapup" (opcional): minutes, question (uma pergunta de volta para a turma), notes.
Qualquer outro bloco também pode ter "moves", no mesmo formato do technique, quando uma técnica específica pertence a ele (um movimento do aquecimento, um drill para mostrar). Senão, deixe de fora.
Adicione, remova, repita ou reordene blocos para caber na aula. "title" é o nome que eu dou ao bloco; deixe "" para usar o nome do tipo. Mantenha as chaves e os valores de "kind" exatamente como estão, em inglês. Números são números simples (3, e não "3 min"). Cada linha curta, como um professor escreve na prancheta.`,
};

const FORMAT: Record<Lang, string> = {
  en: `Fill in this Prancheta class plan (Prancheta is the app I plan my jiu-jitsu classes in).

If I paste notes from a class I've already written, that's the class: sort my words into the blocks and keep them as I wrote them, in my order. Don't add drills or moves I didn't write. Only ask about what the notes leave out.

Use what we've talked about in this conversation: the position, the goal, the students, the time. Before you fill it in, check you have enough for a class I'd actually teach. If something that changes the plan is missing or unclear (what the class is about, the students' level, how long it runs, gi or no-gi), ask me first: a few short questions in one message, only the ones that matter. Small details we haven't covered, decide like a good coach would.

Once you have what you need, give me the filled-in JSON as a file I can download, named prancheta-class.json, with only the JSON inside. If you can't make files, reply with it in one \`\`\`json code block and nothing else. No comments inside the JSON.

${GUIDE.en}

The template, in the usual order:
\`\`\`json
${JSON.stringify(TEMPLATE, null, 2)}
\`\`\``,

  pt: `Preencha este plano de aula do Prancheta (o Prancheta é o app onde eu planejo minhas aulas de jiu-jitsu).

Se eu colar anotações de uma aula que já escrevi, essa é a aula: organize as minhas palavras nos blocos e mantenha do jeito que eu escrevi, na minha ordem. Não acrescente exercícios ou técnicas que eu não escrevi. Só pergunte o que as anotações não dizem.

Use o que a gente conversou aqui: a posição, o objetivo, os alunos, o tempo. Antes de preencher, veja se você tem o suficiente para uma aula que eu daria de verdade. Se faltar ou não estiver claro algo que muda o plano (do que é a aula, o nível dos alunos, quanto tempo dura, com ou sem kimono), me pergunte antes: poucas perguntas curtas numa mensagem só, apenas as que importam. Detalhes pequenos que a gente não falou, decida como um bom professor decidiria.

Quando tiver o que precisa, me dê o JSON preenchido como um arquivo para baixar, chamado prancheta-aula.json, só com o JSON dentro. Se você não puder criar arquivos, responda com ele num bloco de código \`\`\`json e mais nada. Sem comentários dentro do JSON. Escreva o texto da aula em português do Brasil.

${GUIDE.pt}

O modelo, na ordem de sempre:
\`\`\`json
${JSON.stringify(TEMPLATE, null, 2)}
\`\`\``,
};

/** The class format with its fill-in instructions, to paste or upload into an AI chat. */
export function classFormat(lang: Lang = getLang()): string {
  return FORMAT[lang];
}

// ─── A saved class, back to the AI for changes ───────────────────────────────

const KIND_OUT: Record<BlockKind, string> = {
  warmup: 'warmup',
  concept: 'concept',
  game: 'positionalSparring',
  gems: 'technique',
  freeRoll: 'rolling',
  wrapup: 'wrapup',
};

const lines = (xs: { text: string }[]) => xs.map((x) => x.text.trim()).filter(Boolean);

/**
 * A plan in the class format: no ids, the AI's kind names, lists as plain
 * lines. A move with a clip carries the clip's number instead of the clip.
 */
export function planToJson(plan: ClassPlan): Obj {
  const order = clipOrder(plan).map((c) => c.id);
  const moveJson = (m: Move): Obj => {
    const n = m.clip ? order.indexOf(m.clip.id) + 1 : 0;
    return n ? { name: m.name, notes: m.notes, clip: n } : { name: m.name, notes: m.notes };
  };
  const kept = (ms: Move[]) => ms.filter((m) => m.name.trim() || m.notes.trim() || m.clip).map(moveJson);
  const blocks = plan.blocks.map((b): Obj => {
    const out = blockJson(b);
    if (b.kind === 'gems') return { ...out, moves: kept(b.moves) };
    const own = kept(b.moves ?? []);
    return own.length ? { ...out, moves: own } : out;
  });
  return { prancheta: 1, ...(order.length ? { from: plan.id } : {}), title: plan.title, date: plan.date, blocks };
}

function blockJson(b: Block): Obj {
  const base = { kind: KIND_OUT[b.kind], title: b.title };
  switch (b.kind) {
    case 'warmup':
      return { ...base, minutes: b.minutes, drills: lines(b.drills) };
    case 'concept':
      return { ...base, minutes: b.minutes, rule: b.rule, notes: b.notes };
    case 'game':
      return {
        ...base,
        start: b.start,
        objective: b.objective,
        goals: lines(b.goals),
        details: lines(b.details),
        transition: b.transition,
        submission: b.submission,
        rounds: { ...b.rounds },
      };
    case 'gems':
      return {
        ...base,
        minutes: b.minutes,
        options: lines(b.options),
      };
    case 'freeRoll':
      return { ...base, rounds: b.rounds, minutes: b.minutes, restSeconds: b.restSeconds, notes: b.notes };
    case 'wrapup':
      return { ...base, minutes: b.minutes, question: b.question, notes: b.notes };
  }
}

const EDIT: Record<Lang, (json: string) => string> = {
  en: (json) => `Here's a class plan from Prancheta (the app I plan my jiu-jitsu classes in). I'll tell you what to change.

Change only what I ask and keep the rest as it is. If my change is unclear, or it would mean changing something I didn't mention (cutting a block to fit the time, say), ask me first: a few short questions in one message, only the ones that matter.

Some moves have a "clip" number: that's a video of the move, kept in my app. Keep each "clip" with its move wherever the move goes, and keep "from" exactly as it is.

Once you have what you need, give me the whole updated class as a JSON file I can download, named prancheta-class.json, with only the JSON inside. If you can't make files, reply with it in one \`\`\`json code block and nothing else. No comments inside the JSON.

${GUIDE.en}

The class:
\`\`\`json
${json}
\`\`\``,

  pt: (json) => `Este é um plano de aula do Prancheta (o app onde eu planejo minhas aulas de jiu-jitsu). Vou te dizer o que mudar.

Mude só o que eu pedir e mantenha o resto como está. Se a mudança não estiver clara, ou se ela exigir mexer em algo que eu não falei (cortar um bloco para caber no tempo, por exemplo), me pergunte antes: poucas perguntas curtas numa mensagem só, apenas as que importam.

Alguns golpes têm um número em "clip": é o vídeo do golpe, guardado no meu app. Mantenha cada "clip" com o seu golpe, aonde quer que ele vá, e mantenha "from" exatamente como está.

Quando tiver o que precisa, me dê a aula inteira atualizada como um arquivo JSON para baixar, chamado prancheta-aula.json, só com o JSON dentro. Se você não puder criar arquivos, responda com ela num bloco de código \`\`\`json e mais nada. Sem comentários dentro do JSON. Escreva o texto da aula em português do Brasil.

${GUIDE.pt}

A aula:
\`\`\`json
${json}
\`\`\``,
};

/** A saved class with instructions to change it, to paste into an AI chat. Its reply imports as a new class. */
export function classForAi(plan: ClassPlan, lang: Lang = getLang()): string {
  rememberClips(plan);
  return EDIT[lang](JSON.stringify(planToJson(plan), null, 2));
}
