export interface StudentProfileInput {
  full_name: string;
  school_id_no: string;
  department_id: string;
  section_id: string;
  year_level: number;
  consent_agreed: boolean;
}

export const VALID_DEPARTMENTS = [
  'CBA',
  'CIT',
  'CED',
  'CCJPS',
  'CHM',
  'CAS',
  'COM',
  'CLIS',
];

/**
 * Validate student registration inputs
 */
export function validateStudentProfile(profile: StudentProfileInput): { valid: boolean; reason?: string } {
  if (!profile.consent_agreed) {
    return { valid: false, reason: 'You must agree to the privacy consent terms.' };
  }

  if (!profile.full_name?.trim()) {
    return { valid: false, reason: 'Full name is required.' };
  }

  if (!profile.school_id_no?.trim()) {
    return { valid: false, reason: 'School ID number is required.' };
  }

  if (!VALID_DEPARTMENTS.includes(profile.department_id?.toUpperCase())) {
    return { valid: false, reason: `Department must be one of: ${VALID_DEPARTMENTS.join(', ')}` };
  }

  if (!profile.section_id?.trim()) {
    return { valid: false, reason: 'Section is required.' };
  }

  if (!profile.year_level || profile.year_level < 1 || profile.year_level > 5) {
    return { valid: false, reason: 'Year level must be between 1 and 5.' };
  }

  return { valid: true };
}

export interface FaceDetectionMetrics {
  faceCount: number;
  boxWidthRatio: number;  // Face bounding box width relative to video width
  boxHeightRatio: number; // Face bounding box height relative to video height
  centerXRatio: number;   // Horizontal center 0.0 - 1.0 (0.5 is center)
  centerYRatio: number;   // Vertical center 0.0 - 1.0
  brightness: number;     // Average luma 0-255
}

/**
 * Strict evaluation of live face frame (Anti-Cheating AC1)
 */
export function validateFaceDetectionMetrics(metrics: FaceDetectionMetrics): { valid: boolean; reason?: string } {
  if (metrics.faceCount === 0) {
    return { valid: false, reason: 'No face detected. Please look directly into the camera.' };
  }

  if (metrics.faceCount > 1) {
    return { valid: false, reason: 'Only one face allowed. Please ensure no one else is in frame.' };
  }

  // Face must be large enough in the frame (at least 20% width)
  if (metrics.boxWidthRatio < 0.20) {
    return { valid: false, reason: 'Face is too far. Please move closer to the camera.' };
  }

  // Face must be centered (center must be between 0.35 and 0.65)
  if (metrics.centerXRatio < 0.35 || metrics.centerXRatio > 0.65) {
    return { valid: false, reason: 'Please center your face inside the oval.' };
  }

  // Lighting check (brightness must be >= 50)
  if (metrics.brightness < 45) {
    return { valid: false, reason: 'Lighting is too dark. Please move to a brighter area.' };
  }

  return { valid: true };
}

/**
 * Compress an HTMLCanvasElement or ImageBitmap to target dimensions and format
 */
export async function compressImageToDimensions(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  quality = 0.85
): Promise<string> {
  const scale = targetWidth / canvas.width;
  const targetHeight = Math.round(canvas.height * scale);

  const offscreen = document.createElement('canvas');
  offscreen.width = targetWidth;
  offscreen.height = targetHeight;

  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  return offscreen.toDataURL('image/jpeg', quality);
}

