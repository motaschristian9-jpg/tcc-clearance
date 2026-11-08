import { unpackStampFromReceiptString } from '../lib/crypto/stamps';
import { db } from '../lib/db/dexie';
import { StoredAttendanceRecord } from '../types/database';

export interface ClaimReceiptParams {
  receiptString: string;
  currentStudentId: string;
}

export interface ClaimReceiptResult {
  success: boolean;
  slotId?: string;
  eventId?: string;
  error?: string;
}

/**
 * Validates and records an offline receipt stamp scanned or entered by a student.
 */
export async function claimReceiptStamp(params: ClaimReceiptParams): Promise<ClaimReceiptResult> {
  const { receiptString, currentStudentId } = params;

  if (!receiptString || !receiptString.trim()) {
    return {
      success: false,
      error: 'Please scan or enter a receipt stamp code.',
    };
  }

  const stamp = unpackStampFromReceiptString(receiptString.trim());
  if (!stamp) {
    return {
      success: false,
      error: 'The receipt code is invalid or unreadable.',
    };
  }

  // Ensure this stamp belongs to the logged-in student
  if (stamp.student_id !== currentStudentId) {
    return {
      success: false,
      error: `This receipt was issued for a different student (${stamp.student_id}).`,
    };
  }

  const clientUuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record: StoredAttendanceRecord = {
    id: stamp.serial_no || clientUuid,
    client_uuid: clientUuid,
    event_id: stamp.event_id,
    slot_id: stamp.slot_id,
    student_id: stamp.student_id,
    venue_id: stamp.venue_id,
    officer_id: stamp.officer_id,
    scanner_key_id: stamp.scanner_key_id,
    scanned_at: stamp.scanned_at,
    method: stamp.method,
    location_flag: stamp.location_flag,
    status: 'valid',
    serial_no: stamp.serial_no,
    signature: stamp.signature,
  };

  await db.attendance.put(record);

  return {
    success: true,
    slotId: stamp.slot_id,
    eventId: stamp.event_id,
  };
}

