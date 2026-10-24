import { installNudgeDue, iosBrowser, manualKind, markInstallNudged } from './pwa.ts';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.0',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari16:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0',
};

describe('install', () => {
  it('knows how each browser adds the app', () => {
    expect(manualKind(UA.iphoneSafari, 'iPhone', 5)).toBe('ios');
    expect(manualKind(UA.iphoneChrome, 'iPhone', 5)).toBe('ios');
    expect(manualKind(UA.instagram, 'iPhone', 5)).toBe('ios-inapp');
    expect(manualKind(UA.ipadDesktopMode, 'MacIntel', 5)).toBe('ios');
    expect(manualKind(UA.ipadDesktopMode, 'MacIntel', 0)).toBe('mac-safari');
    expect(manualKind(UA.macSafari16, 'MacIntel', 0)).toBeNull();
    expect(manualKind(UA.macChrome, 'MacIntel', 0)).toBeNull();
    expect(manualKind(UA.androidChrome, 'Linux armv8l', 5)).toBeNull();
    expect(manualKind(UA.androidFirefox, 'Linux armv8l', 5)).toBe('android-menu');
  });

  it('points Chrome on iPhone to its own Share button', () => {
    expect(iosBrowser(UA.iphoneChrome)).toBe('chrome');
    expect(iosBrowser(UA.iphoneSafari)).toBe('safari');
  });

  it('opens the install sheet by itself twice at most, a week apart', () => {
    localStorage.clear();
    const day = 24 * 60 * 60 * 1000;
    expect(installNudgeDue(0 + 8 * day)).toBe(true);
    markInstallNudged(8 * day);
    expect(installNudgeDue(10 * day)).toBe(false);
    expect(installNudgeDue(15 * day)).toBe(true);
    markInstallNudged(15 * day);
    expect(installNudgeDue(60 * day)).toBe(false);
  });
});
