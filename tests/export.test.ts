import { describe, it, expect } from 'vitest';
import { generateAttendanceWorkbook } from '../src/services/excelExportService';
import { StoredRosterStudent, StoredAttendanceRecord } from '../src/types/database';

describe('Excel Attendance Export Service', () => {
  it('generates a valid formatted Excel workbook for school records', async () => {
    const students: StoredRosterStudent[] = [
      {
        student_id: 'std-1',
        school_id_no: '2023-01042',
        full_name: 'Juan Dela Cruz',
        department_id: 'CIT',
        section_id: 'BSIT-3A',
        year_level: 3,
        public_key: 'key-1',
        status: 'approved',
      },
    ];

    const records: StoredAttendanceRecord[] = [
      {
        id: 'rec-1',
        client_uuid: 'uuid-1',
        event_id: 'cit-intramurals-2026',
        slot_id: 'day1-morning-in',
        student_id: 'std-1',
        officer_id: 'officer-1',
        scanner_key_id: 'key-1',
        scanned_at: new Date().toISOString(),
        method: 'qr',
        location_flag: 'none',
        status: 'valid',
        serial_no: 'SCAN-001',
        signature: 'sig-1',
      },
    ];

    const workbook = await generateAttendanceWorkbook({
      eventName: 'CIT Intramurals 2026',
      departmentId: 'CIT',
      students,
      records,
    });

    expect(workbook).toBeDefined();
    const sheet = workbook.getWorksheet('CIT Attendance');
    expect(sheet).toBeDefined();
    expect(sheet?.rowCount).toBeGreaterThan(1);
  });
});

