import React from 'react';
import { QRCodeSVG } from '../common/QRCode';
import { StoredAttendanceRecord } from '@/types/database';
import { RefreshCw, Check, Download } from 'lucide-react';

interface StudentViewProps {
  studentId: string;
  studentName: string;
  department: string;
  section: string;
  eventId: string;
  tokenString: string;
  secondsRemaining: number;
  attendanceRecords: StoredAttendanceRecord[];
  onExportCard?: () => void;
}

const DAYS = [
  { dayNo: 1, label: 'DAY 1' },
  { dayNo: 2, label: 'DAY 2' },
  { dayNo: 3, label: 'DAY 3' },
  { dayNo: 4, label: 'DAY 4' },
  { dayNo: 5, label: 'DAY 5' },
];

const SLOTS = [
  { id: 'morning-in', label: 'Time In', sub: 'Morning' },
  { id: 'morning-out', label: 'Time Out', sub: 'Morning' },
  { id: 'afternoon-in', label: 'Time In', sub: 'Afternoon' },
  { id: 'afternoon-out', label: 'Time Out', sub: 'Afternoon' },
];

export const StudentView: React.FC<StudentViewProps> = ({
  studentId,
  studentName,
  department,
  section,
  tokenString,
  secondsRemaining,
  attendanceRecords,
  onExportCard,
}) => {
  const getSlotRecord = (dayNo: number, slotId: string) => {
    const fullSlotId = `day${dayNo}-${slotId}`;
    return attendanceRecords.find((r) => r.slot_id === fullSlotId && r.status === 'valid');
  };

  const totalSigned = attendanceRecords.filter((r) => r.status === 'valid').length;

  return (
    <div className="space-y-6">
      {/* 1. Student QR Section */}
      <div className="bg-white border border-mono-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-mono-200 gap-2">
          <div>
            <span className="text-xs text-mono-500 uppercase font-semibold">Event Check-in</span>
            <h2 className="text-lg font-bold text-mono-900">Show this QR to the Officer</h2>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 bg-mono-100 rounded-full text-xs font-medium text-mono-700">
            <RefreshCw className="w-3 h-3 animate-spin text-mono-500" />
            <span>Refreshes in {secondsRemaining}s</span>
          </div>
        </div>

        <div className="py-6 flex flex-col items-center justify-center">
          <div className="p-3 bg-white border-2 border-mono-900 rounded-xl inline-block">
            {tokenString ? (
              <QRCodeSVG value={tokenString} size={190} />
            ) : (
              <div className="w-[190px] h-[190px] bg-mono-100 flex items-center justify-center text-xs text-mono-400">
                Loading QR...
              </div>
            )}
          </div>
          <p className="text-xs text-mono-500 mt-3 text-center">
            This QR code refreshes every 30 seconds for security.
          </p>
        </div>

        <div className="pt-4 border-t border-mono-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="border border-mono-200 rounded-lg p-2.5">
            <span className="text-mono-400 block text-[11px]">School ID</span>
            <span className="font-bold text-mono-900">{studentId}</span>
          </div>
          <div className="border border-mono-200 rounded-lg p-2.5">
            <span className="text-mono-400 block text-[11px]">Department</span>
            <span className="font-bold text-mono-900">{department}</span>
          </div>
          <div className="border border-mono-200 rounded-lg p-2.5">
            <span className="text-mono-400 block text-[11px]">Section</span>
            <span className="font-bold text-mono-900">{section}</span>
          </div>
          <div className="border border-mono-200 rounded-lg p-2.5">
            <span className="text-mono-400 block text-[11px]">Completed</span>
            <span className="font-bold text-mono-900">{totalSigned} of 20 Signatures</span>
          </div>
        </div>
      </div>

      {/* 2. Official Activity Card */}
      <div className="bg-white border border-mono-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-mono-500 uppercase font-semibold">Clearance Card</span>
            <h2 className="text-lg font-bold text-mono-900">CIT Intramurals 2026</h2>
          </div>
          {onExportCard && (
            <button
              type="button"
              onClick={onExportCard}
              className="min-h-touch px-4 py-2 bg-mono-900 hover:bg-mono-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Print or Save</span>
            </button>
          )}
        </div>

        {/* Card Canvas */}
        <div className="border-2 border-mono-900 p-5 sm:p-6 rounded-lg bg-white space-y-6">
          <div className="text-center space-y-1 pb-4 border-b border-mono-200">
            <div className="text-xs uppercase font-bold text-mono-600 tracking-wider">
              Tagoloan Community College
            </div>
            <h3 className="text-base sm:text-lg font-black text-mono-900 uppercase">
              College of Information Technology
            </h3>
            <p className="text-xs text-mono-600 font-medium">Activity Card &bull; Attendance</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-mono-200 text-xs">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-mono-500 uppercase">Name:</span>
              <span className="border-b border-mono-900 flex-1 font-bold text-mono-900 pb-0.5">{studentName}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-mono-500 uppercase">Year &amp; Section:</span>
              <span className="border-b border-mono-900 flex-1 font-bold text-mono-900 pb-0.5">{section}</span>
            </div>
          </div>

          {/* Days */}
          <div className="space-y-4">
            {DAYS.map((day) => (
              <div key={day.dayNo} className="border border-mono-300 rounded-lg overflow-hidden">
                <div className="bg-mono-900 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>{day.label}</span>
                  <span className="text-[11px] text-mono-300 font-normal">Morning &amp; Afternoon</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-mono-200 bg-white">
                  {SLOTS.map((slot) => {
                    const record = getSlotRecord(day.dayNo, slot.id);
                    return (
                      <div key={slot.id} className="p-3 flex flex-col justify-between min-h-[85px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-mono-900">{slot.label}</span>
                          <span className="text-[11px] text-mono-500">{slot.sub}</span>
                        </div>

                        <div className="my-2 flex flex-col items-center justify-center">
                          {record ? (
                            <div className="text-center">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-mono-900 border border-mono-900 rounded px-2 py-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Signed</span>
                              </span>
                            </div>
                          ) : (
                            <div className="w-full border-b border-dashed border-mono-300 my-2"></div>
                          )}
                        </div>

                        <div className="text-center pt-1 border-t border-mono-100">
                          <span className="text-[10px] text-mono-400 block">
                            {day.dayNo <= 3 ? 'SBO Auditor' : 'SBO Vice Gov'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-mono-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-mono-600 gap-2">
            <div>
              <span>Approved by: </span>
              <strong className="text-mono-900">CIT Department Adviser</strong>
            </div>
            <div>
              <span>Total Signatures: </span>
              <strong className="text-mono-900">{totalSigned} of 20</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
