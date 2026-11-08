import { StudentQRTokenPayload, ScannerSignedStamp } from './crypto';

export type UserRole = 'student' | 'officer' | 'head';

export interface StoredKey {
  id: string;               // 'student-device-key' | 'officer-scanner-key'
  publicKeyRaw: string;
  privateKey?: CryptoKey;
  role: UserRole;
  createdAt: string;
}

export interface StoredProfile {
  id: string;               // profile UUID / auth ID
  email: string;
  role: UserRole;
  full_name: string;
  school_id_no?: string;
  department_id?: string;
  section_id?: string;
  year_level?: number;
  position?: string;        // For officers
  signature_path?: string;
  photo_path?: string;
  thumb_path?: string;
  photo_status?: 'accepted' | 'needs_retake';
  status?: 'pending' | 'approved' | 'rejected';
}

export interface StoredRosterStudent {
  student_id: string;
  school_id_no: string;
  full_name: string;
  department_id: string;
  section_id: string;
  year_level?: number;
  public_key: string;       // Student's ECDSA P-256 public key
  thumb_path?: string;
  thumb_data_url?: string;  // Base64 thumbnail for offline face comparison
  status: 'pending' | 'approved' | 'rejected';
}

export interface StoredScanQueueItem {
  client_uuid: string;      // Unique client scan UUID
  serial_no: string;        // Scanner key ID + incremental counter
  student_id: string;
  event_id: string;
  slot_id: string;
  venue_id?: string;
  officer_id: string;
  scanner_key_id: string;
  method: 'qr' | 'manual';
  scanned_at: string;
  location_flag: 'none' | 'ok' | 'far' | 'unknown';
  distance_m?: number;
  signature: string;        // Scanner ECDSA signature
  status: 'valid' | 'duplicate' | 'voided';
  synced: boolean;
  note?: string;
}

export interface StoredAttendanceRecord {
  id: string;
  client_uuid: string;
  event_id: string;
  slot_id: string;
  student_id: string;
  venue_id?: string;
  officer_id: string;
  scanner_key_id: string;
  scanned_at: string;
  method: 'qr' | 'manual';
  location_flag: string;
  status: 'valid' | 'duplicate' | 'voided';
  serial_no: string;
  signature: string;
  synced_at?: string;
}

export interface StoredEventSlot {
  id: string;
  order_no: number;
  label: string;            // 'Time In', 'Time Out'
  start_time: string;
  end_time: string;
  signer_name: string;
  signer_position: string;
}

export interface StoredEventDay {
  id: string;
  day_no: number;
  date: string;
  slots: StoredEventSlot[];
}

export interface StoredEventVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  location_check_enabled: boolean;
}

export interface StoredEvent {
  id: string;
  name: string;
  description: string;
  school_year: string;
  status: 'draft' | 'published' | 'archived';
  location_check: 'off' | 'flag' | 'block';
  approved_by_name?: string;
  approved_on?: string;
  days: StoredEventDay[];
  venues: StoredEventVenue[];
  version: number;
}

