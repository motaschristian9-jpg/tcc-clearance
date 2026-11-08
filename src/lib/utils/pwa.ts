/**
 * Check if the web app is running in installed PWA standalone mode
 */
export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
  // @ts-expect-error iOS Safari legacy standalone property
  const isIOSStandalone = window.navigator?.standalone === true;

  return Boolean(isStandaloneMedia || isIOSStandalone);
}

/**
 * Check if the browser is an in-app browser (Messenger, Facebook, Instagram)
 * which cannot install PWAs
 */
export function checkIsInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return /FBAN|FBAV|Instagram|Messenger/i.test(ua);
}

/**
 * Check if device is iOS (iPhone/iPad)
 */
export function checkIsIOS(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return /iPad|iPhone|iPod/.test(ua);
}

/**
 * Check if viewport is desktop (>= 1024px)
 */
export function checkIsDesktop(width?: number): boolean {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  return w >= 1024;
}
