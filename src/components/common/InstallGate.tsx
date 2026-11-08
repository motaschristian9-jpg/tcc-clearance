import React, { useState, useEffect } from 'react';
import { checkIsStandalone, checkIsInAppBrowser, checkIsIOS, checkIsDesktop } from '@/lib/utils/pwa';
import { Share, PlusSquare, Copy, Check, Smartphone, ExternalLink, ShieldCheck, X, ArrowRight } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallGateProps {
  children: React.ReactNode;
}

export const InstallGate: React.FC<InstallGateProps> = ({ children }) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // SBO officers path is always unblocked
      if (window.location.pathname.startsWith('/sbo')) return true;
      return localStorage.getItem('tcc_pwa_dismissed') === 'true';
    }
    return false;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(true);
  const [isInApp, setIsInApp] = useState<boolean>(false);
  const [isIosDevice, setIsIosDevice] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHelperText, setInstallHelperText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    // If SBO portal, bypass immediately
    if (window.location.pathname.startsWith('/sbo')) {
      setIsDismissed(true);
      return;
    }

    if (checkIsDesktop()) {
      setIsInstalled(true);
      return;
    }

    const installed = checkIsStandalone();
    setIsInstalled(installed);
    setIsInApp(checkIsInAppBrowser());
    setIsIosDevice(checkIsIOS());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('tcc_pwa_dismissed', 'true');
    setIsDismissed(true);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
        setInstallHelperText('Tap your browser menu (⋮) and select "Add to Home screen" or "Install App".');
      }
    } else {
      // Browser didn't trigger beforeinstallprompt (e.g. Chrome already showed banner or requires manual install)
      setInstallHelperText('Tap your browser menu (⋮) at top right and tap "Install app" or "Add to Home screen".');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
    }
  };

  // If installed or dismissed or desktop or SBO: show the app
  if (isInstalled || isDismissed) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-mono-50 flex flex-col justify-center items-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-mono-200 overflow-hidden text-mono-900 shadow-sm">
        {/* Simple Header */}
        <div className="border-b border-mono-200 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-mono-950 text-white rounded-xl flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-mono-900 leading-none">TCC Clearance App</h1>
              <p className="text-[11px] text-mono-500 mt-0.5">Tagoloan Community College</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close and continue to browser"
            className="p-1.5 rounded-lg border border-mono-200 text-mono-400 hover:text-mono-950 hover:bg-mono-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isInApp ? (
            <div className="space-y-4">
              <div className="p-4 bg-mono-100 border border-mono-200 rounded-xl text-mono-900">
                <div className="flex items-center gap-2 font-bold text-xs mb-1">
                  <ExternalLink className="w-4 h-4 text-mono-900 flex-shrink-0" />
                  <span>Open in Chrome or Safari</span>
                </div>
                <p className="text-xs text-mono-600 leading-relaxed">
                  Facebook and Messenger browsers cannot use camera features properly. Please open in your phone's browser.
                </p>
              </div>

              <div className="text-xs text-mono-600 font-medium">
                1. Tap the three dots (•••) at the top right.<br />
                2. Tap <strong>"Open in Chrome"</strong> or <strong>"Open in Safari"</strong>.
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full min-h-touch bg-mono-900 hover:bg-mono-800 text-white font-medium text-xs rounded-lg py-3 px-4 flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                {copied ? <Check className="w-4 h-4 text-mono-200" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          ) : isIosDevice ? (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-base font-bold text-mono-900">Install to Home Screen</h2>
                <p className="text-xs text-mono-500 mt-1">
                  Install the app on your phone for full offline speed and instant access.
                </p>
              </div>

              <div className="border border-mono-200 rounded-xl p-4 space-y-3 text-xs text-mono-700">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-mono-100 text-mono-900 font-bold flex items-center justify-center flex-shrink-0 border border-mono-200">
                    1
                  </span>
                  <span>Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5" /> at the bottom of Safari.</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-mono-100 text-mono-900 font-bold flex items-center justify-center flex-shrink-0 border border-mono-200">
                    2
                  </span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />.</span>
                </div>
              </div>

              <div className="p-3 bg-mono-100 rounded-lg text-xs text-mono-700 flex items-center gap-2 border border-mono-200">
                <ShieldCheck className="w-4 h-4 text-mono-900 flex-shrink-0" />
                <span>Works 100% offline once added.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div>
                <h2 className="text-base font-bold text-mono-900">Install Clearance App</h2>
                <p className="text-xs text-mono-500 mt-1">
                  Install on your phone to scan and view your activity card offline.
                </p>
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full min-h-touch bg-mono-950 hover:bg-mono-800 text-white font-bold text-xs rounded-xl py-3 px-4 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <PlusSquare className="w-4 h-4" />
                <span>Install App</span>
              </button>

              {installHelperText && (
                <div className="p-3 bg-mono-100 border border-mono-200 rounded-lg text-xs text-mono-800 font-medium text-left">
                  {installHelperText}
                </div>
              )}
            </div>
          )}

          {/* BYPASS / CONTINUE IN BROWSER BUTTON (Never traps the user!) */}
          <div className="pt-2 border-t border-mono-100">
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full min-h-touch border border-mono-300 hover:border-mono-900 text-mono-900 font-bold text-xs rounded-xl py-2.5 px-4 transition active:scale-[0.98] flex items-center justify-center gap-1.5 bg-white"
            >
              <span>Continue in Browser</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
