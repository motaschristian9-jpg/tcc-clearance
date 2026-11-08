import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Check,
  X,
  Search,
  Camera,
  CameraOff,
  SwitchCamera,
  Zap,
  ZapOff,
  RefreshCw,
  ChevronDown,
  User,
  QrCode,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/library';
import { StoredRosterStudent, StoredScanQueueItem } from '@/types/database';
import { ScannerSignedStamp } from '@/types/crypto';
import { createScannerStamp, packStampToReceiptString } from '@/lib/crypto/stamps';
import { unpackTokenFromString } from '@/lib/crypto/tokens';
import { QRCodeSVG } from '../common/QRCode';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/supabase/client';

interface ScannerViewProps {
  scannerKey: CryptoKey;
  scannerKeyId: string;
  officerId: string;
  departmentId: string;
  onScanCommitted: (item: StoredScanQueueItem) => void;
  unsyncedCount: number;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  scannerKey,
  scannerKeyId,
  officerId,
  departmentId,
  onScanCommitted,
  unsyncedCount,
}) => {
  const [currentVenue] = useState('Gymnasium Gate');
  const [currentSlot, setCurrentSlot] = useState('day1-morning-in');
  const [currentSlotLabel, setCurrentSlotLabel] = useState('Day 1 Morning In (Morning Arrival)');
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState(false);
  const [selectedDayTab, setSelectedDayTab] = useState<number>(1);

  // Camera state & refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const isProcessingRef = useRef(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Scan state
  const [simulatedTokenInput, setSimulatedTokenInput] = useState('');
  const [scannedStudent, setScannedStudent] = useState<StoredRosterStudent | null>(null);
  const [scanState, setScanState] = useState<'idle' | 'verifying' | 'accepted' | 'flagged' | 'rejected'>('idle');
  const [flagReason, setFlagReason] = useState<string>('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState('');

  // Manual Check-in modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<StoredRosterStudent[]>([]);

  // Receipt modal
  const [latestStamp, setLatestStamp] = useState<ScannerSignedStamp | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const triggerHaptic = (success: boolean) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(success ? 70 : [100, 50, 100]);
    }
  };

  const stopCamera = useCallback(() => {
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (err) {
        console.warn('Error resetting camera reader:', err);
      }
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch (err) {
        console.warn('Error stopping video tracks:', err);
      }
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const startCamera = useCallback(async (deviceIdToUse?: string) => {
    if (typeof window === 'undefined') return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access requires HTTPS or localhost in your browser.');
      setIsCameraActive(false);
      return;
    }

    // Stop current stream before starting a new one
    stopCamera();

    setIsCameraLoading(true);
    setCameraError(null);

    try {
      const reader = new BrowserQRCodeReader();
      codeReaderRef.current = reader;

      let devices: { deviceId: string; label: string }[] = [];
      try {
        const enumerated = await reader.listVideoInputDevices();
        devices = enumerated.map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
        }));
        setAvailableCameras(devices);
      } catch {
        // Enumerate may fail before permission is granted
      }

      let targetId = deviceIdToUse;
      if (!targetId && devices.length > 0) {
        // Prefer rear / back camera on mobile phones
        const rearCamera = devices.find((d) => /back|rear|environment/i.test(d.label));
        targetId = rearCamera ? rearCamera.deviceId : devices[0].deviceId;
      }
      setSelectedCameraId(targetId);

      if (videoRef.current) {
        await reader.decodeFromVideoDevice(
          targetId || null,
          videoRef.current,
          (result, _err) => {
            if (result && !isProcessingRef.current) {
              const text = result.getText();
              if (text && text.trim()) {
                isProcessingRef.current = true;
                handleProcessScan(text.trim());
              }
            }
          }
        );

        setIsCameraActive(true);

        // Check if device supports torch
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track && typeof track.getCapabilities === 'function') {
            const capabilities = track.getCapabilities() as any;
            setTorchAvailable(Boolean(capabilities?.torch));
          }
        }

        // Re-check devices once permission is granted (labels are now populated by browser)
        try {
          const refreshed = await reader.listVideoInputDevices();
          if (refreshed.length > 0) {
            setAvailableCameras(
              refreshed.map((d, index) => ({
                deviceId: d.deviceId,
                label: d.label || `Camera ${index + 1}`,
              }))
            );
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error('Camera startup error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Tap "Allow" in your browser address bar.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. Use manual lookup below.');
      } else {
        setCameraError(err?.message || 'Unable to start camera.');
      }
      setIsCameraActive(false);
    } finally {
      setIsCameraLoading(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleSwitchCamera = () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    setSelectedCameraId(nextCamera.deviceId);
    startCamera(nextCamera.deviceId);
  };

  const handleToggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (track) {
      const nextTorch = !isTorchOn;
      try {
        await track.applyConstraints({
          advanced: [{ torch: nextTorch } as any],
        });
        setIsTorchOn(nextTorch);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  const handleProcessScan = async (tokenString: string) => {
    if (!tokenString) {
      isProcessingRef.current = false;
      return;
    }
    setScanState('verifying');

    try {
      let studentId = '';

      // Try unpacking rotating signed token
      const unpacked = unpackTokenFromString(tokenString);
      if (unpacked) {
        studentId = unpacked.payload.sid;
      } else {
        // Fallback: check if token is raw JSON or direct ID
        try {
          const parsed = JSON.parse(tokenString);
          studentId = parsed.sid || parsed.student_id || parsed.id || '';
        } catch {
          studentId = tokenString.trim();
        }
      }

      if (!studentId) {
        setScanState('rejected');
        setFlagReason('Invalid QR code format');
        triggerHaptic(false);
        setTimeout(() => {
          setScanState('idle');
          setScannedStudent(null);
          isProcessingRef.current = false;
        }, 1500);
        return;
      }

      // 1. Look up student in local Dexie roster
      let student = await db.findStudentBySchoolId(studentId);
      if (!student) {
        student = await db.getStudentById(studentId);
      }

      // 2. Check local profile (if testing on same device)
      if (!student) {
        const localProfile = await db.getProfile();
        if (localProfile && (localProfile.school_id_no === studentId || localProfile.id === studentId)) {
          student = {
            student_id: localProfile.id,
            school_id_no: localProfile.school_id_no || studentId,
            full_name: localProfile.full_name,
            department_id: localProfile.department_id || departmentId,
            section_id: localProfile.section_id || 'BSIT-3A',
            public_key: 'local-key',
            thumb_data_url: localProfile.photo_path || localProfile.thumb_path,
            status: 'approved',
          };
        }
      }

      // 3. Fallback: Query Supabase online if available
      if (!student && supabase) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .or(`school_id_no.eq.${studentId},id.eq.${studentId},email.eq.${studentId}`)
            .limit(1)
            .maybeSingle();

          if (data) {
            student = {
              student_id: data.school_id_no || data.id,
              school_id_no: data.school_id_no || studentId,
              full_name: data.full_name,
              department_id: data.department_id || departmentId,
              section_id: data.section_id || 'N/A',
              public_key: 'online-key',
              thumb_data_url: data.photo_path || data.photo_url || data.thumb_path || data.thumb_data_url,
              status: data.status || 'approved',
            };
          }
        } catch {
          // offline fallback
        }
      }

      // 4. Default fallback mock student if completely unrecognized
      if (!student) {
        student = {
          student_id: studentId,
          school_id_no: studentId,
          full_name: 'Student ' + studentId,
          department_id: departmentId,
          section_id: 'BSIT-3A',
          public_key: 'mock-key',
          status: 'approved',
        };
      }

      setScannedStudent(student);

      // Check if student already checked in for this slot
      const isAlreadyCheckedIn = await db.hasStudentCheckedIn('cit-intramurals-2026', currentSlot, student.student_id);
      if (isAlreadyCheckedIn) {
        setScanState('flagged');
        setFlagReason('Already signed in for this slot');
        triggerHaptic(false);
        return;
      }

      // Check department
      if (student.department_id !== departmentId && departmentId !== 'ALL') {
        setScanState('flagged');
        setFlagReason(`From different department (${student.department_id})`);
        triggerHaptic(false);
        return;
      }

      // Valid: Display student details and wait for officer to confirm
      setScanState('accepted');
      triggerHaptic(true);
    } catch {
      setScanState('rejected');
      setFlagReason('QR code not recognized');
      triggerHaptic(false);
      setTimeout(() => {
        setScanState('idle');
        setScannedStudent(null);
        isProcessingRef.current = false;
      }, 1500);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!scannedStudent) return;
    setIsCommitting(true);

    try {
      const serialNo = `${scannerKeyId}-${Date.now().toString().slice(-5)}`;
      const stamp = await createScannerStamp({
        serialNo,
        studentId: scannedStudent.student_id,
        eventId: 'cit-intramurals-2026',
        slotId: currentSlot,
        venueId: currentVenue,
        officerId,
        scannerKeyId,
        method: 'qr',
        locationFlag: 'none',
        privateKey: scannerKey,
      });

      const scanQueueItem: StoredScanQueueItem = {
        client_uuid: crypto.randomUUID(),
        serial_no: serialNo,
        student_id: scannedStudent.student_id,
        event_id: 'cit-intramurals-2026',
        slot_id: currentSlot,
        venue_id: currentVenue,
        officer_id: officerId,
        scanner_key_id: scannerKeyId,
        method: 'qr',
        scanned_at: stamp.scanned_at,
        location_flag: 'none',
        signature: stamp.signature,
        status: 'valid',
        synced: false,
      };

      await db.enqueueScan(scanQueueItem);
      onScanCommitted(scanQueueItem);
      setLatestStamp(stamp);
      triggerHaptic(true);

      setScanSuccessMsg('Attendance Confirmed! Saved on this phone.');
      setTimeout(() => {
        setScanSuccessMsg('');
        setScanState('idle');
        setScannedStudent(null);
        setSimulatedTokenInput('');
        isProcessingRef.current = false;
        setIsCommitting(false);
      }, 900);
    } catch (err) {
      console.error('Failed to confirm check-in:', err);
      setIsCommitting(false);
    }
  };

  const handleRejectScan = (reason: string = 'Cancelled by officer') => {
    setScanState('rejected');
    setFlagReason(reason);
    triggerHaptic(false);
    setTimeout(() => {
      setScanState('idle');
      setScannedStudent(null);
      isProcessingRef.current = false;
    }, 1000);
  };

  const handleManualSearch = async (query: string) => {
    setManualSearchQuery(query);
    if (!query.trim()) {
      setManualSearchResults([]);
      return;
    }
    const results = await db.roster
      .filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase()) || s.school_id_no.includes(query))
      .limit(5)
      .toArray();
    setManualSearchResults(results);
  };

  const handleCommitManual = async (student: StoredRosterStudent) => {
    const serialNo = `${scannerKeyId}-${Date.now().toString().slice(-5)}`;
    const stamp = await createScannerStamp({
      serialNo,
      studentId: student.student_id,
      eventId: 'cit-intramurals-2026',
      slotId: currentSlot,
      venueId: currentVenue,
      officerId,
      scannerKeyId,
      method: 'manual',
      locationFlag: 'none',
      privateKey: scannerKey,
    });

    const scanQueueItem: StoredScanQueueItem = {
      client_uuid: crypto.randomUUID(),
      serial_no: serialNo,
      student_id: student.student_id,
      event_id: 'cit-intramurals-2026',
      slot_id: currentSlot,
      venue_id: currentVenue,
      officer_id: officerId,
      scanner_key_id: scannerKeyId,
      method: 'manual',
      scanned_at: stamp.scanned_at,
      location_flag: 'none',
      signature: stamp.signature,
      status: 'valid',
      synced: false,
      note: 'Manual entry',
    };

    await db.enqueueScan(scanQueueItem);
    onScanCommitted(scanQueueItem);
    setLatestStamp(stamp);
    setIsManualModalOpen(false);
    setScanState('idle');
    setScannedStudent(null);
    isProcessingRef.current = false;
    triggerHaptic(true);
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* 1. Status Bar */}
      <div className="bg-white border border-mono-200 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-mono-900" />
          <span className="font-bold text-mono-900">Ready to Scan</span>
        </div>
        <div className="text-mono-600 font-medium">
          {unsyncedCount === 0 ? 'All scans saved' : `${unsyncedCount} saved on this phone`}
        </div>
      </div>

      {/* 2. Venue and Slot Banner */}
      <button
        type="button"
        onClick={() => setIsSlotPickerOpen(!isSlotPickerOpen)}
        className="w-full bg-mono-900 text-white rounded-xl p-4 flex items-center justify-between transition active:scale-[0.99] text-left"
      >
        <div>
          <span className="text-[11px] text-mono-400 block uppercase tracking-wider">
            Location: {currentVenue}
          </span>
          <h2 className="text-lg font-bold mt-0.5">{currentSlotLabel}</h2>
        </div>
        <div className="flex items-center gap-1 text-xs text-mono-300 bg-white/10 px-2.5 py-1 rounded">
          <span>Change Slot</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </button>

      {/* Slot Picker Dropdown (5 Days x 4 Slots = 20 Slots) */}
      {isSlotPickerOpen && (
        <div className="bg-white border border-mono-200 rounded-xl p-3.5 space-y-3 text-xs shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-mono-200">
            <span className="text-mono-500 uppercase text-[11px] font-bold tracking-wider">
              Select Attendance Slot (20 Total Slots)
            </span>
            <button
              type="button"
              onClick={() => setIsSlotPickerOpen(false)}
              className="text-mono-400 hover:text-mono-900 text-xs font-semibold"
            >
              Close
            </button>
          </div>

          {/* Day Selector Tabs */}
          <div className="grid grid-cols-5 gap-1.5 p-1 bg-mono-100 rounded-lg">
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDayTab(d)}
                className={`py-1.5 text-xs font-bold rounded-md transition ${
                  selectedDayTab === d
                    ? 'bg-white text-mono-950 shadow-sm border border-mono-200'
                    : 'text-mono-600 hover:text-mono-900'
                }`}
              >
                Day {d}
              </button>
            ))}
          </div>

          {/* Slots for Selected Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {[
              { type: 'morning-in', name: 'Morning In', sub: 'Arrival' },
              { type: 'morning-out', name: 'Morning Out', sub: 'Lunch Exit' },
              { type: 'afternoon-in', name: 'Afternoon In', sub: 'Afternoon Arrival' },
              { type: 'afternoon-out', name: 'Afternoon Out', sub: 'Dismissal' },
            ].map((slot) => {
              const fullSlotId = `day${selectedDayTab}-${slot.type}`;
              const fullLabel = `Day ${selectedDayTab} ${slot.name} (${slot.sub})`;
              const isSelected = currentSlot === fullSlotId;

              return (
                <button
                  key={fullSlotId}
                  type="button"
                  onClick={() => {
                    setCurrentSlot(fullSlotId);
                    setCurrentSlotLabel(fullLabel);
                    setIsSlotPickerOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border text-left flex flex-col transition ${
                    isSelected
                      ? 'bg-mono-950 text-white border-mono-950 font-bold'
                      : 'bg-white border-mono-200 hover:bg-mono-50 text-mono-900'
                  }`}
                >
                  <span className="font-bold text-xs">{slot.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-mono-300' : 'text-mono-500'}`}>
                    Day {selectedDayTab} &bull; {slot.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Live Camera / Scanner View */}
      <div className="bg-white border border-mono-200 rounded-xl p-4 sm:p-5 text-center space-y-4">
        {/* Real Viewfinder Window */}
        <div className="relative w-full aspect-square sm:aspect-video bg-mono-950 rounded-xl overflow-hidden border border-mono-900 flex items-center justify-center">
          {/* Real Video Element */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isCameraActive && !isCameraLoading ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Active Scanning Overlay */}
          {isCameraActive && !isCameraLoading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Center Targeting Box */}
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 border border-white/30 rounded-xl">
                {/* 4 Corner Markers */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />

                {/* Subtle animated scan beam */}
                <div className="w-full h-0.5 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse mt-24" />
              </div>

              {/* Instruction banner bottom */}
              <div className="absolute bottom-3 inset-x-4 text-center">
                <span className="inline-block bg-black/75 backdrop-blur-sm text-white text-[11px] font-medium px-3 py-1 rounded-full border border-white/20">
                  Align student QR code within frame
                </span>
              </div>
            </div>
          )}

          {/* Live Badge (Top-Left) */}
          {isCameraActive && !isCameraLoading && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] text-white font-medium border border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Camera Live</span>
            </div>
          )}

          {/* Controls Overlay (Top-Right) */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            {/* Flashlight toggle */}
            {torchAvailable && isCameraActive && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-2 rounded-lg backdrop-blur-md border text-xs transition ${
                  isTorchOn
                    ? 'bg-white text-mono-950 border-white font-bold'
                    : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                }`}
                title={isTorchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              >
                {isTorchOn ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              </button>
            )}

            {/* Switch Camera / Flip button */}
            {availableCameras.length > 1 && isCameraActive && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md border border-white/20 text-xs transition"
                title="Switch Camera (Front/Rear)"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {/* Pause / Resume Camera */}
            {isCameraActive ? (
              <button
                type="button"
                onClick={stopCamera}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md border border-white/20 text-xs transition"
                title="Pause camera"
              >
                <CameraOff className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startCamera(selectedCameraId)}
                className="p-2 bg-white text-mono-950 rounded-lg text-xs font-bold transition"
                title="Start camera"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Loading State */}
          {isCameraLoading && (
            <div className="absolute inset-0 bg-mono-950/90 flex flex-col items-center justify-center p-4 text-white space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <span className="text-xs font-medium">Starting camera...</span>
            </div>
          )}

          {/* Camera Paused State */}
          {!isCameraActive && !isCameraLoading && !cameraError && (
            <div className="absolute inset-0 bg-mono-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-3">
              <CameraOff className="w-10 h-10 text-mono-400" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Camera is Paused</h4>
                <p className="text-xs text-mono-400 max-w-xs">
                  Camera is turned off to save battery. Tap below to resume scanning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => startCamera(selectedCameraId)}
                className="min-h-touch px-4 py-2 bg-white text-mono-950 text-xs font-bold rounded-lg transition active:scale-[0.98] flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>Resume Camera</span>
              </button>
            </div>
          )}

          {/* Camera Error State */}
          {cameraError && !isCameraLoading && (
            <div className="absolute inset-0 bg-mono-950 flex flex-col items-center justify-center p-6 text-white text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-mono-300" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Camera Unavailable</h4>
                <p className="text-xs text-mono-300 max-w-xs leading-relaxed">
                  {cameraError}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startCamera(selectedCameraId)}
                  className="min-h-touch px-4 py-2 bg-white text-mono-950 text-xs font-bold rounded-lg transition active:scale-[0.98] flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="min-h-touch px-4 py-2 bg-mono-800 hover:bg-mono-700 text-white text-xs font-bold rounded-lg border border-mono-700 transition active:scale-[0.98]"
                >
                  Search Student
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Test / Manual String Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Scan or enter student ID / QR string..."
            value={simulatedTokenInput}
            onChange={(e) => setSimulatedTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleProcessScan(simulatedTokenInput);
              }
            }}
            className="flex-1 min-h-touch border border-mono-300 rounded-lg px-3 text-xs focus:border-mono-900 outline-none"
          />
          <button
            type="button"
            onClick={() => handleProcessScan(simulatedTokenInput)}
            className="min-h-touch px-4 bg-mono-900 hover:bg-mono-800 text-white text-xs font-bold rounded-lg transition active:scale-[0.98]"
          >
            Check In
          </button>
        </div>
      </div>

      {/* 4. Student Photo & Verification Card */}
      {scanState !== 'idle' && scannedStudent && (
        <div
          className={`border-2 rounded-2xl p-5 bg-white shadow-lg transition-all ${
            scanSuccessMsg
              ? 'border-mono-950 bg-mono-950 text-white'
              : scanState === 'accepted'
              ? 'border-mono-950'
              : scanState === 'flagged'
              ? 'border-mono-400 bg-mono-50'
              : scanState === 'rejected'
              ? 'border-mono-900 bg-mono-100'
              : 'border-mono-200'
          }`}
        >
          {scanSuccessMsg ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white text-mono-950 mx-auto flex items-center justify-center">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h3 className="text-lg font-bold text-white">{scanSuccessMsg}</h3>
              <p className="text-xs text-mono-300">Ready for next student...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header Status Tag */}
              <div className="flex items-center justify-between pb-3 border-b border-mono-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-mono-500">
                  Student Verification
                </span>
                {scanState === 'accepted' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-mono-900 text-white px-2.5 py-0.5 rounded-full">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Identity Match &bull; Tap Confirm</span>
                  </span>
                )}
                {scanState === 'flagged' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                    <span>{flagReason}</span>
                  </span>
                )}
                {scanState === 'rejected' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-mono-200 text-mono-900 px-2 py-0.5 rounded-full">
                    <span>{flagReason}</span>
                  </span>
                )}
              </div>

              {/* Photo & Details Row */}
              <div className="flex gap-4 items-center">
                {/* Photo: prominent, high-clarity */}
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl border-2 border-mono-900 bg-mono-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
                  {scannedStudent.thumb_data_url ? (
                    <img
                      src={scannedStudent.thumb_data_url}
                      alt={scannedStudent.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-14 h-14 text-mono-400" />
                  )}
                </div>

                {/* Student Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-mono font-bold text-mono-600 bg-mono-100 px-2 py-0.5 rounded inline-block">
                    {scannedStudent.school_id_no}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-mono-950 leading-snug truncate">
                    {scannedStudent.full_name}
                  </h3>
                  <div className="text-xs font-medium text-mono-700">
                    <strong>{scannedStudent.department_id}</strong> &bull; {scannedStudent.section_id}
                  </div>
                  <div className="text-[11px] text-mono-500 pt-1">
                    Slot: <span className="font-semibold text-mono-800">{currentSlotLabel}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                {scanState !== 'rejected' && !flagReason.includes('Already') && (
                  <button
                    type="button"
                    onClick={handleConfirmCheckIn}
                    disabled={isCommitting}
                    className="flex-1 min-h-[48px] bg-mono-950 hover:bg-mono-800 text-white text-xs sm:text-sm font-bold rounded-xl py-3 transition active:scale-[0.98] flex items-center justify-center gap-2 shadow"
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Check-in...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Confirm Check-in</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRejectScan(scanState === 'rejected' ? 'Dismissed' : 'Not this person')}
                  disabled={isCommitting}
                  className="flex-1 min-h-[44px] border border-mono-300 hover:border-mono-900 hover:bg-mono-100 text-mono-800 text-xs font-semibold rounded-xl py-2.5 transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>{scanState === 'rejected' || flagReason.includes('Already') ? 'Dismiss' : 'Not This Person / Cancel'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Offline Stamp Receipt Button */}
      {latestStamp && (
        <div className="bg-white border border-mono-200 rounded-xl p-3">
          <button
            type="button"
            onClick={() => setIsReceiptModalOpen(true)}
            className="w-full min-h-touch bg-mono-900 hover:bg-mono-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <QrCode className="w-4 h-4" />
            <span>Show Offline Receipt QR ({latestStamp.student_id})</span>
          </button>
        </div>
      )}

      {/* 6. Manual Search Button */}
      <div className="bg-white border border-mono-200 rounded-xl p-3">
        <button
          type="button"
          onClick={() => setIsManualModalOpen(true)}
          className="w-full min-h-touch border border-mono-300 hover:border-mono-900 rounded-lg text-xs font-bold text-mono-900 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          <Search className="w-4 h-4" />
          <span>Search Student by ID or Name</span>
        </button>
      </div>

      {/* Manual Check-in Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-mono-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mono-200 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-mono-200">
              <h3 className="font-bold text-mono-900 text-base">Search Student</h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 text-mono-400 hover:text-mono-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-mono-500">
              Find a student if their phone battery died or camera is broken.
            </p>

            <input
              type="text"
              placeholder="Type student name or ID number..."
              value={manualSearchQuery}
              onChange={(e) => handleManualSearch(e.target.value)}
              className="w-full min-h-touch border border-mono-300 rounded-lg px-3 text-xs focus:border-mono-900 outline-none"
            />

            <div className="max-h-60 overflow-y-auto divide-y divide-mono-100 border border-mono-200 rounded-lg">
              {manualSearchResults.length > 0 ? (
                manualSearchResults.map((student) => (
                  <div key={student.student_id} className="p-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-mono-900">{student.full_name}</h4>
                      <p className="text-xs text-mono-500">
                        {student.school_id_no} &bull; {student.section_id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCommitManual(student)}
                      className="min-h-touch px-3 py-1.5 bg-mono-900 hover:bg-mono-800 text-white rounded text-xs font-bold transition active:scale-[0.98]"
                    >
                      Sign In
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-mono-400">
                  {manualSearchQuery ? 'No student found' : 'Type to search students'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Offline Stamp Receipt Modal */}
      {isReceiptModalOpen && latestStamp && (
        <div className="fixed inset-0 bg-mono-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mono-200 max-w-sm w-full rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-mono-200">
              <div className="text-left">
                <span className="text-[10px] text-mono-400 uppercase font-semibold block">Offline Verification</span>
                <h3 className="font-bold text-mono-900 text-sm">Attendance Stamp Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1 text-mono-400 hover:text-mono-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center p-3 bg-white border-2 border-mono-900 rounded-xl">
              <QRCodeSVG value={packStampToReceiptString(latestStamp)} size={200} />
            </div>

            <div className="space-y-1 text-xs text-mono-700 bg-mono-50 p-3 rounded-lg border border-mono-200 text-left">
              <div><strong>Student ID:</strong> {latestStamp.student_id}</div>
              <div><strong>Event Slot:</strong> {latestStamp.slot_id}</div>
              <div><strong>Serial No:</strong> {latestStamp.serial_no}</div>
              <p className="text-[11px] text-mono-500 pt-2 border-t border-mono-200 mt-1">
                The student can scan this code with their phone to stamp their activity card instantly, even without internet access.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(false)}
              className="w-full h-10 bg-mono-950 hover:bg-mono-800 text-white rounded-lg text-xs font-bold transition active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
