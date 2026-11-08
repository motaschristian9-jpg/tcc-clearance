import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentView } from '../components/student/StudentView';
import {
  generateECDSAKeyPair,
  exportPublicKeyRaw,
  createStudentQRToken,
  packTokenToString,
} from '../lib/crypto/tokens';
import { db } from '../lib/db/dexie';
import { StoredAttendanceRecord, StoredRosterStudent } from '../types/database';
import { Wifi, WifiOff, Lock } from 'lucide-react';

export const StudentPage: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [studentKeys, setStudentKeys] = useState<{ privateKey: CryptoKey; publicKeyRaw: string } | null>(null);
  const [studentId] = useState('2023-01042');
  const [studentName] = useState('Juan Dela Cruz');
  const [department] = useState('CIT');
  const [section] = useState('BSIT-3A');
  const [eventId] = useState('cit-intramurals-2026');
  const [tokenString, setTokenString] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [attendanceRecords, setAttendanceRecords] = useState<StoredAttendanceRecord[]>([]);

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

  useEffect(() => {
    async function init() {
      const sKeyPair = await generateECDSAKeyPair(false);
      const sPubRaw = await exportPublicKeyRaw(sKeyPair.publicKey);
      setStudentKeys({ privateKey: sKeyPair.privateKey, publicKeyRaw: sPubRaw });

      const existing = await db.findStudentBySchoolId(studentId);
      if (!existing) {
        const student: StoredRosterStudent = {
          student_id: `std-${studentId}`,
          school_id_no: studentId,
          full_name: studentName,
          department_id: department,
          section_id: section,
          year_level: 3,
          public_key: sPubRaw,
          status: 'approved',
        };
        await db.roster.put(student);
      }

      const records = await db.getStudentAttendance(`std-${studentId}`, eventId);
      setAttendanceRecords(records);
    }
    init();
  }, [studentId, studentName, department, section, eventId]);

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

  return (
    <div className="min-h-screen bg-mono-50 text-mono-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-mono-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-mono-950 text-white font-bold rounded-lg flex items-center justify-center text-xs">
              TCC
            </div>
            <div>
              <h1 className="text-sm font-bold text-mono-900 leading-none">
                Activity Card Clearance
              </h1>
              <span className="text-[11px] text-mono-500">Tagoloan Community College</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-mono-200 text-mono-700 bg-mono-50 text-xs font-medium">
              {isOnline ? (
                <>
                  <Wifi className="size-3 text-mono-900" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="size-3 text-mono-400" />
                  <span>Working Offline</span>
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1">
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

        {/* Discreet Officer Login Link at the bottom */}
        <footer className="mt-12 py-6 border-t border-mono-200 text-center text-xs text-mono-400 flex items-center justify-center gap-1">
          <Link
            to="/sbo"
            className="hover:text-mono-600 transition inline-flex items-center gap-1 text-[11px]"
          >
            <Lock className="size-3" />
            <span>Officer Sign In</span>
          </Link>
        </footer>
      </main>
    </div>
  );
};
