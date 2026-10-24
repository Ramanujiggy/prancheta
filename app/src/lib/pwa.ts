// Install support. Chrome, Edge and Android fire `beforeinstallprompt`, which
// we hold onto so the app can offer its own Install button. Apple has no such
// event, so there we walk the coach through Share → Add to Home Screen (or
// File → Add to Dock on a Mac) instead.

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALLED_KEY = 'maestranada.installed';
const NUDGE_KEY = 'maestranada.installNudge';
const NUDGE_LIMIT = 2;
const NUDGE_GAP_MS = 7 * 24 * 60 * 60 * 1000;

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(ua = navigator.userAgent, platform = navigator.platform, touch = navigator.maxTouchPoints): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && touch > 1);
}

/** Apple keeps a home-screen app's storage apart from Safari's. */
export function isApple(): boolean {
  return isIOS() || /Macintosh/.test(navigator.userAgent);
}

/**
 * How this browser adds a web app, when it has no install event:
 * - `ios`: Safari, Chrome, Edge or Firefox on an iPhone or iPad (Share → Add to Home Screen)
 * - `ios-inapp`: the built-in browser of Instagram, Facebook, the Google app and the like,
 *   which can't add to the Home Screen, so the page has to be opened in Safari first
 * - `mac-safari`: Safari 17 or later on a Mac (File → Add to Dock)
 * - `android-menu`: Firefox and other Android browsers that only offer it in their menu
 */
export type ManualKind = 'ios' | 'ios-inapp' | 'mac-safari' | 'android-menu';

export function manualKind(ua = navigator.userAgent, platform = navigator.platform, touch = navigator.maxTouchPoints): ManualKind | null {
  if (isIOS(ua, platform, touch)) {
    const inApp = !/Safari\//.test(ua) || /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|GSA\/|Snapchat|TikTok|musical_ly/.test(ua);
    return inApp ? 'ios-inapp' : 'ios';
  }
  const mac = /Macintosh/.test(ua) && /Version\/(\d+)[\d.]* Safari\//.exec(ua);
  if (mac && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(ua)) return Number(mac[1]) >= 17 ? 'mac-safari' : null;
  // Chromium browsers on Android fire the install event; the rest use their menu.
  if (/Android/.test(ua) && !/Chrome\/|SamsungBrowser|EdgA/.test(ua)) return 'android-menu';
  return null;
}

/** Where this iOS browser keeps its Share button: Chrome puts it by the address. */
export function iosBrowser(ua = navigator.userAgent): 'safari' | 'chrome' | 'other' {
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return 'other';
  return 'safari';
}

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'prompt'; install: () => Promise<void> }
  | { kind: ManualKind }
  | { kind: 'none' };

/** True when there's something to show the coach: a button or the steps. */
export function canInstall(state: InstallState): boolean {
  return state.kind !== 'installed' && state.kind !== 'none';
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: nothing to remember it in.
  }
}

/** Remembers that the app was installed from this browser, so its tabs stop asking. */
function rememberInstalled(): void {
  writeStore(INSTALLED_KEY, '1');
}

export function useInstall(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone] = useState(isStandalone);
  const [installedHere, setInstalledHere] = useState(() => readStore(INSTALLED_KEY) === '1');

  useEffect(() => {
    if (standalone) rememberInstalled();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      rememberInstalled();
      setInstalledHere(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [standalone]);

  if (standalone) return { kind: 'installed' };
  // The browser only offers this when the app isn't installed, so it wins over
  // the remembered flag (the coach may have removed the app since).
  if (deferred) {
    return {
      kind: 'prompt',
      install: async () => {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') {
          rememberInstalled();
          setInstalledHere(true);
        }
        setDeferred(null);
      },
    };
  }
  if (installedHere) return { kind: 'installed' };
  const manual = manualKind();
  return manual ? { kind: manual } : { kind: 'none' };
}

/**
 * The install sheet opens by itself at most twice, a week apart, and never
 * once the app is installed. After that it's only a tap away in the top bar.
 */
export function installNudgeDue(now = Date.now()): boolean {
  const [count, last] = (readStore(NUDGE_KEY) ?? '0:0').split(':').map(Number);
  return (count || 0) < NUDGE_LIMIT && now - (last || 0) >= NUDGE_GAP_MS;
}

export function markInstallNudged(now = Date.now()): void {
  const [count] = (readStore(NUDGE_KEY) ?? '0:0').split(':').map(Number);
  writeStore(NUDGE_KEY, `${(count || 0) + 1}:${now}`);
}
