// Technique clips live in IndexedDB, not localStorage: a few clips would
// blow through localStorage's ~5 MB. A plan only holds the clip's id, so plans
// stay small JSON. A clip is a short MP4 (older ones are GIFs), stored beside
// a still frame under `<id>.poster` for paper and Word.
//
// Bytes go in as an ArrayBuffer plus a type rather than as a Blob: Safari on
// iPhone has a long history of failing to store Blobs in IndexedDB.

import { useEffect, useState } from 'react';
import { allMoves, type ClassPlan, type Clip } from './plan.ts';
import { t } from './i18n.ts';

const DB_NAME = 'maestranada'; // the app's first name; kept so saved clips still load
const STORE = 'clips';
const POSTER = '.poster';

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

interface Stored {
  type: string;
  data: ArrayBuffer;
}

function toBlob(v: unknown): Blob | undefined {
  if (v instanceof Blob) return v; // clips saved before bytes were stored as buffers
  const s = v as Stored | undefined;
  return s && s.data instanceof ArrayBuffer ? new Blob([s.data], { type: s.type }) : undefined;
}

/** Saves a clip and its still frame together, so neither is ever stored without the other. */
export async function putClip(id: string, blob: Blob, poster?: Blob): Promise<void> {
  // Ask the browser not to evict the coach's clips under storage pressure.
  void navigator.storage?.persist?.().catch(() => {});
  const entries: Array<[string, Stored]> = [[id, { type: blob.type, data: await blob.arrayBuffer() }]];
  if (poster) entries.push([id + POSTER, { type: poster.type, data: await poster.arrayBuffer() }]);
  await run('readwrite', (s) => void entries.forEach(([k, v]) => s.put(v, k)));
}

export function getClip(id: string): Promise<Blob | undefined> {
  return run<unknown>('readonly', (s) => s.get(id)).then(toBlob);
}

/** A still image of the clip: its saved frame, or the GIF itself for older clips. */
export async function getClipStill(id: string): Promise<Blob | undefined> {
  const poster = await run<unknown>('readonly', (s) => s.get(id + POSTER)).then(toBlob);
  if (poster) return poster;
  const clip = await getClip(id);
  return clip?.type.startsWith('image/') ? clip : undefined;
}

export function deleteClip(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id));
}

/** Plain words for why a clip could not be saved. */
export async function clipSaveError(e: unknown, bytes: number): Promise<string> {
  const name = (e as Error | null)?.name ?? '';
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const full = name === 'QuotaExceededError' || (est?.quota !== undefined && est.usage !== undefined && est.quota - est.usage < bytes);
  if (full) return t('clipNoRoom');
  return t('clipSaveFailed', { reason: name ? ` (${name})` : '' });
}

export function clipIds(plans: ClassPlan[]): Set<string> {
  const ids = new Set<string>();
  for (const p of plans) for (const m of allMoves(p)) if (m.clip) ids.add(m.clip.id);
  return ids;
}

/** Clips stored for a class that isn't saved yet (an import in progress). Pruning leaves them alone. */
export const heldClips = new Set<string>();

/** Removes stored clips no plan points at any more (a replaced clip, a deleted class). */
export async function pruneClips(plans: ClassPlan[]): Promise<void> {
  const keep = clipIds(plans);
  const keys = await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  const owner = (k: string) => (k.endsWith(POSTER) ? k.slice(0, -POSTER.length) : k);
  // Held clips are checked last, as an import may have stored one while the keys were read.
  const drop = (k: string) => !keep.has(owner(k)) && !heldClips.has(owner(k));
  await Promise.all(keys.map(String).filter(drop).map((k) => deleteClip(k)));
}

export interface ClipState {
  url: string | null;
  /** True for a video clip, false for a GIF. */
  video: boolean;
  /** The plan points at a clip this device no longer has. */
  missing: boolean;
}

/** The clip's object URL and what kind of media it is. */
export function useClip(clip: Clip | undefined, load: (id: string) => Promise<Blob | undefined> = getClip): ClipState {
  const empty: ClipState = { url: null, video: false, missing: false };
  const [state, setState] = useState<ClipState>(empty);
  const id = clip?.id;
  useEffect(() => {
    setState(empty);
    if (!id) return;
    let live = true;
    let made: string | null = null;
    load(id)
      .then((blob) => {
        if (!live) return;
        if (!blob) {
          setState({ ...empty, missing: true });
          return;
        }
        made = URL.createObjectURL(blob);
        setState({ url: made, video: blob.type.startsWith('video/'), missing: false });
      })
      .catch(() => live && setState({ ...empty, missing: true }));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return state;
}

/** A still frame of the clip, for paper. */
export function useClipStill(clip: Clip | undefined): string | null {
  return useClip(clip, getClipStill).url;
}

// ─── Backups: clips travel inside the exported JSON as data URLs ─────────────

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return new Blob([bytes], { type: m[1] || 'application/octet-stream' });
}

/** Plans plus their clips (and still frames), ready to write to a backup or class file. */
export async function withClipData(plans: ClassPlan[]): Promise<Array<ClassPlan & { clipData?: Record<string, string> }>> {
  return Promise.all(
    plans.map(async (p) => {
      const clipData: Record<string, string> = {};
      for (const m of allMoves(p)) {
        if (!m.clip) continue;
        const id = m.clip.id;
        const blob = await getClip(id).catch(() => undefined);
        if (!blob) continue;
        clipData[id] = await blobToDataUrl(blob);
        const poster = await run<unknown>('readonly', (s) => s.get(id + POSTER)).then(toBlob, () => undefined);
        if (poster) clipData[id + POSTER] = await blobToDataUrl(poster);
      }
      return Object.keys(clipData).length ? { ...p, clipData } : p;
    }),
  );
}

/** Stores any clips carried in an imported backup. */
export async function restoreClipData(raw: unknown[]): Promise<void> {
  for (const r of raw) {
    const data = (r as { clipData?: unknown } | null)?.clipData;
    if (!data || typeof data !== 'object') continue;
    const entries = data as Record<string, unknown>;
    for (const [id, url] of Object.entries(entries)) {
      if (id.endsWith(POSTER)) continue;
      const blob = typeof url === 'string' ? dataUrlToBlob(url) : null;
      const poster = typeof entries[id + POSTER] === 'string' ? dataUrlToBlob(entries[id + POSTER] as string) : null;
      if (blob) await putClip(id, blob, poster ?? undefined);
    }
  }
}
