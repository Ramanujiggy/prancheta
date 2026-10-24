// The class as a Word document (.docx): the same content as the printed
// sheet. Word can't play video, so a video clip goes in as a still frame (the
// class file carries the moving version); older GIF clips go in as GIFs. Word,
// Google Docs and Pages all open .docx, so the coach can edit it, email it, or
// drop it into a shared drive. This module is loaded only when someone
// exports, so the docx library never slows down opening the app.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import {
  allMoves,
  blockLabel,
  blockMinutes,
  describeGameRounds,
  formatMinutes,
  totalMinutes,
  type Block,
  type ClassPlan,
  type ListItem,
  type Move,
} from './plan.ts';
import { getClip, getClipStill } from './clips.ts';
import { APP_NAME } from './brand.ts';
import { formatDate } from '../components/PrintSheet.tsx';
import { formatRest } from '../components/controls.tsx';
import { t } from './i18n.ts';

const INK = '13233B';
const MUTED = '5D6B80';
const RULE = 'C3CBD6';
/** Widest a clip is placed on the page, in pixels at 96 dpi (about 9 cm). */
const CLIP_WIDTH = 340;

export interface ClipImage {
  data: Uint8Array;
  type: 'gif' | 'jpg' | 'png';
  /** A still of a video clip, rather than the clip itself. */
  still: boolean;
}
export type ClipBytes = Map<string, ClipImage>;

function sectionHeading(title: string, time: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
    tabStops: [{ type: TabStopType.RIGHT, position: 9700 }],
    children: [
      new TextRun({ text: title, bold: true, color: INK, size: 28 }),
      new TextRun({ text: `\t${time}`, color: MUTED, size: 22, font: 'Courier New' }),
    ],
  });
}

function sub(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 40 },
    children: [new TextRun({ text, bold: true, color: INK })],
  });
}

function body(text: string, opts: { label?: string; bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      ...(opts.label ? [new TextRun({ text: `${opts.label.toUpperCase()}  `, color: MUTED, size: 16, bold: true })] : []),
      new TextRun({ text, bold: opts.bold }),
    ],
  });
}

function bullets(items: ListItem[]): Paragraph[] {
  return items.filter((x) => x.text.trim()).map((x) => new Paragraph({ text: x.text, bullet: { level: 0 } }));
}

function moveParagraphs(moves: Move[], clips: ClipBytes): Paragraph[] {
  const out: Paragraph[] = [];
  moves
    .filter((m) => m.name.trim() || m.notes.trim() || m.clip)
    .forEach((m, i) => {
      out.push(sub(t('moveNamed', { n: i + 1, name: m.name || t('untitledMove') })));
      const image = m.clip && clips.get(m.clip.id);
      if (m.clip && image) {
        const scale = Math.min(1, CLIP_WIDTH / m.clip.width);
        out.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new ImageRun({
                type: image.type,
                data: image.data,
                transformation: { width: Math.round(m.clip.width * scale), height: Math.round(m.clip.height * scale) },
                altText: {
                  name: m.name || t('moveN', { n: i + 1 }),
                  description: t('clipAlt', { name: m.name }),
                  title: m.name || t('moveN', { n: i + 1 }),
                },
              }),
            ],
          }),
        );
        if (image.still) {
          out.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: t('stillCaption'), color: MUTED, size: 16, italics: true })],
            }),
          );
        }
      }
      if (m.notes.trim()) out.push(body(m.notes));
    });
  return out;
}

function blockParagraphs(b: Block, clips: ClipBytes): Paragraph[] {
  const head = sectionHeading(blockLabel(b), formatMinutes(blockMinutes(b)));
  switch (b.kind) {
    case 'warmup':
      return [head, ...bullets(b.drills)];
    case 'concept':
      return [head, ...(b.rule ? [body(b.rule, { bold: true })] : []), ...(b.notes ? [body(b.notes)] : [])];
    case 'game':
      return [
        head,
        body(`${b.start || t('startPosition')} → ${b.objective || t('objectiveLower')}`, { bold: true }),
        ...(b.goals.length ? [sub(t('goalsAndMovements')), ...bullets(b.goals)] : []),
        ...(b.details.length ? [sub(t('details')), ...bullets(b.details)] : []),
        ...(b.transition ? [body(b.transition, { label: t('transition') })] : []),
        ...(b.submission ? [body(b.submission, { label: t('submission') })] : []),
        body(`${describeGameRounds(b.rounds)} · ${t('restLower')} ${formatRest(b.rounds.restSeconds)}`, { label: t('rounds') }),
      ];
    case 'gems':
      return [head, ...moveParagraphs(b.moves, clips), ...(b.options.length ? [sub(t('options')), ...bullets(b.options)] : [])];
    case 'freeRoll':
      return [
        head,
        body(`${b.rounds} × ${b.minutes} min · ${t('restLower')} ${formatRest(b.restSeconds)}`),
        ...(b.notes ? [body(b.notes)] : []),
      ];
    case 'wrapup':
      return [head, ...(b.question ? [body(b.question, { bold: true })] : []), ...(b.notes ? [body(b.notes)] : [])];
  }
}

/** Builds the document from a plan and the images of its clips. Pure, so it can be tested. */
export function buildClassDocument(plan: ClassPlan, clips: ClipBytes): Document {
  const title = plan.title || t('untitledClass');

  return new Document({
    creator: APP_NAME,
    title,
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22, color: INK } },
        heading2: { run: { font: 'Arial' } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 60 },
            children: [new TextRun({ text: title, bold: true, size: 48, color: INK, font: 'Arial' })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 6 } },
            children: [
              new TextRun({ text: `${formatDate(plan.date)}  ·  ${formatMinutes(totalMinutes(plan))}`, color: MUTED, font: 'Courier New', size: 20 }),
            ],
          }),

          ...plan.blocks.flatMap((b) => [...blockParagraphs(b, clips), ...(b.kind !== 'gems' && b.moves ? moveParagraphs(b.moves, clips) : [])]),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 360 },
            children: [new TextRun({ text: t('madeWith', { app: APP_NAME }), color: MUTED, size: 16 })],
          }),
        ],
      },
    ],
  });
}

/** Loads the plan's clips and packs the .docx. */
export async function exportClassDocument(plan: ClassPlan): Promise<Blob> {
  const clips: ClipBytes = new Map();
  for (const m of allMoves(plan)) {
    if (!m.clip) continue;
    const clip = await getClip(m.clip.id).catch(() => undefined);
    const still = clip?.type.startsWith('video/');
    const blob = still ? await getClipStill(m.clip.id).catch(() => undefined) : clip;
    const type = blob?.type === 'image/gif' ? 'gif' : blob?.type === 'image/png' ? 'png' : blob?.type === 'image/jpeg' ? 'jpg' : null;
    if (blob && type) clips.set(m.clip.id, { data: new Uint8Array(await blob.arrayBuffer()), type, still: !!still });
  }
  return Packer.toBlob(buildClassDocument(plan, clips));
}
