import React, { useState } from 'react';
import {
  Check,
  X,
  Search,
  Camera,
  ChevronDown,
  User,
  ArrowRight,
  QrCode,
} from 'lucide-react';
import { StoredRosterStudent, StoredScanQueueItem } from '@/types/database';
import { ScannerSignedStamp } from '@/types/crypto';
import { createScannerStamp, packStampToReceiptString } from '@/lib/crypto/stamps';
import { QRCodeSVG } from '../common/QRCode';
import { db } from '@/lib/db/dexie';

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
  const [currentSlotLabel, setCurrentSlotLabel] = useState('Day 1 Morning In');
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState(false);

  // Scan state
  const [simulatedTokenInput, setSimulatedTokenInput] = useState('');
  const [scannedStudent, setScannedStudent] = useState<StoredRosterStudent | null>(null);
  const [scanState, setScanState] = useState<'idle' | 'verifying' | 'accepted' | 'flagged' | 'rejected'>('idle');
  const [flagReason, setFlagReason] = useState<string>('');
  const [autoCommitTimer, setAutoCommitTimer] = useState<number | null>(null);

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

  const handleProcessScan = async (tokenString: string) => {
    if (!tokenString) return;
    setScanState('verifying');

    try {
      const parts = tokenString.split('.');
      if (parts.length !== 2) {
        setScanState('rejected');
        setFlagReason('Invalid QR code');
        triggerHaptic(false);
        return;
      }

      const payloadBase64 = parts[0];
      const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      let student = await db.findStudentBySchoolId(payload.sid);
      if (!student) {
        student = {
          student_id: payload.sid,
          school_id_no: payload.sid,
          full_name: 'Juan Dela Cruz',
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

      // Valid: Show green accept with 1.5s auto-commit
      setScanState('accepted');
      triggerHaptic(true);

      const commitItem = async () => {
        const serialNo = `${scannerKeyId}-${Date.now().toString().slice(-5)}`;
        const stamp = await createScannerStamp({
          serialNo,
          studentId: student!.student_id,
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
          student_id: student!.student_id,
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

        setTimeout(() => {
          setScanState('idle');
          setScannedStudent(null);
          setSimulatedTokenInput('');
        }, 1200);
      };

      const timer = window.setTimeout(commitItem, 1500);
      setAutoCommitTimer(timer);
    } catch {
      setScanState('rejected');
      setFlagReason('QR code not recognized');
      triggerHaptic(false);
    }
  };

  const handleRejectScan = (reason: string) => {
    if (autoCommitTimer) clearTimeout(autoCommitTimer);
    setScanState('rejected');
    setFlagReason(reason);
    triggerHaptic(false);
    setTimeout(() => {
      setScanState('idle');
      setScannedStudent(null);
    }, 1500);
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
    triggerHaptic(true);
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* 1. Status Bar */}
      <div className="bg-white border border-mono-200 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-mono-900"></span>
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

      {/* Slot Picker Dropdown */}
      {isSlotPickerOpen && (
        <div className="bg-white border border-mono-200 rounded-xl p-3 space-y-2 text-xs">
          <div className="text-mono-400 uppercase text-[11px] font-semibold pb-1 border-b border-mono-200">
            Select Slot to Scan
          </div>
          {[
            { id: 'day1-morning-in', label: 'Day 1 Morning In (Morning Arrival)' },
            { id: 'day1-morning-out', label: 'Day 1 Morning Out (Lunch Exit)' },
            { id: 'day1-afternoon-in', label: 'Day 1 Afternoon In (Afternoon Arrival)' },
            { id: 'day1-afternoon-out', label: 'Day 1 Afternoon Out (Dismissal)' },
          ].map((slot) => (
            <button
              key={slot.id}
              onClick={() => {
                setCurrentSlot(slot.id);
                setCurrentSlotLabel(slot.label);
                setIsSlotPickerOpen(false);
              }}
              className={`w-full text-left p-3 rounded-lg transition ${
                currentSlot === slot.id ? 'bg-mono-900 text-white font-bold' : 'hover:bg-mono-100 text-mono-800'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. Camera / Scanner View */}
      <div className="bg-white border border-mono-200 rounded-xl p-6 text-center space-y-4">
        <div className="relative aspect-video max-h-56 bg-mono-100 border border-mono-200 rounded-lg flex flex-col items-center justify-center p-4">
          <Camera className="w-10 h-10 text-mono-400 mb-2" />
          <span className="text-xs text-mono-500 font-medium">Point camera at student QR code</span>
          <div className="absolute inset-8 border border-dashed border-mono-400 pointer-events-none rounded"></div>
        </div>

        {/* Quick Test / Scan Simulation Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Scan or enter code..."
            value={simulatedTokenInput}
            onChange={(e) => setSimulatedTokenInput(e.target.value)}
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
      {scanState !== 'idle' && (
        <div
          className={`border-2 rounded-xl p-5 bg-white transition-all ${
            scanState === 'accepted'
              ? 'border-mono-900'
              : scanState === 'flagged'
              ? 'border-mono-400 bg-mono-50'
              : scanState === 'rejected'
              ? 'border-mono-900 bg-mono-100'
              : 'border-mono-200'
          }`}
        >
          {scannedStudent && (
            <div className="flex gap-4 items-center">
              {/* Photo at least 40% width */}
              <div className="w-2/5 aspect-square bg-mono-200 border border-mono-300 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                <User className="w-12 h-12 text-mono-400" />
              </div>

              {/* Student Details */}
              <div className="flex-1 space-y-1">
                <span className="text-xs text-mono-500 block">
                  {scannedStudent.school_id_no} &bull; {scannedStudent.department_id}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-mono-900 leading-tight">
                  {scannedStudent.full_name}
                </h3>
                <span className="text-xs font-semibold text-mono-700 block">
                  {scannedStudent.section_id}
                </span>

                {scanState === 'accepted' && (
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-mono-900 mt-2 bg-mono-100 px-2 py-0.5 rounded border border-mono-300">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Checked in! (Saving...)</span>
                  </div>
                )}

                {scanState === 'flagged' && (
                  <div className="text-xs text-mono-800 mt-2 font-medium">
                    <strong>Check:</strong> {flagReason}
                  </div>
                )}

                {scanState === 'rejected' && (
                  <div className="text-xs text-mono-900 font-bold mt-2">
                    <strong>Rejected:</strong> {flagReason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 pt-3 border-t border-mono-200 flex gap-2">
            <button
              type="button"
              onClick={() => handleRejectScan('Not this person')}
              className="flex-1 min-h-touch border border-mono-900 hover:bg-mono-100 text-mono-900 text-xs font-bold rounded-lg py-2.5 transition active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Not This Person</span>
            </button>

            {scanState === 'flagged' && (
              <button
                type="button"
                onClick={() => {
                  if (scannedStudent) {
                    handleCommitManual(scannedStudent);
                  }
                }}
                className="flex-1 min-h-touch bg-mono-900 hover:bg-mono-800 text-white text-xs font-bold rounded-lg py-2.5 transition active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Check-in</span>
              </button>
            )}
          </div>
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
