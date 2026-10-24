// The app's colors. Auto follows the phone: light by day, navy at night. A
// coach can pin one look instead, and the choice is kept on this device. The
// look is a data-theme attribute on <html>; styles.css holds the colors.
// index.html sets the attribute before the first paint, with the same rules
// as resolveTheme below, so the app never flashes the wrong color.

import { useSyncExternalStore } from 'react';

export type Theme = 'auto' | 'navy' | 'slate' | 'tan' | 'light' | 'dark';
export type Look = Exclude<Theme, 'auto'>;

export const THEMES: Theme[] = ['auto', 'navy', 'slate', 'tan', 'light', 'dark'];

const KEY = 'prancheta.theme';

/** The page color of each look, for the browser bar and the phone's status bar. */
export const PAPER: Record<Look, string> = {
  light: '#f8f9fb',
  navy: '#0f1a2b',
  slate: '#181b22',
  tan: '#1d1610',
  dark: '#161616',
};

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (THEMES as string[]).includes(saved)) return saved as Theme;
  } catch {
    // No storage: follow the phone.
  }
  return 'auto';
}

let current: Theme = initialTheme();
const listeners = new Set<() => void>();

export function resolveTheme(theme: Theme, phoneDark: boolean): Look {
  if (theme !== 'auto') return theme;
  return phoneDark ? 'navy' : 'light';
}

export function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const look = resolveTheme(current, !!darkQuery?.matches);
  document.documentElement.dataset.theme = look;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAPER[look]);
}

// On Auto, turning the phone's dark mode on or off switches the app with it.
darkQuery?.addEventListener?.('change', () => {
  if (current === 'auto') applyTheme();
});

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  if (theme === current) return;
  current = theme;
  try {
    if (theme === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Private mode: the choice lasts until the app closes.
  }
  applyTheme();
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    getTheme,
    getTheme,
  );
}
