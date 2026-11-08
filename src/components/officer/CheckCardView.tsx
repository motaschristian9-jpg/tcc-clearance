import React, { useState } from 'react';
import { Search, Check, AlertOctagon, User, ShieldCheck } from 'lucide-react';
import { StoredRosterStudent, StoredAttendanceRecord } from '@/types/database';
import { db } from '@/lib/db/dexie';

interface CheckCardViewProps {
  onBack?: () => void;
}

const DAYS = [
  { dayNo: 1, label: 'Day 1' },
  { dayNo: 2, label: 'Day 2' },
  { dayNo: 3, label: 'Day 3' },
  { dayNo: 4, label: 'Day 4' },
  { dayNo: 5, label: 'Day 5' },
];

const SLOTS = [
  { id: 'morning-in', label: 'Morning In' },
  { id: 'morning-out', label: 'Morning Out' },
  { id: 'afternoon-in', label: 'Afternoon In' },
  { id: 'afternoon-out', label: 'Afternoon Out' },
];

export const CheckCardView: React.FC<CheckCardViewProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StoredRosterStudent | null>(null);
  const [attendanceList, setAttendanceList] = useState<StoredAttendanceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    let student = await db.findStudentBySchoolId(searchQuery.trim());
    if (!student) {
      student = await db.roster
        .filter((s) => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
        .first();
    }

    if (student) {
      setSelectedStudent(student);
      const records = await db.getStudentAttendance(student.student_id, 'cit-intramurals-2026');
      setAttendanceList(records);
    } else {
      setSelectedStudent(null);
      setAttendanceList([]);
    }
    setIsSearching(false);
  };

  const getSlotStatus = (dayNo: number, slotId: string) => {
    const fullSlotId = `day${dayNo}-${slotId}`;
    return attendanceList.find((r) => r.slot_id === fullSlotId && r.status === 'valid');
  };

  const totalVerified = attendanceList.filter((r) => r.status === 'valid').length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white border border-mono-200 rounded-xl p-6 space-y-4">
        <div>
          <span className="text-xs text-mono-500 uppercase font-semibold">Clearance Check</span>
          <h2 className="text-lg font-bold text-mono-900">Check Student Clearance</h2>
          <p className="text-xs text-mono-600 mt-1">
            Search a student's ID number to see if they completed all attendance slots for this event.
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Student ID (e.g. 2023-01042)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-h-touch border border-mono-300 rounded-lg px-3 text-xs focus:border-mono-900 outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="min-h-touch px-5 bg-mono-900 hover:bg-mono-800 text-white rounded-lg text-xs font-bold transition active:scale-[0.98] flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </form>
      </div>

      {selectedStudent ? (
        <div className="bg-white border border-mono-200 rounded-xl p-6 space-y-6">
          {/* Student Profile Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-mono-200">
            <div className="w-14 h-14 rounded-lg bg-mono-100 border border-mono-200 flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-mono-400" />
            </div>
            <div className="flex-1">
              <span className="text-xs text-mono-500 block">
                {selectedStudent.school_id_no} &bull; {selectedStudent.department_id}
              </span>
              <h3 className="text-xl font-bold text-mono-900">{selectedStudent.full_name}</h3>
              <p className="text-xs text-mono-600">{selectedStudent.section_id}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-mono-900">
                {totalVerified} <span className="text-xs font-normal text-mono-400">/ 20</span>
              </div>
              <span className="text-[11px] text-mono-500">Signatures</span>
            </div>
          </div>

          {/* Verification Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-mono-500 font-semibold">
              Event Attendance Record
            </h4>

            <div className="space-y-3">
              {DAYS.map((day) => (
                <div key={day.dayNo} className="border border-mono-200 rounded-lg overflow-hidden">
                  <div className="bg-mono-100 px-3 py-1.5 text-xs font-bold text-mono-900 border-b border-mono-200 flex justify-between">
                    <span>{day.label}</span>
                    <span className="text-[11px] text-mono-500">Intramurals 2026</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-mono-100 bg-white">
                    {SLOTS.map((slot) => {
                      const record = getSlotStatus(day.dayNo, slot.id);
                      return (
                        <div key={slot.id} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-mono-900 block">{slot.label}</span>
                            <span className="text-[11px] text-mono-400">
                              {record ? `Signed at ${new Date(record.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet signed'}
                            </span>
                          </div>

                          {record ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-mono-900 border border-mono-900 px-2 py-0.5 rounded">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Signed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-mono-400 border border-mono-200 px-2 py-0.5 rounded">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              <span>Missing</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-mono-50 border border-mono-200 rounded-lg text-xs text-mono-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-mono-900 flex-shrink-0" />
            <span>Official digital record verified.</span>
          </div>
        </div>
      ) : searchQuery ? (
        <div className="p-8 text-center text-xs text-mono-400 bg-white border border-mono-200 rounded-xl">
          No student found with ID "{searchQuery}".
        </div>
      ) : null}
    </div>
  );
};
