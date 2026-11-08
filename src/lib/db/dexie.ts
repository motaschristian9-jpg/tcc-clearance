import Dexie, { type Table } from 'dexie';
import {
  StoredKey,
  StoredProfile,
  StoredRosterStudent,
  StoredScanQueueItem,
  StoredAttendanceRecord,
  StoredEvent,
} from '../../types/database';

export class TCCDatabase extends Dexie {
  keys!: Table<StoredKey, string>;
  profile!: Table<StoredProfile, string>;
  roster!: Table<StoredRosterStudent, string>;
  scanQueue!: Table<StoredScanQueueItem, string>;
  attendance!: Table<StoredAttendanceRecord, string>;
  events!: Table<StoredEvent, string>;

  constructor() {
    super('TCCEventClearanceDB');
    this.version(1).stores({
      keys: 'id, role',
      profile: 'id, email, role, department_id, school_id_no',
      roster: 'student_id, school_id_no, department_id, section_id, status',
      scanQueue: 'client_uuid, serial_no, [event_id+slot_id+student_id], synced, status',
      attendance: 'id, client_uuid, [event_id+slot_id+student_id], student_id, event_id',
      events: 'id, status, school_year, version',
    });
  }

  // --- Roster Methods ---
  async cacheDepartmentRoster(students: StoredRosterStudent[]): Promise<void> {
    await this.roster.bulkPut(students);
  }

  async getRosterByDepartment(departmentId: string): Promise<StoredRosterStudent[]> {
    return await this.roster.where('department_id').equals(departmentId).toArray();
  }

  async findStudentBySchoolId(schoolIdNo: string): Promise<StoredRosterStudent | undefined> {
    return await this.roster.where('school_id_no').equals(schoolIdNo).first();
  }

  async getStudentById(studentId: string): Promise<StoredRosterStudent | undefined> {
    return await this.roster.get(studentId);
  }

  // --- Scan Queue Methods ---
  async enqueueScan(scan: StoredScanQueueItem): Promise<void> {
    await this.scanQueue.put(scan);
  }

  async getUnsyncedScans(): Promise<StoredScanQueueItem[]> {
    return await this.scanQueue.filter((item) => item.synced === false).toArray();
  }

  async getUnsyncedScanCount(): Promise<number> {
    return await this.scanQueue.filter((item) => item.synced === false).count();
  }

  async markScansSynced(clientUuids: string[]): Promise<void> {
    await this.transaction('rw', this.scanQueue, async () => {
      for (const uuid of clientUuids) {
        await this.scanQueue.update(uuid, { synced: true });
      }
    });
  }

  async hasStudentCheckedIn(eventId: string, slotId: string, studentId: string): Promise<boolean> {
    const existing = await this.scanQueue
      .where('[event_id+slot_id+student_id]')
      .equals([eventId, slotId, studentId])
      .filter((s) => s.status === 'valid')
      .first();
    return Boolean(existing);
  }

  // --- Attendance Methods ---
  async getStudentAttendance(studentId: string, eventId: string): Promise<StoredAttendanceRecord[]> {
    return await this.attendance
      .where('student_id')
      .equals(studentId)
      .filter((record) => record.event_id === eventId)
      .toArray();
  }

  // --- Key Storage ---
  async saveDeviceKey(key: StoredKey): Promise<void> {
    await this.keys.put(key);
  }

  async getDeviceKey(id: string): Promise<StoredKey | undefined> {
    return await this.keys.get(id);
  }

  // --- Profile Storage ---
  async saveProfile(profile: StoredProfile): Promise<void> {
    await this.profile.put(profile);
  }

  async getProfile(): Promise<StoredProfile | undefined> {
    return await this.profile.toCollection().first();
  }
}

export const db = new TCCDatabase();

