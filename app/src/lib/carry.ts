// Carrying classes to a fresh copy of the app. On Apple the Home Screen app
// keeps its own storage, apart from Safari's, and a new web address starts
// empty too. The clipboard is shared by all of them, so the coach copies the
// classes on one side and pastes them on the other. Nothing runs by itself.

import { storedPlan, type ClassPlan } from './plan.ts';
import { withClipData } from './clips.ts';

const CARRIED_KEY = 'maestranada.carryDone';

/** Everything the coach has, clips included, as backup JSON. */
async function carryText(plans: ClassPlan[]): Promise<string> {
  return JSON.stringify((await withClipData(plans)).map(storedPlan));
}

/**
 * Puts every class on the clipboard. Safari only lets a tap write to the
 * clipboard straight away, and reading clips takes a moment, so the text is
 * handed over as a promise it waits on. Returns false when the browser said no.
 */
export async function copyClasses(plans: ClassPlan[]): Promise<boolean> {
  const text = carryText(plans);
  try {
    if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
      const blob = text.then((s) => new Blob([s], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    }
  } catch {
    // Fall through to plain text, which some browsers allow when this isn't.
  }
  try {
    await navigator.clipboard.writeText(await text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The classes in copied or backed-up text: a list of saved classes. A single
 * class an AI wrote is something else, so this says null for it.
 */
export function readBackup(text: string | null): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse((text ?? '').trim());
    return Array.isArray(parsed) && parsed.some((p) => p && typeof p === 'object' && 'createdAt' in p) ? parsed : null;
  } catch {
    return null;
  }
}

/** What's on the clipboard, or null when the browser refused to say. */
export async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * Nothing of the coach's own here yet: no classes, or only the example that
 * every fresh copy starts with. That's when classes may be waiting elsewhere.
 */
export function freshCopy(plans: ClassPlan[]): boolean {
  return plans.every((p) => p.updatedAt === p.createdAt);
}

/** The paste offer shows until the coach pastes or closes it, then never again. */
export function carryOfferDone(): boolean {
  try {
    return localStorage.getItem(CARRIED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markCarryDone(): void {
  try {
    localStorage.setItem(CARRIED_KEY, '1');
  } catch {
    // Private mode: nothing to remember it in.
  }
}
