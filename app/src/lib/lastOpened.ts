// The class the coach opened last, so the library's Teach button follows it
// instead of always pointing at the next class by date. Kept for this visit
// only: tomorrow the button goes back to the next class.

const KEY = 'maestranada.lastOpened';

export function rememberOpened(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // Blocked storage: the button just keeps pointing at the next class.
  }
}

export function lastOpened(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
