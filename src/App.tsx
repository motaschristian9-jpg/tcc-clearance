import React, { useState, useEffect } from 'react';
import { InstallGate } from './components/common/InstallGate';
import {
  generateECDSAKeyPair,
  exportPublicKeyRaw,
  createStudentQRToken,
  packTokenToString,
  verifyStudentQRToken,
} from './lib/crypto/tokens';
import { QRCodeSVG } from './components/common/QRCode';
import { Shield, Key, RefreshCw, CheckCircle2, AlertTriangle, Smartphone, UserCheck } from 'lucide-react';

export default function App() {
  const [keys, setKeys] = useState<{ privateKey: CryptoKey; publicKeyRaw: string } | null>(null);
  const [studentId, setStudentId] = useState('TCC-2023-01042');
  const [department, setDepartment] = useState('CIT');
  const [eventId, setEventId] = useState('cit-intramurals-2026');
  const [tokenString, setTokenString] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Initialize WebCrypto key pair
  useEffect(() => {
    async function initCrypto() {
      const keyPair = await generateECDSAKeyPair(false);
      const rawPub = await exportPublicKeyRaw(keyPair.publicKey);
      setKeys({ privateKey: keyPair.privateKey, publicKeyRaw: rawPub });
    }
    initCrypto();
  }, []);

  // 30s rotating token timer
  useEffect(() => {
    if (!keys) return;

    async function rotateToken() {
      if (!keys) return;
      const token = await createStudentQRToken({
        studentId,
        eventId,
        privateKey: keys.privateKey,
      });
      const packed = packTokenToString(token);
      setTokenString(packed);
      setSecondsRemaining(30);

      // Auto verify in simulation
      const result = await verifyStudentQRToken({
        tokenString: packed,
        publicKeyRaw: keys.publicKeyRaw,
        expectedEventId: eventId,
      });
      setVerificationResult(result);
    }

    rotateToken();

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          rotateToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [keys, studentId, eventId]);

  const handleManualVerify = async () => {
    if (!keys || !tokenString) return;
    setIsVerifying(true);
    const start = performance.now();
    const result = await verifyStudentQRToken({
      tokenString,
      publicKeyRaw: keys.publicKeyRaw,
      expectedEventId: eventId,
    });
    const duration = performance.now() - start;
    setVerificationResult({ ...result, durationMs: duration.toFixed(2) });
    setIsVerifying(false);
  };

  return (
    <InstallGate>
      <div className="min-h-screen bg-slate-100 text-slate-900 pb-12">
        {/* Navigation Bar */}
        <header className="bg-blue-900 text-white shadow-md sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-400 text-blue-900 font-extrabold rounded-xl flex items-center justify-center text-lg shadow">
                TCC
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight">Activity Card Clearance</h1>
                <p className="text-xs text-blue-200">Tagoloan Community College</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 font-medium px-2.5 py-1 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Phase 0 Active
              </span>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-blue-900 tracking-wide uppercase bg-blue-50 px-2.5 py-1 rounded-lg">
                  Phase 0: Cryptographic Validation
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                  Offline ECDSA Token & Signature Engine
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-xl">
                  Simulating on-device non-extractable WebCrypto ECDSA P-256 keys, 30-second token rotation, and 0ms offline verification without server calls.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <Shield className="w-6 h-6 text-blue-900" />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">AC6 / AC10 Protocol</div>
                  <div className="text-emerald-600 font-medium">100% Offline Capable</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Student View (Rotating QR) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Smartphone className="w-5 h-5 text-blue-800" />
                    <span>Student Phone Screen</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Expires in {secondsRemaining}s</span>
                  </div>
                </div>

                {/* Student Info Card */}
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Student ID / Dept</span>
                    <strong className="text-slate-900 font-semibold">{studentId} ({department})</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Event ID</span>
                    <strong className="text-slate-900 font-semibold">{eventId}</strong>
                  </div>
                </div>

                {/* QR Display */}
                <div className="my-6 flex flex-col items-center justify-center">
                  <div className="p-4 bg-white rounded-2xl shadow-md border-2 border-slate-900 inline-block">
                    {tokenString ? (
                      <QRCodeSVG value={tokenString} size={200} />
                    ) : (
                      <div className="w-[200px] h-[200px] bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400">
                        Generating Key...
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Rotating every 30 seconds. Screenshots expire immediately.
                  </p>
                </div>
              </div>

              {/* Raw Token string */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono break-all text-slate-600">
                <span className="text-slate-400 block mb-1 font-sans font-bold">QR Token Payload ({tokenString.length} chars):</span>
                {tokenString || 'Generating...'}
              </div>
            </div>

            {/* SBO Scanner Verification View */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <UserCheck className="w-5 h-5 text-emerald-700" />
                    <span>SBO Scanner Engine</span>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                    Target: &lt; 300 ms
                  </span>
                </div>

                {/* Scanner verification result card */}
                <div className="mt-4 space-y-4">
                  {verificationResult?.valid ? (
                    <div className="p-5 bg-emerald-50 border-2 border-emerald-500 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                        <div>
                          <h3 className="font-extrabold text-emerald-900 text-base leading-tight">
                            VALID STUDENT CHECK-IN
                          </h3>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            ECDSA P-256 signature verified offline
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-emerald-200 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-emerald-700 block">Verified Student:</span>
                          <strong className="text-emerald-950 font-bold">{verificationResult.payload?.sid}</strong>
                        </div>
                        <div>
                          <span className="text-emerald-700 block">Time Window:</span>
                          <strong className="text-emerald-950 font-bold">#{verificationResult.payload?.w}</strong>
                        </div>
                        <div>
                          <span className="text-emerald-700 block">Clock Status:</span>
                          <strong className="text-emerald-950 font-bold">
                            {verificationResult.isClockDrifted ? '±1 Window Drift' : 'Perfect Sync'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-emerald-700 block">Verification Speed:</span>
                          <strong className="text-emerald-950 font-bold">
                            {verificationResult.durationMs ? `${verificationResult.durationMs} ms` : '&lt; 20 ms'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bg-red-50 border-2 border-red-500 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                        <div>
                          <h3 className="font-extrabold text-red-900 text-base">VERIFICATION FAILED</h3>
                          <p className="text-xs text-red-700 mt-0.5">
                            {verificationResult?.reason || 'Awaiting verification'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Public Key Display */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Key className="w-3.5 h-3.5 text-blue-900" />
                      <span>Student Public Key (SPKI Base64URL):</span>
                    </div>
                    <div className="font-mono text-[10px] break-all text-slate-500">
                      {keys?.publicKeyRaw || 'Loading...'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleManualVerify}
                  disabled={isVerifying}
                  className="w-full min-h-touch bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-2xl py-3 px-4 shadow transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
                  Test Offline Verification Speed
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </InstallGate>
  );
}
