import React, { useState, useEffect } from 'react';
import { InstallGate } from './components/common/InstallGate';
import { StudentView } from './components/student/StudentView';
import { ScannerView } from './components/scanner/ScannerView';
import { CheckCardView } from './components/officer/CheckCardView';
import {
  generateECDSAKeyPair,
  exportPublicKeyRaw,
  createStudentQRToken,
  packTokenToString,
} from './lib/crypto/tokens';
import { db } from './lib/db/dexie';
import { StoredAttendanceRecord, StoredRosterStudent, StoredScanQueueItem } from './types/database';
import {
  Smartphone,
  ScanLine,
  FileCheck2,
  FolderDown,
  WifiOff,
  Wifi,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'student' | 'scanner' | 'check-card' | 'database'>('student');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  // Student state
  const [studentKeys, setStudentKeys] = useState<{ privateKey: CryptoKey; publicKeyRaw: string } | null>(null);
  const [studentId] = useState('2023-01042');
  const [studentName] = useState('Juan Dela Cruz');
  const [department] = useState('CIT');
  const [section] = useState('BSIT-3A');
  const [eventId] = useState('cit-intramurals-2026');
  const [tokenString, setTokenString] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  // Scanner state
  const [scannerKey, setScannerKey] = useState<CryptoKey | null>(null);
  const [scannerKeyId] = useState('SCANNER-CIT-01');
  const [officerId] = useState('officer-sbo-auditor-1');

  // Student Attendance Records for the Card
  const [attendanceRecords, setAttendanceRecords] = useState<StoredAttendanceRecord[]>([]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize keys and seed roster
  useEffect(() => {
    async function initKeys() {
      const sKeyPair = await generateECDSAKeyPair(false);
      const sPubRaw = await exportPublicKeyRaw(sKeyPair.publicKey);
      setStudentKeys({ privateKey: sKeyPair.privateKey, publicKeyRaw: sPubRaw });

      const scKeyPair = await generateECDSAKeyPair(false);
      setScannerKey(scKeyPair.privateKey);

      const existingRoster = await db.roster.count();
      if (existingRoster === 0) {
        const seedStudents: StoredRosterStudent[] = [
          {
            student_id: 'std-2023-01042',
            school_id_no: '2023-01042',
            full_name: 'Juan Dela Cruz',
            department_id: 'CIT',
            section_id: 'BSIT-3A',
            year_level: 3,
            public_key: sPubRaw,
            status: 'approved',
          },
          {
            student_id: 'std-2023-01043',
            school_id_no: '2023-01043',
            full_name: 'Maria Santos',
            department_id: 'CIT',
            section_id: 'BSIT-3A',
            year_level: 3,
            public_key: sPubRaw,
            status: 'approved',
          },
          {
            student_id: 'std-2023-02001',
            school_id_no: '2023-02001',
            full_name: 'Gabriel Silang',
            department_id: 'CCJPS',
            section_id: 'BSCrim-1B',
            year_level: 1,
            public_key: sPubRaw,
            status: 'approved',
          },
        ];
        await db.cacheDepartmentRoster(seedStudents);
      }

      const count = await db.getUnsyncedScanCount();
      setUnsyncedCount(count);

      const records = await db.getStudentAttendance('std-2023-01042', eventId);
      setAttendanceRecords(records);
    }

    initKeys();
  }, [eventId]);

  // 30s rotating token timer
  useEffect(() => {
    if (!studentKeys) return;

    async function rotateToken() {
      if (!studentKeys) return;
      const token = await createStudentQRToken({
        studentId,
        eventId,
        privateKey: studentKeys.privateKey,
      });
      const packed = packTokenToString(token);
      setTokenString(packed);
      setSecondsRemaining(30);
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
  }, [studentKeys, studentId, eventId]);

  // Handle new scan committed from scanner
  const handleScanCommitted = async (scan: StoredScanQueueItem) => {
    const newRecord: StoredAttendanceRecord = {
      id: scan.client_uuid,
      client_uuid: scan.client_uuid,
      event_id: scan.event_id,
      slot_id: scan.slot_id,
      student_id: scan.student_id,
      venue_id: scan.venue_id,
      officer_id: scan.officer_id,
      scanner_key_id: scan.scanner_key_id,
      scanned_at: scan.scanned_at,
      method: scan.method,
      location_flag: scan.location_flag,
      status: scan.status,
      serial_no: scan.serial_no,
      signature: scan.signature,
    };

    await db.attendance.put(newRecord);

    const records = await db.getStudentAttendance('std-2023-01042', eventId);
    setAttendanceRecords(records);

    const count = await db.getUnsyncedScanCount();
    setUnsyncedCount(count);
  };

  const handleSimulateSync = async () => {
    const unsynced = await db.getUnsyncedScans();
    const uuids = unsynced.map((u) => u.client_uuid);
    await db.markScansSynced(uuids);
    setUnsyncedCount(0);
  };

  return (
    <InstallGate>
      <div className="min-h-screen bg-mono-50 text-mono-900 flex flex-col font-sans">
        {/* Simple Minimalist Header */}
        <header className="bg-white border-b border-mono-200 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-mono-900 text-white font-bold rounded-lg flex items-center justify-center text-xs">
                TCC
              </div>
              <div>
                <h1 className="text-sm font-bold text-mono-900 leading-none">
                  Event Clearance
                </h1>
                <span className="text-[11px] text-mono-500">Tagoloan Community College</span>
              </div>
            </div>

            {/* Simple Status */}
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-mono-200 text-mono-700 bg-mono-50 font-medium">
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-mono-900" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-mono-400" />
                    <span>Working Offline</span>
                  </>
                )}
              </span>

              {unsyncedCount > 0 ? (
                <button
                  type="button"
                  onClick={handleSimulateSync}
                  className="px-3 py-1 bg-mono-900 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition active:scale-[0.98]"
                >
                  <span>Sync ({unsyncedCount})</span>
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-mono-500 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-mono-900" />
                  <span>All Saved</span>
                </span>
              )}
            </div>
          </div>

          {/* Simple Tabs */}
          <div className="max-w-4xl mx-auto px-4 flex gap-1 border-t border-mono-100 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              className={`min-h-touch px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'student'
                  ? 'border-mono-900 text-mono-900'
                  : 'border-transparent text-mono-400 hover:text-mono-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>My Card</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scanner')}
              className={`min-h-touch px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'scanner'
                  ? 'border-mono-900 text-mono-900'
                  : 'border-transparent text-mono-400 hover:text-mono-700'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('check-card')}
              className={`min-h-touch px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'check-card'
                  ? 'border-mono-900 text-mono-900'
                  : 'border-transparent text-mono-400 hover:text-mono-700'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Check Clearance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`min-h-touch px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'database'
                  ? 'border-mono-900 text-mono-900'
                  : 'border-transparent text-mono-400 hover:text-mono-700'
              }`}
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>Saved Records</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1">
          {activeTab === 'student' && (
            <StudentView
              studentId={studentId}
              studentName={studentName}
              department={department}
              section={section}
              eventId={eventId}
              tokenString={tokenString}
              secondsRemaining={secondsRemaining}
              attendanceRecords={attendanceRecords}
              onExportCard={() => window.print()}
            />
          )}

          {activeTab === 'scanner' && scannerKey && (
            <ScannerView
              scannerKey={scannerKey}
              scannerKeyId={scannerKeyId}
              officerId={officerId}
              departmentId={department}
              onScanCommitted={handleScanCommitted}
              unsyncedCount={unsyncedCount}
            />
          )}

          {activeTab === 'check-card' && (
            <CheckCardView />
          )}

          {activeTab === 'database' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-white border border-mono-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-mono-200">
                  <div>
                    <span className="text-xs text-mono-500 uppercase font-semibold">
                      Device Storage
                    </span>
                    <h3 className="text-base font-bold text-mono-900">Saved Attendance Records</h3>
                  </div>
                  {unsyncedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleSimulateSync}
                      className="min-h-touch px-4 py-2 bg-mono-900 text-white rounded-lg text-xs font-bold hover:bg-mono-800 transition active:scale-[0.98]"
                    >
                      Send to Server Now
                    </button>
                  )}
                </div>

                <p className="text-xs text-mono-600 leading-relaxed">
                  Scans are saved directly on this phone so the app works even when there is no Wi-Fi or mobile data at the venue. When internet is available, scans automatically sync with the school records.
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-mono-200 p-4 rounded-xl">
                    <span className="text-mono-400 block text-xs">Students on Phone</span>
                    <span className="text-2xl font-bold text-mono-900 mt-1 block">3 Students</span>
                  </div>
                  <div className="border border-mono-200 p-4 rounded-xl">
                    <span className="text-mono-400 block text-xs">Pending Upload</span>
                    <span className="text-2xl font-bold text-mono-900 mt-1 block">{unsyncedCount} Scans</span>
                  </div>
                </div>

                <div className="p-3 bg-mono-100 rounded-lg text-xs text-mono-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-mono-900 flex-shrink-0" />
                  <span>Security keys are safely stored on this device.</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </InstallGate>
  );
}
