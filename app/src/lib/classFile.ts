// The class file: one .html file that is the whole class, clips included.
// Send it by text, email or AirDrop and it opens in any browser, on a phone
// or a laptop, with the clips looping in place and no app needed. Open the
// app, tap Import, pick the same file, and the class is back, editable.
//
// The file is built so it reads even where scripts don't run: the text is
// plain HTML and every clip shows its still frame. A few lines of script then
// turn each clip's data into a playable video (iPhone Safari won't play a
// video straight from a data: URL). The plan itself rides along as JSON, and
// each clip is stored once, in its own tag, which the importer reads back.

import {
  blockLabel,
  blockMinutes,
  describeGameRounds,
  formatMinutes,
  normalizePlan,
  storedPlan,
  totalMinutes,
  type Block,
  type ClassPlan,
  type ListItem,
  type Move,
} from './plan.ts';
import { withClipData } from './clips.ts';
import { APP_NAME } from './brand.ts';
import { getLang, t } from './i18n.ts';
import { formatDate } from '../components/PrintSheet.tsx';
import { formatRest } from '../components/controls.tsx';
// The title face travels inside the file (about 25 KB), so the class looks the same on any device.
import headFont from '@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-700-normal.woff2?inline';

const PLAN_ID = 'class-plan';
const POSTER = '.poster';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function list(items: ListItem[]): string {
  const filled = items.filter((x) => x.text.trim());
  return filled.length ? `<ul>${filled.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '';
}

const para = (text: string, cls = '') => (text.trim() ? `<p${cls ? ` class="${cls}"` : ''}>${esc(text)}</p>` : '');
const line = (k: string, v: string) => (v.trim() ? `<p><span class="k">${esc(k)}</span> ${esc(v)}</p>` : '');

function section(n: number, title: string, time: string, body: string): string {
  return `<section><header><span class="n">${String(n).padStart(2, '0')}</span><h2>${esc(title)}</h2><span class="t">${esc(time)}</span></header>${body}</section>`;
}

function clipTag(id: string, label: string, width: number, height: number, data: Record<string, string>): string {
  const src = data[id];
  if (!src) return '';
  const size = `width="${width}" height="${height}"`;
  if (src.startsWith('data:video/')) {
    const poster = data[id + POSTER];
    return `<figure><video data-clip="${esc(id)}" ${size} src="${src}"${poster ? ` poster="${poster}"` : ''} autoplay loop muted playsinline aria-label="${esc(label)}"></video></figure>`;
  }
  return `<figure><img data-clip="${esc(id)}" ${size} src="${src}" alt="${esc(label)}"></figure>`;
}

const LOGO = `<svg class="logo" width="35" height="22" viewBox="0 0 35.2 22" aria-hidden="true" stroke-width="2.4" stroke-linecap="round"><g stroke="currentColor"><line x1="3.5" y1="2" x2="3.5" y2="20"/><line x1="10.6" y1="2" x2="10.6" y2="20"/><line x1="17.6" y1="2" x2="17.6" y2="20"/><line x1="24.6" y1="2" x2="24.6" y2="20"/></g><line class="strike" x1="1" y1="18" x2="34.2" y2="4"/></svg>`;

const STYLE = `
@font-face{font-family:'Class Head';font-weight:700;font-display:swap;src:url(${headFont}) format('woff2')}
:root{--paper:#fff;--sheet:#f5f7fa;--ink:#13233b;--ink-2:#3d4c63;--muted:#5d6b80;--rule:#dfe3ea;--marker:#d42a20;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#0f1a2b;--sheet:#16233a;--ink:#eef2f7;--ink-2:#c9d3e0;--muted:#9fb0c6;--rule:#26354d;--marker:#ff6a5c;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-text-size-adjust:100%}
main{max-width:720px;margin:0 auto;padding:28px 16px 48px}
.top{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.logo{color:var(--ink);flex:none}.logo .strike{stroke:var(--marker)}
h1{font-family:'Class Head','IBM Plex Sans Condensed','Arial Narrow','Roboto Condensed',system-ui,sans-serif;font-stretch:condensed;font-weight:700;font-size:clamp(32px,8vw,48px);line-height:1.05;margin:14px 0 6px;letter-spacing:-.01em}
.meta{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:14px;color:var(--muted);padding-bottom:16px;border-bottom:2px solid var(--ink)}
section{padding:20px 0 8px;border-bottom:1px solid var(--rule)}
section header{display:flex;align-items:baseline;gap:12px;margin-bottom:8px}
.n,.t{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;color:var(--muted);font-size:14px}
.t{margin-left:auto;white-space:nowrap}
h2{font-family:'Class Head','IBM Plex Sans Condensed','Arial Narrow','Roboto Condensed',system-ui,sans-serif;font-stretch:condensed;font-weight:700;font-size:28px;line-height:1.1;margin:0}
h3{font-size:16px;margin:18px 0 6px}
p{margin:0 0 10px}ul{margin:0 0 12px;padding-left:22px}li{margin:3px 0}
.lead{font-weight:600;font-size:18px}
.k{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:4px}
figure{margin:6px 0 12px}
figure video,figure img{display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;background:#0b1320;border-radius:10px;cursor:zoom-in}
.move{padding:4px 0 6px}
footer{margin-top:28px;font-size:13px;color:var(--muted)}
@media print{figure video,figure img{max-width:60mm;max-height:45mm}section{break-inside:avoid}}
`;

// Turns each clip's data: URL into a blob: URL, which every browser plays,
// and lets a tap open the clip full screen.
const SCRIPT = `
document.querySelectorAll('video[data-clip]').forEach(function(v){
  var src=v.getAttribute('src');
  if(src&&src.indexOf('data:')===0&&window.fetch&&window.URL){
    fetch(src).then(function(r){return r.blob()}).then(function(b){v.src=URL.createObjectURL(b);v.muted=true;v.play().catch(function(){})}).catch(function(){});
  }
  v.addEventListener('click',function(){
    if(v.requestFullscreen)v.requestFullscreen().catch(function(){});
    else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();
  });
});
`;

/** Technique's moves, or the ones another block holds, each with its clip. */
function moveCards(moves: Move[], clipData: Record<string, string>): string {
  return moves
    .filter((m) => m.name.trim() || m.notes.trim() || m.clip)
    .map((m, i) => {
      const name = m.name || t('untitledMove');
      const clip = m.clip ? clipTag(m.clip.id, name, m.clip.width, m.clip.height, clipData) : '';
      return `<div class="move"><h3>${esc(t('moveNamed', { n: i + 1, name }))}</h3>${clip}${para(m.notes)}</div>`;
    })
    .join('');
}

function blockBody(b: Block, clipData: Record<string, string>): string {
  switch (b.kind) {
    case 'warmup':
      return list(b.drills);
    case 'concept':
      return para(b.rule, 'lead') + para(b.notes);
    case 'game':
      return (
        `<p class="lead">${esc(b.start || t('startPosition'))} → ${esc(b.objective || t('objectiveLower'))}</p>` +
        (b.goals.length ? `<h3>${esc(t('goalsAndMovements'))}</h3>${list(b.goals)}` : '') +
        (b.details.length ? `<h3>${esc(t('details'))}</h3>${list(b.details)}` : '') +
        line(t('transition'), b.transition) +
        line(t('submission'), b.submission) +
        line(t('rounds'), `${describeGameRounds(b.rounds)} · ${t('restLower')} ${formatRest(b.rounds.restSeconds)}`)
      );
    case 'gems':
      return moveCards(b.moves, clipData) + (b.options.length ? `<h3>${esc(t('options'))}</h3>${list(b.options)}` : '');
    case 'freeRoll':
      return `<p>${b.rounds} × ${b.minutes} min · ${esc(t('restLower'))} ${esc(formatRest(b.restSeconds))}</p>${para(b.notes)}`;
    case 'wrapup':
      return para(b.question, 'lead') + para(b.notes);
  }
}

/** The whole class as one HTML page. `clipData` maps clip ids (and `<id>.poster`) to data URLs. Pure, so it can be tested. */
export function buildClassFile(plan: ClassPlan, clipData: Record<string, string> = {}): string {
  const title = plan.title || t('untitledClass');
  // `<` is escaped so no text in the plan can close the script tag early.
  const json = JSON.stringify(storedPlan(plan)).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${getLang() === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="${esc(APP_NAME)} class file 2">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="top">${LOGO}<span>${esc(t('classPlan'))}</span></div>
<h1>${esc(title)}</h1>
<div class="meta">${esc(formatDate(plan.date))} · ${esc(formatMinutes(totalMinutes(plan)))}</div>
${plan.blocks.map((b, i) => section(i + 1, blockLabel(b), formatMinutes(blockMinutes(b)), blockBody(b, clipData) + (b.kind !== 'gems' && b.moves ? moveCards(b.moves, clipData) : ''))).join('\n')}
<footer>${esc(t('classFileFooter', { app: APP_NAME }))}</footer>
</main>
<script type="application/json" id="${PLAN_ID}">${json}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

/** Builds the class file for a plan, with its clips from this device. */
export async function exportClassFile(plan: ClassPlan): Promise<Blob> {
  const [withClips] = await withClipData([plan]);
  return new Blob([buildClassFile(plan, withClips.clipData)], { type: 'text/html' });
}

export function looksLikeClassFile(text: string): boolean {
  return /^\s*<(!doctype|html)/i.test(text) && text.includes(`id="${PLAN_ID}"`);
}

/** Reads a class file back into a raw plan with its clips, ready for normalizePlan and restoreClipData. */
export function readClassFile(html: string): (ClassPlan & { clipData: Record<string, string> }) | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const json = doc.getElementById(PLAN_ID)?.textContent;
  if (!json) return null;
  let plan: ClassPlan | null;
  try {
    plan = normalizePlan(JSON.parse(json));
  } catch {
    return null;
  }
  if (!plan) return null;
  const clipData: Record<string, string> = {};
  doc.querySelectorAll('[data-clip]').forEach((el) => {
    const id = el.getAttribute('data-clip');
    const src = el.getAttribute('src');
    if (!id || !src?.startsWith('data:')) return;
    clipData[id] = src;
    const poster = el.getAttribute('poster');
    if (poster?.startsWith('data:')) clipData[id + POSTER] = poster;
  });
  return { ...plan, clipData };
}
