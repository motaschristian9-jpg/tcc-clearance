import { describe, it, expect } from 'vitest';
import { generateECDSAKeyPair, exportPublicKeyRaw } from '../src/lib/crypto/tokens';
import {
  createScannerStamp,
  verifyScannerStamp,
  packStampToReceiptString,
  unpackStampFromReceiptString,
} from '../src/lib/crypto/stamps';

describe('Scanner-Signed Attendance Stamps and Receipt Handshake', () => {
  it('creates and verifies a scanner-signed stamp record', async () => {
    const scannerKeyPair = await generateECDSAKeyPair(false);
    const scannerPubKeyRaw = await exportPublicKeyRaw(scannerKeyPair.publicKey);

    const stamp = await createScannerStamp({
      serialNo: 'SCAN-KEY-01-00042',
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      slotId: 'day1-morning-in',
      venueId: 'gymnasium-main',
      officerId: 'officer-sbo-auditor-1',
      scannerKeyId: 'scanner-key-01',
      method: 'qr',
      locationFlag: 'ok',
      distanceM: 12.5,
      privateKey: scannerKeyPair.privateKey,
    });

    expect(stamp.serial_no).toBe('SCAN-KEY-01-00042');
    expect(stamp.signature).toBeDefined();

    // Verify stamp offline
    const isVerified = await verifyScannerStamp({
      stamp,
      publicKeyRaw: scannerPubKeyRaw,
    });

    expect(isVerified).toBe(true);
  });

  it('detects forged stamp attributes', async () => {
    const scannerKeyPair = await generateECDSAKeyPair(false);
    const scannerPubKeyRaw = await exportPublicKeyRaw(scannerKeyPair.publicKey);

    const stamp = await createScannerStamp({
      serialNo: 'SCAN-KEY-01-00042',
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      slotId: 'day1-morning-in',
      venueId: 'gymnasium-main',
      officerId: 'officer-sbo-auditor-1',
      scannerKeyId: 'scanner-key-01',
      method: 'qr',
      locationFlag: 'ok',
      privateKey: scannerKeyPair.privateKey,
    });

    // Forgery: student tries to change slot to afternoon out
    stamp.slot_id = 'day1-afternoon-out';

    const isVerified = await verifyScannerStamp({
      stamp,
      publicKeyRaw: scannerPubKeyRaw,
    });

    expect(isVerified).toBe(false);
  });

  it('packs and unpacks stamp into compact receipt-QR handshake string', async () => {
    const scannerKeyPair = await generateECDSAKeyPair(false);

    const stamp = await createScannerStamp({
      serialNo: 'SCAN-KEY-01-00042',
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      slotId: 'day1-morning-in',
      officerId: 'officer-sbo-auditor-1',
      scannerKeyId: 'scanner-key-01',
      method: 'qr',
      locationFlag: 'none',
      privateKey: scannerKeyPair.privateKey,
    });

    const receiptString = packStampToReceiptString(stamp);
    expect(receiptString).toBeDefined();

    const unpacked = unpackStampFromReceiptString(receiptString);
    expect(unpacked).toBeDefined();
    expect(unpacked?.serial_no).toBe(stamp.serial_no);
    expect(unpacked?.signature).toBe(stamp.signature);
  });
});
