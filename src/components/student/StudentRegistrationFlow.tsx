import React, { useState } from 'react';
import { LivePhotoCapture } from '../camera/LivePhotoCapture';
import { VALID_DEPARTMENTS, validateStudentProfile } from '@/lib/camera/faceDetector';
import { generateECDSAKeyPair, exportPublicKeyRaw } from '@/lib/crypto/tokens';
import { db } from '@/lib/db/dexie';
import { StoredProfile, StoredRosterStudent } from '@/types/database';
import {
  ShieldCheck,
  User,
  Camera,
  CheckCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

interface StudentRegistrationFlowProps {
  onRegistrationComplete: (profile: StoredProfile) => void;
}

export const StudentRegistrationFlow: React.FC<StudentRegistrationFlowProps> = ({
  onRegistrationComplete,
}) => {
  const [step, setStep] = useState<'consent' | 'form' | 'photo' | 'pending'>('consent');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [schoolIdNo, setSchoolIdNo] = useState('');
  const [department, setDepartment] = useState('CIT');
  const [yearLevel, setYearLevel] = useState(3);
  const [section, setSection] = useState('BSIT-3A');
  const [formError, setFormError] = useState('');

  // Photo
  const [photo480, setPhoto480] = useState<string | null>(null);
  const [thumb160, setThumb160] = useState<string | null>(null);

  // Submitted profile
  const [createdProfile, setCreatedProfile] = useState<StoredProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConsentAccept = () => {
    setStep('form');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateStudentProfile({
      full_name: fullName,
      school_id_no: schoolIdNo,
      department_id: department,
      section_id: section,
      year_level: Number(yearLevel),
      consent_agreed: true,
    });

    if (!validation.valid) {
      setFormError(validation.reason || 'Please complete all required fields.');
      return;
    }

    setFormError('');
    setStep('photo');
  };

  const handlePhotoCaptured = async (p480: string, t160: string) => {
    setPhoto480(p480);
    setThumb160(t160);
    setIsSubmitting(true);

    try {
      // 1. Generate Non-Extractable Device Key Pair
      const keyPair = await generateECDSAKeyPair(false);
      const rawPub = await exportPublicKeyRaw(keyPair.publicKey);

      // Save key to local Dexie keys
      await db.saveDeviceKey({
        id: 'student-device-key',
        publicKeyRaw: rawPub,
        role: 'student',
        createdAt: new Date().toISOString(),
      });

      const profileId = `prof-${schoolIdNo}`;
      const newProfile: StoredProfile = {
        id: profileId,
        email: `${schoolIdNo.toLowerCase()}@tagoloan.edu.ph`,
        role: 'student',
        full_name: fullName.trim(),
        school_id_no: schoolIdNo.trim(),
        department_id: department,
        section_id: section.trim(),
        year_level: Number(yearLevel),
        photo_path: p480,
        thumb_path: t160,
        photo_status: 'accepted',
        status: 'pending', // Starts as pending SBO approval
      };

      // 2. Save profile in Dexie
      await db.saveProfile(newProfile);

      // 3. Put into department roster in Dexie
      const rosterEntry: StoredRosterStudent = {
        student_id: `std-${schoolIdNo.trim()}`,
        school_id_no: schoolIdNo.trim(),
        full_name: fullName.trim(),
        department_id: department,
        section_id: section.trim(),
        year_level: Number(yearLevel),
        public_key: rawPub,
        thumb_data_url: t160,
        status: 'pending',
      };
      await db.roster.put(rosterEntry);

      setCreatedProfile(newProfile);
      setStep('pending');
    } catch (err) {
      setFormError((err as Error).message || 'Failed to complete registration.');
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstantApprove = async () => {
    if (!createdProfile) return;
    const approvedProfile: StoredProfile = {
      ...createdProfile,
      status: 'approved',
    };
    await db.saveProfile(approvedProfile);

    // Also update roster
    const student = await db.findStudentBySchoolId(createdProfile.school_id_no || '');
    if (student) {
      student.status = 'approved';
      await db.roster.put(student);
    }

    onRegistrationComplete(approvedProfile);
  };

  return (
    <div className="max-w-md mx-auto py-6">
      {/* Step 1: Privacy Agreement */}
      {step === 'consent' && (
        <div className="bg-white border border-mono-200 rounded-xl overflow-hidden ring-1 ring-mono-900/5 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="size-10 rounded-lg bg-mono-100 flex items-center justify-center text-mono-800">
              <ShieldCheck className="size-5" />
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-mono-950">
                Student Registration &amp; Consent
              </h2>
              <p className="text-xs text-mono-500 mt-1">
                Data Privacy Act of 2012 (Republic Act No. 10173)
              </p>
            </div>

            <div className="p-4 bg-mono-50 rounded-lg border border-mono-200 text-xs text-mono-700 space-y-2.5 leading-relaxed">
              <p>
                To provide you with a digital event clearance card and eliminate long queues at event gates, Tagoloan Community College collects:
              </p>
              <ul className="list-disc list-inside space-y-1 text-mono-600 pl-1">
                <li>Your Full Name and School ID Number</li>
                <li>Your Department, Year Level, and Section</li>
                <li>A live face photo for entrance identity verification</li>
              </ul>
              <p className="pt-1 text-[11px] text-mono-500">
                <strong>Data Retention:</strong> Your photo and temporary scan records are used only for official campus activity clearance and will be safely cleared at the end of the school year.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-mono-200 bg-mono-50/80">
            <button
              type="button"
              onClick={handleConsentAccept}
              className="w-full h-11 bg-mono-950 hover:bg-mono-800 text-white font-semibold text-xs rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>I Agree &amp; Continue</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Student Information Form */}
      {step === 'form' && (
        <div className="bg-white border border-mono-200 rounded-xl overflow-hidden ring-1 ring-mono-900/5 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-mono-200">
              <button
                type="button"
                onClick={() => setStep('consent')}
                className="p-1 rounded hover:bg-mono-100 text-mono-500"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div>
                <h2 className="text-base font-bold text-mono-950">Enter Student Details</h2>
                <p className="text-xs text-mono-500">Fill in your official school information</p>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-mono-100 border border-mono-300 rounded-lg text-xs flex items-center gap-2 text-mono-900">
                <AlertCircle className="size-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-mono-700 block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 border border-mono-300 rounded-lg px-3 focus:border-mono-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-mono-700 block">School ID Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2023-01042"
                  value={schoolIdNo}
                  onChange={(e) => setSchoolIdNo(e.target.value)}
                  className="w-full h-10 border border-mono-300 rounded-lg px-3 font-mono focus:border-mono-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-mono-700 block">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 border border-mono-300 rounded-lg px-2.5 bg-white focus:border-mono-900 outline-none"
                >
                  <option value="CIT">College of Information Technology (CIT)</option>
                  <option value="CBA">College of Business Administration (CBA)</option>
                  <option value="CED">College of Education (CED)</option>
                  <option value="CCJPS">College of Criminal Justice &amp; Public Safety (CCJPS)</option>
                  <option value="CHM">College of Hospitality Management (CHM)</option>
                  <option value="CAS">College of Arts and Sciences (CAS)</option>
                  <option value="COM">College of Midwifery (COM)</option>
                  <option value="CLIS">College of Library and Information Science (CLIS)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-mono-700 block">Year Level</label>
                  <select
                    value={yearLevel}
                    onChange={(e) => setYearLevel(Number(e.target.value))}
                    className="w-full h-10 border border-mono-300 rounded-lg px-2.5 bg-white focus:border-mono-900 outline-none"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-mono-700 block">Section</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BSIT-3A"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full h-10 border border-mono-300 rounded-lg px-3 focus:border-mono-900 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full h-11 bg-mono-950 hover:bg-mono-800 text-white font-semibold text-xs rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Continue to Live Photo</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 3: Live Photo Capture */}
      {step === 'photo' && (
        <div className="bg-white border border-mono-200 rounded-xl overflow-hidden ring-1 ring-mono-900/5 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-mono-200">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="p-1 rounded hover:bg-mono-100 text-mono-500"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <h2 className="text-base font-bold text-mono-950">Identity Photo</h2>
              <p className="text-xs text-mono-500">Live front camera check</p>
            </div>
          </div>

          <LivePhotoCapture
            onPhotoCaptured={handlePhotoCaptured}
            onCancel={() => setStep('form')}
          />
        </div>
      )}

      {/* Step 4: Submitted & Waiting for Approval */}
      {step === 'pending' && createdProfile && (
        <div className="bg-white border border-mono-200 rounded-xl overflow-hidden ring-1 ring-mono-900/5 shadow-sm text-center">
          <div className="p-8 space-y-4">
            <div className="size-12 rounded-full bg-mono-100 mx-auto flex items-center justify-center text-mono-900">
              <Clock className="size-6 text-mono-900" />
            </div>

            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mono-100 border border-mono-300 text-mono-800 uppercase tracking-wider">
                Pending Approval
              </span>
              <h2 className="text-xl font-bold text-mono-950 mt-2">
                Registration Submitted!
              </h2>
              <p className="text-xs text-mono-500 max-w-xs mx-auto">
                Waiting for approval from the <strong>{createdProfile.department_id} SBO Officer</strong>.
              </p>
            </div>

            {/* Profile Summary Card */}
            <div className="border border-mono-200 rounded-xl p-4 bg-mono-50 text-left text-xs space-y-2 max-w-xs mx-auto">
              <div className="flex justify-between">
                <span className="text-mono-400">Student Name:</span>
                <strong className="text-mono-900">{createdProfile.full_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-mono-400">School ID:</span>
                <strong className="text-mono-900 font-mono">{createdProfile.school_id_no}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-mono-400">Department:</span>
                <strong className="text-mono-900">{createdProfile.department_id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-mono-400">Section:</span>
                <strong className="text-mono-900">{createdProfile.section_id}</strong>
              </div>
            </div>

            <p className="text-[11px] text-mono-400 max-w-xs mx-auto">
              Once approved, your clearance activity card and live QR code will appear here automatically.
            </p>
          </div>

          {/* Quick Demo Approval Button */}
          <div className="p-4 border-t border-mono-200 bg-mono-50/80">
            <button
              type="button"
              onClick={handleInstantApprove}
              className="w-full h-10 bg-mono-950 hover:bg-mono-800 text-white font-semibold text-xs rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="size-4" />
              <span>Approve &amp; Open My Card</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

