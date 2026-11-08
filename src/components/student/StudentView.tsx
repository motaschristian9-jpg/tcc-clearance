import React from 'react';
import { QRCodeSVG } from '../common/QRCode';
import { StoredAttendanceRecord } from '@/types/database';
import { RefreshCw, Check, Clock, Download, ArrowUpRight } from 'lucide-react';

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
  { id: 'morning-in', label: 'Time In', sub: 'AM' },
  { id: 'morning-out', label: 'Time Out', sub: 'AM' },
  { id: 'afternoon-in', label: 'Time In', sub: 'PM' },
  { id: 'afternoon-out', label: 'Time Out', sub: 'PM' },
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

  return (
    <div className="space-y-6">
      {/* 1. Student Rotating QR Section (HCI Principle: Direct Action first) */}
      <div className="bg-white border border-mono-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-mono-200 gap-2">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-mono-500">Live Clearance Token</span>
            <h2 className="text-base font-bold text-mono-900">Show to SBO Officer at Venue</h2>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-mono-100 border border-mono-200 rounded text-xs font-mono text-mono-700">
              <RefreshCw className="w-3 h-3 animate-spin text-mono-500" />
              <span>Rotates in {secondsRemaining}s</span>
            </span>
          </div>
        </div>

        <div className="py-6 flex flex-col items-center justify-center">
          <div className="p-3 bg-white border-2 border-mono-900 rounded-lg inline-block">
            {tokenString ? (
              <QRCodeSVG value={tokenString} size={180} />
            ) : (
              <div className="w-[180px] h-[180px] bg-mono-100 flex items-center justify-center text-xs font-mono text-mono-400">
                Generating Key...
              </div>
            )}
          </div>
          <p className="text-xs text-mono-500 font-mono mt-3 text-center">
            Signed by device key &bull; Screenshot expires in 30s
          </p>
        </div>

        <div className="pt-4 border-t border-mono-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="border border-mono-200 rounded p-2.5">
            <span className="text-mono-400 block text-[10px] uppercase">Student ID</span>
            <span className="font-bold text-mono-900">{studentId}</span>
          </div>
          <div className="border border-mono-200 rounded p-2.5">
            <span className="text-mono-400 block text-[10px] uppercase">Department</span>
            <span className="font-bold text-mono-900">{department}</span>
          </div>
          <div className="border border-mono-200 rounded p-2.5">
            <span className="text-mono-400 block text-[10px] uppercase">Section</span>
            <span className="font-bold text-mono-900">{section}</span>
          </div>
          <div className="border border-mono-200 rounded p-2.5">
            <span className="text-mono-400 block text-[10px] uppercase">Cryptographic Key</span>
            <span className="font-bold text-mono-900">ECDSA P-256</span>
          </div>
        </div>
      </div>

      {/* 2. Official CIT Intramurals Digital Activity Card */}
      <div className="bg-white border border-mono-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-mono-500">Official Record</span>
            <h2 className="text-lg font-bold text-mono-900">Digital Activity Card</h2>
          </div>
          {onExportCard && (
            <button
              type="button"
              onClick={onExportCard}
              className="min-h-touch px-4 py-2 bg-mono-900 hover:bg-mono-800 text-white rounded text-xs font-medium flex items-center gap-2 transition active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF / Image</span>
            </button>
          )}
        </div>

        {/* The Card Container (Printable layout standard) */}
        <div className="border-2 border-mono-900 p-6 rounded-lg bg-white space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-1 pb-4 border-b border-mono-200">
            <div className="inline-block px-2 py-0.5 border border-mono-900 rounded text-[10px] font-mono uppercase tracking-widest text-mono-900 font-bold mb-1">
              Tagoloan Community College
            </div>
            <h3 className="text-base font-black tracking-tight text-mono-900 uppercase">
              College of Information Technology
            </h3>
            <p className="text-xs font-mono text-mono-600">Intramurals 2026 &bull; ATTENDANCE</p>
          </div>

          {/* Student Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-mono-200 text-xs">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-mono-600 uppercase text-[11px]">NAME:</span>
              <span className="border-b border-mono-900 flex-1 font-bold text-mono-900 pb-0.5">{studentName}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-mono-600 uppercase text-[11px]">YEAR &amp; SECTION:</span>
              <span className="border-b border-mono-900 flex-1 font-bold text-mono-900 pb-0.5">{section}</span>
            </div>
          </div>

          {/* 5 Days Grid */}
          <div className="space-y-4">
            {DAYS.map((day) => (
              <div key={day.dayNo} className="border border-mono-300 rounded overflow-hidden">
                {/* Day Strip */}
                <div className="bg-mono-900 text-white px-3 py-1 text-xs font-mono font-bold flex items-center justify-between">
                  <span>{day.label}</span>
                  <span className="text-[10px] text-mono-400 font-normal">4 Slots</span>
                </div>

                {/* 4 Signature Slots */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-mono-200 bg-white">
                  {SLOTS.map((slot) => {
                    const record = getSlotRecord(day.dayNo, slot.id);
                    return (
                      <div key={slot.id} className="p-3 flex flex-col justify-between min-h-[90px]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-mono-900">{slot.label}</span>
                          <span className="text-[10px] font-mono text-mono-500">{slot.sub}</span>
                        </div>

                        {/* Stamp area */}
                        <div className="my-2 flex flex-col items-center justify-center">
                          {record ? (
                            <div className="text-center w-full">
                              <div className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-mono-900 border border-mono-900 rounded px-1.5 py-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>SIGNED</span>
                              </div>
                              <div className="text-[9px] font-mono text-mono-500 mt-1 truncate">
                                {record.serial_no}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full border-b border-dashed border-mono-300 my-3"></div>
                          )}
                        </div>

                        {/* Officer Signer Line */}
                        <div className="text-center border-t border-mono-100 pt-1">
                          <span className="text-[9px] font-mono text-mono-400 block uppercase">
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

          {/* Footer Clearance Status */}
          <div className="pt-4 border-t border-mono-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-mono-500 font-mono gap-2">
            <div>
              <span>Approved by: </span>
              <strong className="text-mono-900">CIT Department Adviser</strong>
            </div>
            <div>
              <span>Verified Records: </span>
              <strong className="text-mono-900">
                {attendanceRecords.filter((r) => r.status === 'valid').length} / 20 Slots
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
