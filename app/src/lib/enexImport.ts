// Runs an Evernote import: note by note, each picture made into a clip and stored,
// then the class saved, so a stop or a full phone keeps what already came in.

import { clipSaveError, heldClips, putClip } from './clips.ts';
import { countNotes, noteToPlan, readEnex } from './evernote.ts';
import { imageToClip } from './gifClip.ts';
import { uid, type ClassPlan, type Clip } from './plan.ts';

export interface EnexProgress {
  note: number;
  notes: number;
  title: string;
  clip: number;
  clips: number;
}

export interface EnexResult {
  classes: number;
  clips: number;
  /** Pictures that could not be read; their technique cards come in without a clip. */
  skipped: number;
  /** Pictures the note shows but the export left out. */
  missing: number;
  /** Why the import ended early, in the coach's words (storage full). */
  error?: string;
}

export async function importEnex(
  text: string,
  save: (plan: ClassPlan) => void,
  onProgress: (p: EnexProgress) => void,
  stopped: () => boolean,
): Promise<EnexResult> {
  const notes = countNotes(text);
  const result: EnexResult = { classes: 0, clips: 0, skipped: 0, missing: 0 };
  let n = 0;
  for (const note of readEnex(text)) {
    if (stopped()) break;
    n++;
    const clips: Array<Clip | undefined> = [];
    for (let i = 0; i < note.images.length; i++) {
      onProgress({ note: n, notes, title: note.title, clip: i + 1, clips: note.images.length });
      if (stopped()) return done(result);
      const bytes = note.images[i];
      if (!bytes) {
        result.missing++;
        clips.push(undefined);
        continue;
      }
      let made;
      try {
        made = await imageToClip(bytes);
      } catch (e) {
        console.warn('A picture from Evernote could not be read.', e);
        result.skipped++;
        clips.push(undefined);
        continue;
      }
      const id = uid();
      heldClips.add(id);
      try {
        await putClip(id, made.blob, made.poster);
      } catch (e) {
        return done({ ...result, error: await clipSaveError(e, made.blob.size) });
      }
      clips.push({ id, width: made.width, height: made.height });
      result.clips++;
    }
    if (!note.images.length) onProgress({ note: n, notes, title: note.title, clip: 0, clips: 0 });
    save(noteToPlan(note, clips));
    result.classes++;
  }
  return done(result);
}

/**
 * Lets go of the import's clips once the saved classes hold them. The wait
 * covers a prune that read the classes before the last one was saved; a
 * stopped note's clips belong to no class, so a later prune takes them.
 */
function done(result: EnexResult): EnexResult {
  const held = [...heldClips];
  setTimeout(() => held.forEach((id) => heldClips.delete(id)), 5000);
  return result;
}
