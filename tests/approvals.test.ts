import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/lib/db/dexie';
import { StoredRosterStudent } from '../src/types/database';

describe('SBO Student Approvals Workflow', () => {
  beforeEach(async () => {
    await db.open();
    await db.roster.clear();
  });

  it('queries pending students by department and updates approval status', async () => {
    const pendingStudent: StoredRosterStudent = {
      student_id: 'std-2023-99999',
      school_id_no: '2023-99999',
      full_name: 'Test Student',
      department_id: 'CIT',
      section_id: 'BSIT-1A',
      year_level: 1,
      public_key: 'test-key',
      status: 'pending',
    };

    await db.roster.put(pendingStudent);

    // Fetch pending students for CIT
    const pendingList = await db.roster
      .where('department_id')
      .equals('CIT')
      .filter((s) => s.status === 'pending')
      .toArray();

    expect(pendingList.length).toBe(1);
    expect(pendingList[0].full_name).toBe('Test Student');

    // SBO approves student
    await db.roster.update('std-2023-99999', { status: 'approved' });

    const updated = await db.roster.get('std-2023-99999');
    expect(updated?.status).toBe('approved');
  });
});
