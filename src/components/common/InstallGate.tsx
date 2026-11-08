import React, { useState, useEffect } from 'react';
import { checkIsStandalone, checkIsInAppBrowser, checkIsIOS, checkIsDesktop } from '@/lib/utils/pwa';
import { Share, PlusSquare, Copy, Check, Smartphone, ExternalLink, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallGateProps {
  children: React.ReactNode;
}

export const InstallGate: React.FC<InstallGateProps> = ({ children }) => {
  const [isInstalled, setIsInstalled] = useState<boolean>(true);
  const [isInApp, setIsInApp] = useState<boolean>(false);
  const [isIosDevice, setIsIosDevice] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    // 1. Desktop devices (e.g. Officer Dashboard) skip the install gate
    if (checkIsDesktop()) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if already installed
    const installed = checkIsStandalone();
    setIsInstalled(installed);

    // 3. Check for in-app browser (FB/Messenger)
    setIsInApp(checkIsInAppBrowser());

    // 4. Check if iOS
    setIsIosDevice(checkIsIOS());

    // 5. Intercept Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
    }
  };

  // If installed or on desktop, bypass gate and render children
  if (isInstalled) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-slate-900">
        {/* Header */}
        <div className="bg-blue-900 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Smartphone className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">TCC Event Clearance</h1>
          <p className="text-xs text-blue-200 mt-1 uppercase tracking-wider font-semibold">
            Tagoloan Community College
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* IN-APP BROWSER DETECTED (Messenger/Facebook) */}
          {isInApp ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <ExternalLink className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  In-App Browser Detected
                </div>
                <p className="text-sm">
                  Facebook/Messenger cannot install this app or run camera verification. Please open this link in your standard browser.
                </p>
              </div>

              <div className="text-sm font-semibold text-slate-700">
                1. Tap the three dots (•••) at top right.<br />
                2. Tap <span className="text-blue-700 font-bold">"Open in Chrome / Safari"</span>.<br />
                Or copy the direct link below:
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full min-h-touch bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl py-3 px-4 flex items-center justify-center gap-2 transition active:scale-95 shadow"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Link Copied to Clipboard!' : 'Copy Direct Link'}
              </button>
            </div>
          ) : isIosDevice ? (
            /* IOS SAFARI INSTALL GUIDE */
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-900">Install to Continue</h2>
                <p className="text-sm text-slate-600 mt-1">
                  The clearance app must be added to your home screen to enable offline security and digital card stamps.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div>
                    Tap the <strong className="text-slate-900">Share</strong> button <Share className="w-4 h-4 inline text-blue-600 mx-1" /> at the bottom of Safari.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div>
                    Scroll down and tap <strong className="text-slate-900">"Add to Home Screen"</strong> <PlusSquare className="w-4 h-4 inline text-slate-700 mx-1" />.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div>
                    Open <strong className="text-slate-900">TCC Clearance</strong> from your home screen.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <span>Works 100% offline once added to your home screen.</span>
              </div>
            </div>
          ) : (
            /* ANDROID / CHROME INSTALL PROMPT */
            <div className="space-y-4 text-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Install to Continue</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Install the official TCC Event Clearance app on your device to access offline QR scans and your clearance activity card.
                </p>
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full min-h-touch bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-2xl py-3.5 px-4 shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                <PlusSquare className="w-5 h-5 text-amber-400" />
                Install TCC Clearance App
              </button>

              <p className="text-xs text-slate-500">
                Or tap the browser menu (⋮) and select <span className="font-semibold text-slate-700">"Install app"</span> or <span className="font-semibold text-slate-700">"Add to Home Screen"</span>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
