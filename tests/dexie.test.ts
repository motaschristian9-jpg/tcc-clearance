import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/lib/db/dexie';
import { StoredRosterStudent, StoredScanQueueItem } from '../src/types/database';

describe('Dexie.js Offline Database Operations', () => {
  beforeEach(async () => {
    await db.open();
    await db.roster.clear();
    await db.scanQueue.clear();
    await db.keys.clear();
    await db.attendance.clear();
  });

  afterEach(async () => {
    await db.close();
  });

  it('stores and retrieves cached department roster for offline verification', async () => {
    const testStudents: StoredRosterStudent[] = [
      {
        student_id: 'std-001',
        school_id_no: '2023-01042',
        full_name: 'Juan Dela Cruz',
        department_id: 'CIT',
        section_id: 'BSIT-3A',
        public_key: 'test-public-key-base64-1',
        status: 'approved',
      },
      {
        student_id: 'std-002',
        school_id_no: '2023-01043',
        full_name: 'Maria Clara',
        department_id: 'CBA',
        section_id: 'BSBA-2B',
        public_key: 'test-public-key-base64-2',
        status: 'approved',
      },
    ];

    await db.cacheDepartmentRoster(testStudents);

    // Retrieve all CIT students
    const citStudents = await db.getRosterByDepartment('CIT');
    expect(citStudents.length).toBe(1);
    expect(citStudents[0].full_name).toBe('Juan Dela Cruz');

    // Find student by School ID
    const student = await db.findStudentBySchoolId('2023-01042');
    expect(student).toBeDefined();
    expect(student?.student_id).toBe('std-001');
  });

  it('queues offline scans, tracks unsynced status, and marks them synced', async () => {
    const testScan: StoredScanQueueItem = {
      client_uuid: 'uuid-12345',
      serial_no: 'SCAN-01-0001',
      student_id: 'std-001',
      event_id: 'cit-intramurals-2026',
      slot_id: 'day1-morning-in',
      venue_id: 'gymnasium',
      officer_id: 'officer-01',
      scanner_key_id: 'key-01',
      method: 'qr',
      scanned_at: new Date().toISOString(),
      location_flag: 'none',
      signature: 'test-sig-base64',
      status: 'valid',
      synced: false,
    };

    await db.enqueueScan(testScan);

    // Check unsynced queue count
    const unsyncedCount = await db.getUnsyncedScanCount();
    expect(unsyncedCount).toBe(1);

    const unsyncedList = await db.getUnsyncedScans();
    expect(unsyncedList.length).toBe(1);
    expect(unsyncedList[0].client_uuid).toBe('uuid-12345');

    // Mark as synced
    await db.markScansSynced(['uuid-12345']);

    const remainingCount = await db.getUnsyncedScanCount();
    expect(remainingCount).toBe(0);
  });

  it('prevents duplicate scans offline for same slot and student', async () => {
    const scan1: StoredScanQueueItem = {
      client_uuid: 'uuid-1',
      serial_no: 'SCAN-01-0001',
      student_id: 'std-001',
      event_id: 'cit-intramurals-2026',
      slot_id: 'day1-morning-in',
      officer_id: 'officer-01',
      scanner_key_id: 'key-01',
      method: 'qr',
      scanned_at: new Date().toISOString(),
      location_flag: 'none',
      signature: 'sig-1',
      status: 'valid',
      synced: false,
    };

    await db.enqueueScan(scan1);

    const hasAlreadyScanned = await db.hasStudentCheckedIn('cit-intramurals-2026', 'day1-morning-in', 'std-001');
    expect(hasAlreadyScanned).toBe(true);

    const hasNotCheckedAnotherSlot = await db.hasStudentCheckedIn('cit-intramurals-2026', 'day1-morning-out', 'std-001');
    expect(hasNotCheckedAnotherSlot).toBe(false);
  });
});
