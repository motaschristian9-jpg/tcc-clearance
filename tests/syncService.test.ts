import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/lib/db/dexie';
import { syncScanQueue, downloadDepartmentRoster, generateBackupData } from '../src/services/syncService';
import { StoredScanQueueItem } from '../src/types/database';

describe('Sync Engine (Dexie Local Queue to Supabase)', () => {
  beforeEach(async () => {
    await db.scanQueue.clear();
    await db.roster.clear();
  });

  it('syncs local queue items and marks them as synced', async () => {
    const scanItem: StoredScanQueueItem = {
      client_uuid: 'uuid-test-01',
      serial_no: 'SCAN-01-001',
      student_id: 'std-2023-01042',
      event_id: 'cit-intramurals-2026',
      slot_id: 'day1-morning-in',
      venue_id: 'Gymnasium',
      officer_id: 'officer-1',
      scanner_key_id: 'SCANNER-CIT-01',
      method: 'qr',
      scanned_at: new Date().toISOString(),
      location_flag: 'none',
      signature: 'mock-sig',
      status: 'valid',
      synced: false,
    };

    await db.enqueueScan(scanItem);

    const unsyncedBefore = await db.getUnsyncedScanCount();
    expect(unsyncedBefore).toBe(1);

    const result = await syncScanQueue();
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);

    const unsyncedAfter = await db.getUnsyncedScanCount();
    expect(unsyncedAfter).toBe(0);
  });

  it('downloads and caches department roster locally', async () => {
    const result = await downloadDepartmentRoster('CIT');
    expect(result.success).toBe(true);

    const cached = await db.getRosterByDepartment('CIT');
    expect(cached.length).toBeGreaterThan(0);
  });

  it('generates an offline emergency backup JSON data payload', async () => {
    await downloadDepartmentRoster('CIT');

    const backup = await generateBackupData('CIT');
    expect(backup.department_id).toBe('CIT');
    expect(backup.total_roster).toBeGreaterThan(0);
    expect(backup.exported_at).toBeDefined();
    expect(Array.isArray(backup.scan_queue)).toBe(true);
  });
});

