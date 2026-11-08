import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { compressImageToDimensions } from '@/lib/camera/faceDetector';

interface LivePhotoCaptureProps {
  onPhotoCaptured: (photo480Url: string, thumb160Url: string) => void;
  onCancel?: () => void;
}

export const LivePhotoCapture: React.FC<LivePhotoCaptureProps> = ({ onPhotoCaptured, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraError('Unable to open front camera. Please ensure camera permissions are allowed.');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Mirror horizontally for natural selfie view
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Generate 480px JPEG and 160px thumbnail
      const photo480 = await compressImageToDimensions(canvas, 480, 0.85);
      const thumb160 = await compressImageToDimensions(canvas, 160, 0.80);

      setCapturedPreview(photo480);
      onPhotoCaptured(photo480, thumb160);
    } catch (err) {
      setCameraError((err as Error).message || 'Failed to capture photo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera();
  };

  return (
    <div className="space-y-4 max-w-sm mx-auto text-mono-900">
      <div className="text-center">
        <h3 className="text-base font-bold text-mono-900">Take Live Student Photo</h3>
        <p className="text-xs text-mono-500 mt-0.5">
          Look directly at the front camera and center your face in the oval.
        </p>
      </div>

      {cameraError ? (
        <div className="p-4 bg-mono-100 border border-mono-300 rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-mono-900">
            <AlertCircle className="size-4 text-mono-900 flex-shrink-0" />
            <span>Camera Access Needed</span>
          </div>
          <p className="text-mono-600">{cameraError}</p>
          <button
            type="button"
            onClick={startCamera}
            className="w-full h-9 bg-mono-950 text-white rounded-lg font-bold text-xs mt-2"
          >
            Try Again
          </button>
        </div>
      ) : capturedPreview ? (
        /* Captured Photo Preview */
        <div className="space-y-4">
          <div className="relative aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden border-2 border-mono-900">
            <img src={capturedPreview} alt="Captured student" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 bg-mono-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="size-3" />
              <span>Face Checked</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetake}
              className="flex-1 h-10 border border-mono-300 hover:border-mono-900 text-mono-900 font-bold text-xs rounded-lg transition active:scale-[0.98]"
            >
              Retake Photo
            </button>
          </div>
        </div>
      ) : (
        /* Live Camera Stream with Oval Guide */
        <div className="space-y-4">
          <div className="relative aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-mono-950 border border-mono-300 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Oval Face Guide Overlay (AC1 Requirement) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[70%] h-[80%] rounded-[50%] border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"></div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="text-center text-[11px] text-mono-400 font-medium">
            Make sure your face is well-lit with no sunglasses or face coverings.
          </div>

          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 h-10 border border-mono-200 text-mono-600 rounded-lg text-xs font-medium hover:bg-mono-100"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleCapture}
              disabled={isProcessing}
              className="flex-1 h-10 bg-mono-950 hover:bg-mono-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              {isProcessing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              <span>Take Photo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
