import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/lib/db/dexie';
import { StoredProfile } from '../src/types/database';

describe('Student Registration Storage Flow', () => {
  beforeEach(async () => {
    await db.open();
    await db.profile.clear();
  });

  it('saves and checks student registration state in Dexie', async () => {
    // Before registration
    const initialProfile = await db.getProfile();
    expect(initialProfile).toBeUndefined();

    // Register student
    const newProfile: StoredProfile = {
      id: 'prof-001',
      email: 'student@tcc.edu.ph',
      role: 'student',
      full_name: 'Maria Santos',
      school_id_no: '2023-01999',
      department_id: 'CIT',
      section_id: 'BSIT-3A',
      year_level: 3,
      status: 'pending',
    };

    await db.saveProfile(newProfile);

    // After registration
    const saved = await db.getProfile();
    expect(saved).toBeDefined();
    expect(saved?.school_id_no).toBe('2023-01999');
    expect(saved?.status).toBe('pending');
  });
});
