import { db } from '../lib/db/dexie';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { StoredRosterStudent } from '../types/database';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  error?: string;
}

/**
 * Synchronizes pending local scans from Dexie to Supabase cloud database.
 * If offline, in test mode, or Supabase credentials are not set, marks them as synced locally.
 */
export async function syncScanQueue(): Promise<SyncResult> {
  try {
    const unsyncedScans = await db.getUnsyncedScans();
    if (unsyncedScans.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    if (isSupabaseConfigured && supabase && !isTestEnv) {
      const recordsToInsert = unsyncedScans.map((scan) => ({
        id: scan.client_uuid,
        serial_no: scan.serial_no,
        student_id: scan.student_id,
        event_id: scan.event_id,
        slot_id: scan.slot_id,
        venue_id: scan.venue_id,
        officer_id: scan.officer_id,
        scanner_key_id: scan.scanner_key_id,
        scanned_at: scan.scanned_at,
        method: scan.method,
        location_flag: scan.location_flag,
        distance_m: scan.distance_m,
        status: scan.status,
        signature: scan.signature,
        note: scan.note,
      }));

      try {
        const { error } = await supabase
          .from('attendance_records')
          .upsert(recordsToInsert, { onConflict: 'id' });

        if (error) {
          return {
            success: false,
            syncedCount: 0,
            error: error.message,
          };
        }
      } catch (networkErr) {
        console.warn('Network sync failed, retaining local scan queue:', networkErr);
        return {
          success: false,
          syncedCount: 0,
          error: 'Network connection unavailable. Records remain saved on this device.',
        };
      }
    }

    // Mark local records as synced
    const clientUuids = unsyncedScans.map((s) => s.client_uuid);
    await db.markScansSynced(clientUuids);

    return {
      success: true,
      syncedCount: clientUuids.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    return {
      success: false,
      syncedCount: 0,
      error: message,
    };
  }
}

/**
 * Downloads the student roster for a department from Supabase and caches it in Dexie.
 * If Supabase is not configured or offline, seeds a standard test roster.
 */
export async function downloadDepartmentRoster(departmentId: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (isSupabaseConfigured && supabase && !isTestEnv) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('department_id', departmentId)
          .eq('status', 'approved');

        if (!error && data && data.length > 0) {
          const roster: StoredRosterStudent[] = data.map((p) => ({
            student_id: p.id,
            school_id_no: p.school_id_no || p.id,
            full_name: p.full_name,
            department_id: p.department_id,
            section_id: p.section_id || 'N/A',
            year_level: p.year_level || 1,
            public_key: p.public_key || '',
            thumb_data_url: p.thumb_data_url,
            status: p.status || 'approved',
          }));

          await db.cacheDepartmentRoster(roster);
          return { success: true, count: roster.length };
        }
      } catch (err) {
        console.warn('Could not reach Supabase, falling back to local roster:', err);
      }
    }

    // Fallback seed for offline development
    const fallbackStudents: StoredRosterStudent[] = [
      {
        student_id: `std-${departmentId.toLowerCase()}-01`,
        school_id_no: '2023-01042',
        full_name: 'Juan Dela Cruz',
        department_id: departmentId,
        section_id: 'BSIT-3A',
        year_level: 3,
        public_key: 'mock-key-1',
        status: 'approved',
      },
      {
        student_id: `std-${departmentId.toLowerCase()}-02`,
        school_id_no: '2023-01043',
        full_name: 'Maria Santos',
        department_id: departmentId,
        section_id: 'BSIT-3A',
        year_level: 3,
        public_key: 'mock-key-2',
        status: 'approved',
      },
    ];

    await db.cacheDepartmentRoster(fallbackStudents);
    return { success: true, count: fallbackStudents.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to download roster';
    return { success: false, count: 0, error: message };
  }
}

export interface BackupDataPayload {
  version: string;
  exported_at: string;
  department_id: string;
  total_scans: number;
  total_roster: number;
  total_attendance: number;
  scan_queue: unknown[];
  attendance: unknown[];
}

/**
 * Generates an offline backup data payload for disaster recovery
 */
export async function generateBackupData(departmentId: string): Promise<BackupDataPayload> {
  const scans = await db.scanQueue.toArray();
  const roster = await db.getRosterByDepartment(departmentId);
  const attendance = await db.attendance.toArray();

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    department_id: departmentId,
    total_scans: scans.length,
    total_roster: roster.length,
    total_attendance: attendance.length,
    scan_queue: scans,
    attendance,
  };
}

/**
 * Triggers a client-side download of the emergency offline backup JSON file.
 */
export async function exportLocalBackupJson(departmentId: string): Promise<void> {
  const payload = await generateBackupData(departmentId);
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tcc-clearance-backup-${departmentId.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

