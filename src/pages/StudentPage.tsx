import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentView } from '../components/student/StudentView';
import { StudentRegistrationFlow } from '../components/student/StudentRegistrationFlow';
import {
  generateECDSAKeyPair,
  exportPublicKeyRaw,
  createStudentQRToken,
  packTokenToString,
} from '../lib/crypto/tokens';
import { db } from '../lib/db/dexie';
import { StoredAttendanceRecord, StoredProfile } from '../types/database';
import { Wifi, WifiOff, Lock, UserPlus, UserCheck } from 'lucide-react';

export const StudentPage: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<StoredProfile | null>(null);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Student keys and token
  const [studentKeys, setStudentKeys] = useState<{ privateKey: CryptoKey; publicKeyRaw: string } | null>(null);
  const [tokenString, setTokenString] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [attendanceRecords, setAttendanceRecords] = useState<StoredAttendanceRecord[]>([]);

  const eventId = 'cit-intramurals-2026';

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

  // Load existing profile or prompt registration
  useEffect(() => {
    async function loadStudent() {
      const profile = await db.getProfile();
      if (profile && profile.status === 'approved') {
        setCurrentProfile(profile);
        setIsRegistering(false);

        // Load or generate device key
        const keyPair = await generateECDSAKeyPair(false);
        const rawPub = await exportPublicKeyRaw(keyPair.publicKey);
        setStudentKeys({ privateKey: keyPair.privateKey, publicKeyRaw: rawPub });

        // Load attendance
        const records = await db.getStudentAttendance(profile.id.replace('prof-', 'std-'), eventId);
        setAttendanceRecords(records);
      } else if (!profile) {
        // First-time visitor -> Show registration flow!
        setIsRegistering(true);
      }
    }
    loadStudent();
  }, [eventId]);

  // 30s rotating token timer
  useEffect(() => {
    if (!studentKeys || !currentProfile) return;

    async function rotateToken() {
      if (!studentKeys || !currentProfile) return;
      const token = await createStudentQRToken({
        studentId: currentProfile.school_id_no || '2023-01042',
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
  }, [studentKeys, currentProfile, eventId]);

  const handleRegistrationComplete = async (profile: StoredProfile) => {
    setCurrentProfile(profile);
    setIsRegistering(false);

    // Initialize keys for the registered student
    const keyPair = await generateECDSAKeyPair(false);
    const rawPub = await exportPublicKeyRaw(keyPair.publicKey);
    setStudentKeys({ privateKey: keyPair.privateKey, publicKeyRaw: rawPub });

    const records = await db.getStudentAttendance(profile.id.replace('prof-', 'std-'), eventId);
    setAttendanceRecords(records);
  };

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
            {/* Toggle between Card and Registration form for demo/testing */}
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="px-2.5 py-1 rounded-lg border border-mono-200 hover:bg-mono-100 text-mono-700 text-xs flex items-center gap-1.5 transition font-medium"
            >
              {isRegistering ? (
                <>
                  <UserCheck className="size-3.5" />
                  <span>View Card</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  <span>Register</span>
                </>
              )}
            </button>

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
        {isRegistering ? (
          <StudentRegistrationFlow
            onRegistrationComplete={handleRegistrationComplete}
          />
        ) : currentProfile ? (
          <StudentView
            studentId={currentProfile.school_id_no || '2023-01042'}
            studentName={currentProfile.full_name}
            department={currentProfile.department_id || 'CIT'}
            section={currentProfile.section_id || 'BSIT-3A'}
            eventId={eventId}
            tokenString={tokenString}
            secondsRemaining={secondsRemaining}
            attendanceRecords={attendanceRecords}
            onExportCard={() => window.print()}
          />
        ) : (
          <StudentRegistrationFlow
            onRegistrationComplete={handleRegistrationComplete}
          />
        )}

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
