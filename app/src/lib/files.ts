// Getting a file out of the app. On a phone the share sheet is the natural
// way to save to Files, send by email or open in Word; on a computer it's a
// plain download.

import { useEffect, useState } from 'react';

// iOS only opens the share sheet straight after a tap. Building a backup or
// a document takes long enough that the tap can expire, so the file is then
// held here and a "Save" button offers it on the next tap.
type Listener = (file: File | null) => void;
let pending: File | null = null;
const listeners = new Set<Listener>();
function setPending(file: File | null) {
  pending = file;
  listeners.forEach((l) => l(file));
}

async function share(file: File): Promise<'done' | 'expired' | 'failed'> {
  try {
    await navigator.share({ files: [file], title: file.name });
    return 'done';
  } catch (e) {
    const name = (e as Error).name;
    // Closing the share sheet is a choice, not a failure.
    if (name === 'AbortError') return 'done';
    return name === 'NotAllowedError' ? 'expired' : 'failed';
  }
}

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    const result = await share(file);
    if (result === 'done') return;
    if (result === 'expired') {
      setPending(file);
      return;
    }
  }
  download(blob, filename);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The file waiting for a tap, and the handler that saves it. */
export function usePendingFile(): { file: File | null; save: () => void; dismiss: () => void } {
  const [file, setFile] = useState<File | null>(pending);
  useEffect(() => {
    listeners.add(setFile);
    return () => void listeners.delete(setFile);
  }, []);
  return {
    file,
    save: () => {
      if (!pending) return;
      const f = pending;
      setPending(null);
      void share(f).then((r) => r === 'done' || download(f, f.name));
    },
    dismiss: () => setPending(null),
  };
}

export function fileSlug(title: string, fallback = 'class'): string {
  const slug = (title || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // "Saídas da montada" → "saidas-da-montada"
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}
