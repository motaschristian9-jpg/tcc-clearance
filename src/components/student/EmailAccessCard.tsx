import React, { useState, useEffect } from 'react';
import { Mail, ArrowRight, ShieldCheck, User, Building, BookOpen, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../../lib/db/dexie';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { generateECDSAKeyPair, exportPublicKeyRaw } from '../../lib/crypto/tokens';
import { StoredProfile, StoredRosterStudent } from '../../types/database';

interface EmailAccessCardProps {
  onAccessGranted: (profile: StoredProfile) => void;
  initialEmail?: string;
}

const DEPARTMENTS = [
  { id: 'CIT', name: 'College of Information Technology' },
  { id: 'CBA', name: 'College of Business Administration' },
  { id: 'CED', name: 'College of Education' },
  { id: 'CCJPS', name: 'College of Criminal Justice and Public Safety' },
  { id: 'CHM', name: 'College of Hospitality Management' },
  { id: 'CAS', name: 'College of Arts and Sciences' },
  { id: 'COM', name: 'College of Operations Management' },
  { id: 'CLIS', name: 'College of Library and Information Science' },
];

export const EmailAccessCard: React.FC<EmailAccessCardProps> = ({
  onAccessGranted,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState<string>(initialEmail);
  const [schoolIdNo, setSchoolIdNo] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('CIT');
  const [sectionId, setSectionId] = useState<string>('BSIT-3A');
  const [showCustomDetails, setShowCustomDetails] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Auto-parse email to derive smart defaults
  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) return;

    const [userPart] = trimmed.split('@');
    const cleanUser = userPart.toLowerCase();

    // Check if userPart has student ID pattern (e.g. 2023-01042 or 202301042)
    const idMatch = cleanUser.match(/\d{4}-?\d{4,5}/);
    if (idMatch) {
      const rawDigits = idMatch[0].replace('-', '');
      const formattedId = `${rawDigits.slice(0, 4)}-${rawDigits.slice(4)}`;
      if (!schoolIdNo || schoolIdNo.startsWith('202')) {
        setSchoolIdNo(formattedId);
      }
      if (!fullName) {
        setFullName(`Student ${formattedId}`);
      }
    } else if (cleanUser.includes('.')) {
      // Name pattern e.g. juan.delacruz
      const parts = cleanUser.split('.');
      const formattedName = parts
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
      if (!fullName) {
        setFullName(formattedName);
      }
      if (!schoolIdNo) {
        // Generate consistent fallback student ID
        const hash = Math.abs(
          cleanUser.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
        );
        setSchoolIdNo(`2026-${(hash % 90000 + 10000)}`);
      }
    } else {
      if (!fullName) {
        const capitalized = cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1);
        setFullName(capitalized || 'Student');
      }
      if (!schoolIdNo) {
        setSchoolIdNo('2023-01042');
      }
    }
  }, [email, schoolIdNo, fullName]);

  const handleSelectPreset = (presetEmail: string, presetName: string, presetId: string, presetDept: string, presetSec: string) => {
    setEmail(presetEmail);
    setFullName(presetName);
    setSchoolIdNo(presetId);
    setDepartmentId(presetDept);
    setSectionId(presetSec);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      setErrorMessage('Please enter a valid student or institutional email address.');
      return;
    }

    setIsProcessing(true);

    try {
      const derivedId = (schoolIdNo.trim() || cleanEmail.split('@')[0]).toUpperCase();
      const derivedName = fullName.trim() || `Student ${derivedId}`;

      let existingProfile: StoredProfile | null = null;

      // 1. Check local Dexie first for existing profile with this email or ID
      const localProfiles = await db.profile.toArray();
      const localMatch = localProfiles.find(
        (p) => p.email?.toLowerCase() === cleanEmail || p.school_id_no === derivedId
      );
      if (localMatch) {
        existingProfile = localMatch;
      }

      // 2. Check Supabase cloud database if online
      if (!existingProfile && isSupabaseConfigured && supabase && navigator.onLine) {
        try {
          // Query by email or school_id_no
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`school_id_no.eq.${derivedId},id.eq.${derivedId}`)
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            existingProfile = {
              id: data.id,
              email: data.email || cleanEmail,
              role: 'student',
              full_name: data.full_name || derivedName,
              school_id_no: data.school_id_no || derivedId,
              department_id: data.department_id || departmentId,
              section_id: data.section_id || sectionId,
              year_level: data.year_level || 3,
              photo_path: data.photo_url,
              thumb_path: data.thumb_data_url,
              photo_status: 'accepted',
              status: 'approved',
            };
          }
        } catch (cloudErr) {
          console.warn('Could not query Supabase profile, continuing with local initialization:', cloudErr);
        }
      }

      // 3. Generate device ECDSA keys
      const keyPair = await generateECDSAKeyPair(false);
      const rawPub = await exportPublicKeyRaw(keyPair.publicKey);

      await db.saveDeviceKey({
        id: 'student-device-key',
        publicKeyRaw: rawPub,
        role: 'student',
        createdAt: new Date().toISOString(),
      });

      // 4. If existing profile found, use it; otherwise construct a new approved profile
      const activeProfile: StoredProfile = existingProfile || {
        id: `prof-${derivedId}`,
        email: cleanEmail,
        role: 'student',
        full_name: derivedName,
        school_id_no: derivedId,
        department_id: departmentId,
        section_id: sectionId,
        year_level: 3,
        photo_status: 'accepted',
        status: 'approved', // Instant access!
      };

      // Ensure status is approved
      activeProfile.status = 'approved';

      // Save to local Dexie
      await db.saveProfile(activeProfile);

      // Cache into local roster
      const rosterStudent: StoredRosterStudent = {
        student_id: activeProfile.school_id_no || activeProfile.id,
        school_id_no: activeProfile.school_id_no || derivedId,
        full_name: activeProfile.full_name,
        department_id: activeProfile.department_id || departmentId,
        section_id: activeProfile.section_id || sectionId,
        year_level: activeProfile.year_level || 3,
        public_key: rawPub,
        status: 'approved',
      };
      await db.roster.put(rosterStudent);

      // 5. If online, sync/upsert profile to Supabase so SBO officer scanners see this student immediately!
      if (isSupabaseConfigured && supabase && navigator.onLine) {
        try {
          await supabase.from('profiles').upsert(
            {
              school_id_no: activeProfile.school_id_no,
              full_name: activeProfile.full_name,
              role: 'student',
              department_id: activeProfile.department_id,
              section_id: activeProfile.section_id,
              year_level: activeProfile.year_level || 3,
              public_key: rawPub,
              status: 'approved',
              photo_status: 'accepted',
              email: cleanEmail,
            },
            { onConflict: 'school_id_no' }
          );
        } catch (supErr) {
          // If upsert with email column fails (e.g. column not yet added to remote table), retry without email
          try {
            await supabase.from('profiles').upsert(
              {
                school_id_no: activeProfile.school_id_no,
                full_name: activeProfile.full_name,
                role: 'student',
                department_id: activeProfile.department_id,
                section_id: activeProfile.section_id,
                year_level: activeProfile.year_level || 3,
                public_key: rawPub,
                status: 'approved',
                photo_status: 'accepted',
              },
              { onConflict: 'school_id_no' }
            );
          } catch {
            // Local profile is already saved in Dexie, proceed gracefully
          }
        }
      }

      // Persist active email in localStorage
      localStorage.setItem('tcc_active_student_email', cleanEmail);

      // Return active profile
      onAccessGranted(activeProfile);
    } catch (err: any) {
      console.error('Failed to access clearance card:', err);
      setErrorMessage(err?.message || 'Failed to initialize clearance card. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Identity Card */}
      <div className="bg-white border border-mono-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-mono-100 text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-xl bg-mono-950 text-white shadow-sm mb-1">
            <ShieldCheck className="size-6 text-white stroke-[2.2]" />
          </div>
          <div className="text-[11px] font-bold text-mono-500 uppercase tracking-wider">
            Tagoloan Community College
          </div>
          <h2 className="text-xl font-bold text-mono-950 tracking-tight">
            Activity Card Clearance
          </h2>
          <p className="text-xs text-mono-500 leading-relaxed max-w-xs mx-auto">
            Enter your student email below to open your digital activity clearance card with live rotating QR code.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-mono-100 border border-mono-300 rounded-xl text-xs text-mono-900 flex items-start gap-2">
              <AlertCircle className="size-4 flex-shrink-0 mt-0.5 text-mono-900" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1.5">
            <label htmlFor="student-email" className="block text-xs font-semibold text-mono-900">
              Student Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-mono-400">
                <Mail className="size-4" />
              </div>
              <input
                id="student-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. 2023-01042@tagoloan.edu.ph"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-mono-300 bg-white text-sm text-mono-900 placeholder:text-mono-400 focus:outline-none focus:border-mono-900 focus:ring-1 focus:ring-mono-900 transition font-medium"
              />
            </div>
            <p className="text-[11px] text-mono-500">
              Your institutional or personal email linked to your clearance.
            </p>
          </div>

          {/* Collapsible / Optional Profile Customization */}
          <div className="pt-2 border-t border-mono-100">
            <button
              type="button"
              onClick={() => setShowCustomDetails(!showCustomDetails)}
              className="text-xs font-semibold text-mono-700 hover:text-mono-950 flex items-center justify-between w-full py-1 text-left"
            >
              <span>{showCustomDetails ? '− Hide card details' : '+ Customize Name & ID (Optional)'}</span>
              <span className="text-[11px] text-mono-400 font-normal">
                {showCustomDetails ? 'Using custom' : 'Auto-detected'}
              </span>
            </button>

            {showCustomDetails && (
              <div className="mt-3 p-3.5 bg-mono-50 border border-mono-200 rounded-xl space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block font-semibold text-mono-800">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-3 py-2 rounded-lg border border-mono-300 bg-white text-xs font-medium text-mono-900 focus:outline-none focus:border-mono-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block font-semibold text-mono-800">School ID No.</label>
                    <input
                      type="text"
                      value={schoolIdNo}
                      onChange={(e) => setSchoolIdNo(e.target.value)}
                      placeholder="2023-01042"
                      className="w-full px-3 py-2 rounded-lg border border-mono-300 bg-white text-xs font-mono font-medium text-mono-900 focus:outline-none focus:border-mono-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-mono-800">Section</label>
                    <input
                      type="text"
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      placeholder="BSIT-3A"
                      className="w-full px-3 py-2 rounded-lg border border-mono-300 bg-white text-xs font-medium text-mono-900 focus:outline-none focus:border-mono-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-mono-800">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-mono-300 bg-white text-xs font-medium text-mono-900 focus:outline-none focus:border-mono-900"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing || !email.trim()}
            className="w-full h-12 bg-mono-950 hover:bg-mono-800 active:scale-[0.99] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" />
                <span>Loading Clearance Card...</span>
              </>
            ) : (
              <>
                <span>Access My Clearance Card</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Selection Bar for Testing on Mobile / Laptop */}
        <div className="p-4 bg-mono-50 border-t border-mono-200">
          <div className="text-[11px] font-semibold text-mono-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="size-3 text-mono-500" />
            <span>Quick Test Profiles (1-Tap):</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() =>
                handleSelectPreset(
                  '2023-01042@tagoloan.edu.ph',
                  'Juan Dela Cruz',
                  '2023-01042',
                  'CIT',
                  'BSIT-3A'
                )
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-mono-200 bg-white hover:bg-mono-100 text-xs flex items-center justify-between transition text-mono-800"
            >
              <span className="font-semibold">Juan Dela Cruz (CIT)</span>
              <span className="text-[11px] font-mono text-mono-500">2023-01042</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSelectPreset(
                  '2023-01043@tagoloan.edu.ph',
                  'Maria Santos',
                  '2023-01043',
                  'CIT',
                  'BSIT-3A'
                )
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-mono-200 bg-white hover:bg-mono-100 text-xs flex items-center justify-between transition text-mono-800"
            >
              <span className="font-semibold">Maria Santos (CIT)</span>
              <span className="text-[11px] font-mono text-mono-500">2023-01043</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSelectPreset(
                  '2023-02001@tagoloan.edu.ph',
                  'Gabriel Silang',
                  '2023-02001',
                  'CCJPS',
                  'BSCrim-1B'
                )
              }
              className="text-left px-2.5 py-1.5 rounded-lg border border-mono-200 bg-white hover:bg-mono-100 text-xs flex items-center justify-between transition text-mono-800"
            >
              <span className="font-semibold">Gabriel Silang (CCJPS)</span>
              <span className="text-[11px] font-mono text-mono-500">2023-02001</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
