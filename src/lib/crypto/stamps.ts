import { ScannerSignedStamp } from '../../types/crypto';
import {
  bufferToBase64Url,
  base64UrlToBuffer,
  importPublicKeyRaw,
} from './tokens';

const subtle = globalThis.crypto?.subtle;

export interface CreateStampParams {
  serialNo: string;
  studentId: string;
  eventId: string;
  slotId: string;
  venueId?: string;
  officerId: string;
  scannerKeyId: string;
  method: 'qr' | 'manual';
  locationFlag: 'none' | 'ok' | 'far' | 'unknown';
  distanceM?: number;
  scannedAt?: string;
  privateKey: CryptoKey;
}

export function canonicalizeStampPayload(stamp: Omit<ScannerSignedStamp, 'signature'>): Uint8Array {
  const canonical = JSON.stringify({
    serial_no: stamp.serial_no,
    student_id: stamp.student_id,
    event_id: stamp.event_id,
    slot_id: stamp.slot_id,
    venue_id: stamp.venue_id,
    scanned_at: stamp.scanned_at,
    officer_id: stamp.officer_id,
    scanner_key_id: stamp.scanner_key_id,
    method: stamp.method,
    location_flag: stamp.location_flag,
    distance_m: stamp.distance_m,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Generate a scanner-signed stamp record
 */
export async function createScannerStamp(params: CreateStampParams): Promise<ScannerSignedStamp> {
  const scannedAt = params.scannedAt ?? new Date().toISOString();

  const stampPayload: Omit<ScannerSignedStamp, 'signature'> = {
    serial_no: params.serialNo,
    student_id: params.studentId,
    event_id: params.eventId,
    slot_id: params.slotId,
    venue_id: params.venueId,
    scanned_at: scannedAt,
    officer_id: params.officerId,
    scanner_key_id: params.scannerKeyId,
    method: params.method,
    location_flag: params.locationFlag,
    distance_m: params.distanceM,
  };

  const payloadBytes = canonicalizeStampPayload(stampPayload);

  const signatureBuffer = await subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    params.privateKey,
    payloadBytes
  );

  const signature = bufferToBase64Url(signatureBuffer);

  return {
    ...stampPayload,
    signature,
  };
}

export interface VerifyStampParams {
  stamp: ScannerSignedStamp;
  publicKeyRaw: string | CryptoKey;
}

/**
 * Verify scanner-signed stamp record offline
 */
export async function verifyScannerStamp(params: VerifyStampParams): Promise<boolean> {
  try {
    const { signature, ...stampWithoutSig } = params.stamp;
    const payloadBytes = canonicalizeStampPayload(stampWithoutSig);
    const signatureBytes = base64UrlToBuffer(signature);

    const publicKey =
      typeof params.publicKeyRaw === 'string'
        ? await importPublicKeyRaw(params.publicKeyRaw)
        : params.publicKeyRaw;

    return await subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBytes,
      payloadBytes
    );
  } catch {
    return false;
  }
}

/**
 * Pack stamp into receipt-QR string
 */
export function packStampToReceiptString(stamp: ScannerSignedStamp): string {
  const json = JSON.stringify(stamp);
  return bufferToBase64Url(new TextEncoder().encode(json));
}

/**
 * Unpack stamp from receipt-QR string
 */
export function unpackStampFromReceiptString(receiptString: string): ScannerSignedStamp | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBuffer(receiptString));
    return JSON.parse(json) as ScannerSignedStamp;
  } catch {
    return null;
  }
}
