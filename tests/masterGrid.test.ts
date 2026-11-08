import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/lib/db/dexie';
import { StoredRosterStudent, StoredAttendanceRecord } from '../src/types/database';

describe('Master Department Clearance Grid Data Engine', () => {
  beforeEach(async () => {
    await db.roster.clear();
    await db.attendance.clear();

    const students: StoredRosterStudent[] = [
      {
        student_id: 'std-001',
        school_id_no: '2023-01042',
        full_name: 'Juan Dela Cruz',
        department_id: 'CIT',
        section_id: 'BSIT-3A',
        year_level: 3,
        public_key: 'mock-1',
        status: 'approved',
      },
      {
        student_id: 'std-002',
        school_id_no: '2023-01043',
        full_name: 'Maria Santos',
        department_id: 'CIT',
        section_id: 'BSIT-3B',
        year_level: 3,
        public_key: 'mock-2',
        status: 'approved',
      },
    ];

    await db.cacheDepartmentRoster(students);

    // Give Juan 20 attendance records (fully cleared)
    const juanRecords: StoredAttendanceRecord[] = Array.from({ length: 20 }, (_, i) => ({
      id: `juan-rec-${i}`,
      client_uuid: `uuid-juan-${i}`,
      event_id: 'cit-intramurals-2026',
      slot_id: `day${Math.floor(i / 4) + 1}-slot-${i % 4}`,
      student_id: 'std-001',
      venue_id: 'Gymnasium',
      officer_id: 'officer-1',
      scanner_key_id: 'SCAN-01',
      scanned_at: new Date().toISOString(),
      method: 'qr',
      location_flag: 'none',
      status: 'valid',
      serial_no: `SN-${i}`,
      signature: 'sig',
    }));

    await db.attendance.bulkPut(juanRecords);
  });

  it('calculates clearance status correctly for each student in department', async () => {
    const students = await db.getRosterByDepartment('CIT');
    const records = await db.attendance.toArray();

    const summary = students.map((s) => {
      const studentRecords = records.filter(
        (r) => (r.student_id === s.student_id || r.student_id === s.school_id_no) && r.status === 'valid'
      );
      const isCleared = studentRecords.length >= 20;
      return {
        ...s,
        signedCount: studentRecords.length,
        isCleared,
      };
    });

    const juan = summary.find((s) => s.school_id_no === '2023-01042');
    const maria = summary.find((s) => s.school_id_no === '2023-01043');

    expect(juan?.signedCount).toBe(20);
    expect(juan?.isCleared).toBe(true);

    expect(maria?.signedCount).toBe(0);
    expect(maria?.isCleared).toBe(false);
  });
});

