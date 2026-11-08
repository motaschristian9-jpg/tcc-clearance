import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db/dexie';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { StoredRosterStudent } from '@/types/database';
import { Check, X, User, AlertCircle, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

interface PendingApprovalsViewProps {
  departmentId: string;
}

export const PendingApprovalsView: React.FC<PendingApprovalsViewProps> = ({ departmentId }) => {
  const [pendingStudents, setPendingStudents] = useState<StoredRosterStudent[]>([]);
  const [selectedRejectStudent, setSelectedRejectStudent] = useState<StoredRosterStudent | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Photo is not clear or centered');
  const [notification, setNotification] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadPending = async () => {
    setIsRefreshing(true);
    // 1. Sync from Supabase cloud if connected
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('department_id', departmentId)
          .eq('status', 'pending');

        if (!error && data && data.length > 0) {
          for (const item of data) {
            await db.roster.put({
              student_id: item.id || `std-${item.school_id_no}`,
              school_id_no: item.school_id_no,
              full_name: item.full_name,
              department_id: item.department_id,
              section_id: item.section_id || 'N/A',
              year_level: item.year_level || 1,
              public_key: item.public_key || '',
              thumb_data_url: item.thumb_data_url || item.photo_url,
              status: 'pending',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to query pending profiles from Supabase:', err);
      }
    }

    // 2. Load from Dexie cache
    const list = await db.roster
      .where('department_id')
      .equals(departmentId)
      .filter((s) => s.status === 'pending')
      .toArray();
    setPendingStudents(list);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadPending();
    const interval = setInterval(loadPending, 3500);
    return () => clearInterval(interval);
  }, [departmentId]);

  const handleApprove = async (student: StoredRosterStudent) => {
    await db.roster.update(student.student_id, { status: 'approved' });

    // Sync approval to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ status: 'approved' })
          .eq('school_id_no', student.school_id_no);
      } catch (err) {
        console.warn('Failed to update approval on Supabase:', err);
      }
    }

    // Also update profile if this device belongs to student
    const profile = await db.getProfile();
    if (profile && profile.school_id_no === student.school_id_no) {
      await db.profile.update(profile.id, { status: 'approved' });
    }

    setNotification(`Approved registration for ${student.full_name}`);
    setTimeout(() => setNotification(''), 3000);
    await loadPending();
  };

  const handleReject = async () => {
    if (!selectedRejectStudent) return;

    await db.roster.update(selectedRejectStudent.student_id, { status: 'rejected' });

    // Sync rejection to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ status: 'rejected', photo_status: 'needs_retake' })
          .eq('school_id_no', selectedRejectStudent.school_id_no);
      } catch (err) {
        console.warn('Failed to update rejection on Supabase:', err);
      }
    }

    const profile = await db.getProfile();
    if (profile && profile.school_id_no === selectedRejectStudent.school_id_no) {
      await db.profile.update(profile.id, {
        status: 'rejected',
        photo_status: 'needs_retake',
      });
    }

    setNotification(`Rejected ${selectedRejectStudent.full_name}: ${rejectReason}`);
    setSelectedRejectStudent(null);
    setTimeout(() => setNotification(''), 3000);
    await loadPending();
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto text-mono-900">
      <div className="bg-white border border-mono-200 rounded-xl p-5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-mono-500 uppercase font-semibold">Department Management</span>
          <h2 className="text-lg font-bold text-mono-900">
            Pending Student Approvals ({departmentId})
          </h2>
          <p className="text-xs text-mono-500">
            Review new student registrations and verify their face photo before approving.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPending}
          disabled={isRefreshing}
          className="p-2 border border-mono-200 hover:border-mono-900 rounded-lg text-mono-700 transition"
          title="Refresh List"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notification && (
        <div className="p-3 bg-mono-100 border border-mono-300 rounded-lg text-xs font-medium text-mono-900 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-mono-900" />
          <span>{notification}</span>
        </div>
      )}

      {pendingStudents.length > 0 ? (
        <div className="space-y-3">
          {pendingStudents.map((student) => (
            <div
              key={student.student_id}
              className="bg-white border border-mono-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                {/* Photo thumbnail */}
                <div className="size-16 rounded-xl bg-mono-100 border border-mono-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {student.thumb_data_url ? (
                    <img
                      src={student.thumb_data_url}
                      alt={student.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="size-8 text-mono-400" />
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-mono text-mono-500 block">
                    {student.school_id_no} &bull; {student.section_id}
                  </span>
                  <h3 className="text-base font-bold text-mono-900 leading-tight">
                    {student.full_name}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] text-mono-600 mt-1">
                    <Clock className="size-3" />
                    <span>Awaiting approval</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedRejectStudent(student)}
                  className="flex-1 sm:flex-initial h-10 px-3 border border-mono-300 hover:border-mono-900 text-mono-900 font-bold text-xs rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <X className="size-3.5" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(student)}
                  className="flex-1 sm:flex-initial h-10 px-4 bg-mono-950 hover:bg-mono-800 text-white font-bold text-xs rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <Check className="size-3.5" />
                  <span>Approve</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-mono-200 rounded-xl p-10 text-center space-y-2">
          <div className="size-10 rounded-full bg-mono-100 flex items-center justify-center mx-auto text-mono-400">
            <Check className="size-5" />
          </div>
          <h3 className="text-sm font-bold text-mono-900">No Pending Approvals</h3>
          <p className="text-xs text-mono-500 max-w-xs mx-auto">
            All registered students in the {departmentId} department have been reviewed and approved.
          </p>
        </div>
      )}

      {/* Reject Modal */}
      {selectedRejectStudent && (
        <div className="fixed inset-0 bg-mono-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mono-200 max-w-sm w-full rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-mono-200">
              <h3 className="font-bold text-mono-900 text-base">Reject Registration</h3>
              <button
                type="button"
                onClick={() => setSelectedRejectStudent(null)}
                className="p-1 text-mono-400 hover:text-mono-900"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-mono-600">
              Select a reason for rejecting <strong>{selectedRejectStudent.full_name}</strong>. The student will be prompted to retake their photo or fix their details.
            </p>

            <div className="space-y-2 text-xs">
              {[
                'Photo is not clear or centered',
                'Photo does not show a real face',
                'Incorrect department or section',
                'Invalid School ID number',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    rejectReason === reason
                      ? 'border-mono-900 bg-mono-50 font-bold text-mono-950'
                      : 'border-mono-200 text-mono-700 hover:bg-mono-50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRejectStudent(null)}
                className="flex-1 h-10 border border-mono-200 hover:bg-mono-100 text-mono-700 text-xs font-bold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 h-10 bg-mono-950 hover:bg-mono-800 text-white text-xs font-bold rounded-lg"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

