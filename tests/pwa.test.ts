import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkIsStandalone,
  checkIsInAppBrowser,
  checkIsIOS,
  checkIsDesktop,
} from '../src/lib/utils/pwa';

describe('PWA and Browser Detection Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { window: unknown }).window = {
      matchMedia: vi.fn(),
      navigator: {},
      innerWidth: 1024,
    };
  });

  it('detects standalone mode from window.matchMedia', () => {
    // Mock matchMedia for standalone
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(checkIsStandalone()).toBe(true);
  });

  it('detects in-app browsers like FB and Messenger', () => {
    const fbUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/16.5;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]';
    expect(checkIsInAppBrowser(fbUserAgent)).toBe(true);

    const chromeUserAgent = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';
    expect(checkIsInAppBrowser(chromeUserAgent)).toBe(false);
  });

  it('detects iOS user agent', () => {
    const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(checkIsIOS(iosUA)).toBe(true);

    const androidUA = 'Mozilla/5.0 (Linux; Android 14)';
    expect(checkIsIOS(androidUA)).toBe(false);
  });

  it('detects desktop screen width >= 1024px', () => {
    expect(checkIsDesktop(1280)).toBe(true);
    expect(checkIsDesktop(420)).toBe(false);
  });
});
