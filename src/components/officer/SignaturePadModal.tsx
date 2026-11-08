import React, { useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { X, Check, RotateCcw, PenTool } from 'lucide-react';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  officerName?: string;
  officerPosition?: string;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  officerName = 'SBO Auditor',
  officerPosition = 'College of Information Technology',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    // Set internal resolution matching display size
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(24, 24, 27)', // #18181b
      minWidth: 1.5,
      maxWidth: 3.5,
    });
    signaturePadRef.current = pad;

    return () => {
      pad.off();
      signaturePadRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  const handleSave = () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      alert('Please provide a signature before saving.');
      return;
    }
    const dataUrl = signaturePadRef.current.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-mono-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mono-200 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-xl text-mono-900">
        <div className="flex items-center justify-between pb-3 border-b border-mono-200">
          <div className="flex items-center gap-2">
            <PenTool className="size-4 text-mono-900" />
            <h3 className="font-bold text-base text-mono-900">Draw Official Signature</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-mono-400 hover:text-mono-900 rounded"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-xs text-mono-500">
          Your signature will be stamped onto student activity cards when you scan them.
        </p>

        {/* Signature Canvas Area */}
        <div className="relative border-2 border-dashed border-mono-300 rounded-xl bg-white overflow-hidden h-48 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none cursor-crosshair"
          />
          <div className="absolute bottom-3 left-4 pointer-events-none text-[11px] text-mono-400 font-mono">
            {officerName} &bull; {officerPosition}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 h-10 border border-mono-200 hover:bg-mono-100 text-mono-700 text-xs font-bold rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-10 bg-mono-950 hover:bg-mono-800 text-white text-xs font-bold rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Save Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};

