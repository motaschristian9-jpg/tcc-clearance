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
      setCopied(true);
    }
  };

  if (isInstalled) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-mono-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-mono-200 overflow-hidden text-mono-900">
        {/* Minimalist Monochrome Header */}
        <div className="border-b border-mono-200 p-6 text-center">
          <div className="w-12 h-12 bg-mono-900 text-white rounded-lg mx-auto flex items-center justify-center mb-3">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-mono-900">TCC Clearance App</h1>
          <p className="text-xs text-mono-500 font-mono mt-0.5">Tagoloan Community College</p>
        </div>

        <div className="p-6 space-y-6">
          {isInApp ? (
            <div className="space-y-4">
              <div className="p-4 bg-mono-100 border border-mono-300 rounded-lg text-mono-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <ExternalLink className="w-4 h-4 text-mono-900 flex-shrink-0" />
                  In-App Browser Detected
                </div>
                <p className="text-xs text-mono-600 leading-relaxed">
                  In-app browsers cannot install web apps or access offline biometric storage. Open in Chrome or Safari.
                </p>
              </div>

              <div className="text-xs text-mono-600 font-medium">
                1. Tap the three dots (•••) at top right.<br />
                2. Select <strong>"Open in Browser"</strong>.<br />
                Or copy the direct link below:
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full min-h-touch bg-mono-900 hover:bg-mono-800 text-white font-medium text-sm rounded-lg py-3 px-4 flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                {copied ? <Check className="w-4 h-4 text-mono-200" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Direct Link'}
              </button>
            </div>
          ) : isIosDevice ? (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-base font-bold text-mono-900">Install to Continue</h2>
                <p className="text-xs text-mono-500 mt-1">
                  Offline card stamps require home screen installation.
                </p>
              </div>

              <div className="border border-mono-200 rounded-lg p-4 space-y-3 text-xs text-mono-700">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-mono-100 text-mono-900 font-mono font-bold flex items-center justify-center flex-shrink-0 border border-mono-200">
                    1
                  </span>
                  <span>Tap <strong>Share</strong> <Share className="w-3.5 h-3.5 inline mx-0.5" /> in Safari.</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-mono-100 text-mono-900 font-mono font-bold flex items-center justify-center flex-shrink-0 border border-mono-200">
                    2
                  </span>
                  <span>Tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />.</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-mono-100 text-mono-900 font-mono font-bold flex items-center justify-center flex-shrink-0 border border-mono-200">
                    3
                  </span>
                  <span>Open <strong>TCC Clearance</strong> from your home screen.</span>
                </div>
              </div>

              <div className="p-3 bg-mono-100 rounded-lg text-xs text-mono-700 flex items-center gap-2 border border-mono-200">
                <ShieldCheck className="w-4 h-4 text-mono-900 flex-shrink-0" />
                <span>Works offline once installed.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div>
                <h2 className="text-base font-bold text-mono-900">Install to Continue</h2>
                <p className="text-xs text-mono-500 mt-1">
                  Install the official clearance app for offline scanning and card stamping.
                </p>
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full min-h-touch bg-mono-900 hover:bg-mono-800 text-white font-medium text-sm rounded-lg py-3 px-4 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <PlusSquare className="w-4 h-4" />
                Install Application
              </button>

              <p className="text-[11px] text-mono-400 font-mono">
                Browser Menu &rarr; Install app / Add to Home screen
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
