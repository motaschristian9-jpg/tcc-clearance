import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/lib/db/dexie';
import { generateECDSAKeyPair } from '../src/lib/crypto/tokens';
import { createScannerStamp, packStampToReceiptString } from '../src/lib/crypto/stamps';
import { claimReceiptStamp } from '../src/services/receiptClaimService';

describe('Receipt Claim Offline Handshake Service', () => {
  beforeEach(async () => {
    await db.attendance.clear();
  });

  it('successfully claims a valid receipt QR and records attendance offline', async () => {
    const scannerKeyPair = await generateECDSAKeyPair(false);

    const stamp = await createScannerStamp({
      serialNo: 'SCAN-CIT-01-99881',
      studentId: '2023-01042',
      eventId: 'cit-intramurals-2026',
      slotId: 'day2-morning-in',
      venueId: 'Gymnasium Gate',
      officerId: 'officer-sbo-auditor-1',
      scannerKeyId: 'SCANNER-CIT-01',
      method: 'qr',
      locationFlag: 'ok',
      privateKey: scannerKeyPair.privateKey,
    });

    const receiptString = packStampToReceiptString(stamp);

    const result = await claimReceiptStamp({
      receiptString,
      currentStudentId: '2023-01042',
    });

    expect(result.success).toBe(true);
    expect(result.slotId).toBe('day2-morning-in');

    // Attendance record should be saved in dexie
    const records = await db.getStudentAttendance('2023-01042', 'cit-intramurals-2026');
    expect(records.length).toBe(1);
    expect(records[0].slot_id).toBe('day2-morning-in');
    expect(records[0].serial_no).toBe('SCAN-CIT-01-99881');
    expect(records[0].status).toBe('valid');
  });

  it('rejects a receipt intended for a different student', async () => {
    const scannerKeyPair = await generateECDSAKeyPair(false);

    const stamp = await createScannerStamp({
      serialNo: 'SCAN-CIT-01-99882',
      studentId: '2023-09999', // Different student
      eventId: 'cit-intramurals-2026',
      slotId: 'day1-morning-in',
      venueId: 'Gymnasium Gate',
      officerId: 'officer-sbo-auditor-1',
      scannerKeyId: 'SCANNER-CIT-01',
      method: 'qr',
      locationFlag: 'ok',
      privateKey: scannerKeyPair.privateKey,
    });

    const receiptString = packStampToReceiptString(stamp);

    const result = await claimReceiptStamp({
      receiptString,
      currentStudentId: '2023-01042',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('different student');

    // Database should have 0 records
    const records = await db.getStudentAttendance('2023-01042', 'cit-intramurals-2026');
    expect(records.length).toBe(0);
  });
});

