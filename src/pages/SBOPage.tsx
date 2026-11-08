import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ScannerView } from '../components/scanner/ScannerView';
import { CheckCardView } from '../components/officer/CheckCardView';
import { PendingApprovalsView } from '../components/officer/PendingApprovalsView';
import { SignaturePadModal } from '../components/officer/SignaturePadModal';
import { generateECDSAKeyPair } from '../lib/crypto/tokens';
import { db } from '../lib/db/dexie';
import { verifyOfficerPin, isOfficerAuthenticated, setOfficerAuthenticated } from '../lib/auth/officerAuth';
import { downloadAttendanceWorkbook } from '../services/excelExportService';
import { syncScanQueue, exportLocalBackupJson } from '../services/syncService';
import { StoredAttendanceRecord, StoredRosterStudent, StoredScanQueueItem } from '../types/database';
import {
  ScanLine,
  FileCheck2,
  FolderDown,
  CheckCircle,
  ShieldCheck,
  Lock,
  LogOut,
  ArrowRight,
  AlertCircle,
  PenTool,
  FileSpreadsheet,
  UserCheck,
  Download,
} from 'lucide-react';

export const SBOPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [officerSignature, setOfficerSignature] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'scanner' | 'check-card' | 'approvals' | 'database'>('scanner');
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [scannerKey, setScannerKey] = useState<CryptoKey | null>(null);
  const [scannerKeyId] = useState('SCANNER-CIT-01');
  const [officerId] = useState('officer-sbo-auditor-1');
  const [departmentId] = useState('CIT');

  useEffect(() => {
    setIsAuthenticated(isOfficerAuthenticated());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function init() {
      const scKeyPair = await generateECDSAKeyPair(false);
      setScannerKey(scKeyPair.privateKey);

      // Seed initial roster if empty
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
            public_key: 'mock-key-1',
            status: 'approved',
          },
          {
            student_id: 'std-2023-01043',
            school_id_no: '2023-01043',
            full_name: 'Maria Santos',
            department_id: 'CIT',
            section_id: 'BSIT-3A',
            year_level: 3,
            public_key: 'mock-key-2',
            status: 'approved',
          },
          {
            student_id: 'std-2023-02001',
            school_id_no: '2023-02001',
            full_name: 'Gabriel Silang',
            department_id: 'CCJPS',
            section_id: 'BSCrim-1B',
            year_level: 1,
            public_key: 'mock-key-3',
            status: 'approved',
          },
        ];
        await db.cacheDepartmentRoster(seedStudents);
      }

      const count = await db.getUnsyncedScanCount();
      setUnsyncedCount(count);

      const pendingCount = await db.roster
        .where('department_id')
        .equals(departmentId)
        .filter((s) => s.status === 'pending')
        .count();
      setPendingApprovalsCount(pendingCount);
    }
    init();
  }, [isAuthenticated]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyOfficerPin(enteredPin)) {
      setOfficerAuthenticated(true);
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Invalid Officer Access PIN. Please try again.');
      setEnteredPin('');
    }
  };

  const handleLogout = () => {
    setOfficerAuthenticated(false);
    setIsAuthenticated(false);
    setEnteredPin('');
  };

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
    const count = await db.getUnsyncedScanCount();
    setUnsyncedCount(count);
  };

  const handleExportExcel = async () => {
    const students = await db.getRosterByDepartment(departmentId);
    const records = await db.attendance.toArray();
    await downloadAttendanceWorkbook({
      eventName: 'CIT Intramurals 2026',
      departmentId,
      students,
      records,
    });
  };

  const handleSyncWithServer = async () => {
    const res = await syncScanQueue();
    if (res.success) {
      const count = await db.getUnsyncedScanCount();
      setUnsyncedCount(count);
    }
  };

  // If not authenticated, show PIN protection lock screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-mono-50 flex flex-col justify-center text-mono-900 font-sans p-4">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-12">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-mono-950 text-white shadow-sm">
              <Lock className="size-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-mono-950">
              Officer Access
            </h1>
            <p className="text-xs text-mono-500 max-w-xs mx-auto">
              This area is restricted to authorized SBO officers.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="bg-white border border-mono-200 rounded-xl p-6 space-y-4 shadow-sm">
            {pinError && (
              <div className="p-3 bg-mono-100 border border-mono-300 rounded-lg text-xs flex items-center gap-2 text-mono-900">
                <AlertCircle className="size-4 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="pin-input" className="text-xs font-semibold text-mono-700 block">
                Enter Officer PIN
              </label>
              <input
                id="pin-input"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                autoFocus
                className="w-full h-11 border border-mono-300 rounded-lg px-3 text-center text-lg tracking-widest font-mono focus:border-mono-900 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 bg-mono-950 hover:bg-mono-800 text-white text-xs font-bold rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <span>Unlock Scanner</span>
              <ArrowRight className="size-3.5" />
            </button>

            <div className="pt-2 text-center">
              <Link to="/" className="text-xs text-mono-400 hover:text-mono-700">
                &larr; Back to Student Card
              </Link>
            </div>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mono-50 text-mono-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-mono-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-mono-950 text-white font-bold rounded-lg flex items-center justify-center text-xs">
              SBO
            </div>
            <div>
              <h1 className="text-sm font-bold text-mono-900 leading-none">
                Officer Scanner
              </h1>
              <span className="text-[11px] text-mono-500">Tagoloan Community College</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSignatureModalOpen(true)}
              className="px-2.5 py-1 rounded-lg border border-mono-200 hover:bg-mono-100 text-mono-700 text-xs flex items-center gap-1.5 transition"
              title="Draw Signature"
            >
              <PenTool className="size-3.5" />
              <span className="hidden sm:inline">My Signature</span>
            </button>

            {unsyncedCount > 0 ? (
              <button
                type="button"
                onClick={handleSyncWithServer}
                className="px-3 py-1 bg-mono-950 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition active:scale-[0.98]"
              >
                <span>Send to Server ({unsyncedCount})</span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-mono-600 font-medium">
                <CheckCircle className="size-3.5 text-mono-900" />
                <span>All Scans Saved</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg border border-mono-200 hover:bg-mono-100 text-mono-600 transition"
              title="Lock Officer Portal"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

        {/* SBO Segmented Navigation */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 border-t border-mono-100 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`min-h-touch px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'scanner'
                ? 'border-mono-900 text-mono-900'
                : 'border-transparent text-mono-400 hover:text-mono-700'
            }`}
          >
            <ScanLine className="size-3.5" />
            <span>Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`min-h-touch px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'approvals'
                ? 'border-mono-900 text-mono-900'
                : 'border-transparent text-mono-400 hover:text-mono-700'
            }`}
          >
            <UserCheck className="size-3.5" />
            <span>Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span className="size-4 rounded-full bg-mono-900 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
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
            <FileCheck2 className="size-3.5" />
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
            <FolderDown className="size-3.5" />
            <span>Saved Records</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1">
        {activeTab === 'scanner' && scannerKey && (
          <ScannerView
            scannerKey={scannerKey}
            scannerKeyId={scannerKeyId}
            officerId={officerId}
            departmentId={departmentId}
            onScanCommitted={handleScanCommitted}
            unsyncedCount={unsyncedCount}
          />
        )}

        {activeTab === 'approvals' && (
          <PendingApprovalsView departmentId={departmentId} />
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
                    onClick={handleSyncWithServer}
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

              {/* Downloads */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full h-11 border border-mono-300 hover:border-mono-900 rounded-xl text-xs font-bold text-mono-900 flex items-center justify-center gap-2 transition active:scale-[0.98] bg-white"
                >
                  <FileSpreadsheet className="size-4" />
                  <span>Download Attendance Sheet (Excel .xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportLocalBackupJson(departmentId)}
                  className="w-full h-11 border border-mono-300 hover:border-mono-900 rounded-xl text-xs font-bold text-mono-900 flex items-center justify-center gap-2 transition active:scale-[0.98] bg-white"
                >
                  <Download className="size-4" />
                  <span>Download Offline Backup File (JSON)</span>
                </button>
              </div>

              <div className="p-3 bg-mono-100 rounded-lg text-xs text-mono-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-mono-900 flex-shrink-0" />
                <span>Security keys are safely stored on this device.</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <SignaturePadModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={(dataUrl) => {
          setOfficerSignature(dataUrl);
        }}
      />
    </div>
  );
};
