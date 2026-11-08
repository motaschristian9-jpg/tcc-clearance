export interface StudentQRTokenPayload {
  v: number;              // Format version, e.g. 1
  sid: string;            // Student ID (e.g. school_id or student record UUID)
  eid: string;            // Event ID
  w: number;              // Time window: Math.floor(Date.now() / 30000)
  n: string;              // 8-byte random nonce in hex or base64url
  loc?: [number, number]; // [latitude, longitude] optional
}

export interface StudentQRToken {
  payload: StudentQRTokenPayload;
  sig: string;            // Base64url raw 64-byte ECDSA signature
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  payload?: StudentQRTokenPayload;
  isClockDrifted?: boolean;
}

export interface ScannerSignedStamp {
  serial_no: string;      // Scanner key ID + counter
  student_id: string;
  event_id: string;
  slot_id: string;
  venue_id?: string;
  scanned_at: string;     // ISO timestamp
  officer_id: string;
  scanner_key_id: string;
  method: 'qr' | 'manual';
  location_flag: 'none' | 'ok' | 'far' | 'unknown';
  distance_m?: number;
  signature: string;      // Scanner ECDSA signature
}

