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

  if (metrics.boxWidthRatio < 0.20) {
    return { valid: false, reason: 'Face is too far. Please move closer to the camera.' };
  }

  if (metrics.centerXRatio < 0.35 || metrics.centerXRatio > 0.65) {
    return { valid: false, reason: 'Please center your face inside the oval.' };
  }

  if (metrics.brightness < 45) {
    return { valid: false, reason: 'Lighting is too dark. Please move to a brighter area.' };
  }

  return { valid: true };
}

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Pixel feature & chromaticity presence analyzer
 * Catches blank walls, empty rooms, covered cameras, or non-face subjects
 */
export function analyzeCanvasFacePresence(img: ImageDataLike): { valid: boolean; reason?: string } {
  const { width, height, data } = img;
  const totalPixels = width * height;

  if (totalPixels === 0) {
    return { valid: false, reason: 'Empty camera frame' };
  }

  let totalLuma = 0;
  let lumaSquaredSum = 0;
  let skinTonePixels = 0;

  // We analyze the central 60% of the frame (where the face oval is located)
  const startX = Math.floor(width * 0.2);
  const endX = Math.floor(width * 0.8);
  const startY = Math.floor(height * 0.15);
  const endY = Math.floor(height * 0.85);
  let analyzedPixels = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Standard ITU-R BT.601 luminance
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += luma;
      lumaSquaredSum += luma * luma;
      analyzedPixels++;

      // Kovac human skin color detection rule in RGB
      // R > 95 and G > 40 and B > 20 and max-min > 15 and |R-G| > 15 and R > G and R > B
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isSkin =
        r > 70 &&
        g > 35 &&
        b > 15 &&
        max - min > 12 &&
        Math.abs(r - g) > 10 &&
        r > g &&
        r > b;

      if (isSkin) {
        skinTonePixels++;
      }
    }
  }

  if (analyzedPixels === 0) {
    return { valid: false, reason: 'Camera frame unavailable' };
  }

  const avgLuma = totalLuma / analyzedPixels;
  const variance = lumaSquaredSum / analyzedPixels - avgLuma * avgLuma;
  const stdDev = Math.sqrt(Math.max(0, variance));
  const skinRatio = skinTonePixels / analyzedPixels;

  // 1. Lighting check
  if (avgLuma < 40) {
    return { valid: false, reason: 'Lighting is too dark. Please move to a brighter area.' };
  }

  if (avgLuma > 245) {
    return { valid: false, reason: 'Camera frame is washed out or overexposed.' };
  }

  // 2. Feature Variance Check (a real face has facial features like eyes, mouth, hair creating contrast)
  // A blank wall or flat table has very low standard deviation (< 14)
  if (stdDev < 14) {
    return { valid: false, reason: 'No face detected. Please position your face inside the oval.' };
  }

  // 3. Skin-tone presence in central oval
  if (skinRatio < 0.10) {
    return { valid: false, reason: 'No face detected. Please position your face directly inside the oval guide.' };
  }

  return { valid: true };
}

/**
 * Full multi-tier face verification of the captured canvas
 */
export async function verifyFaceInCapturedCanvas(canvas: HTMLCanvasElement): Promise<{ valid: boolean; reason?: string }> {
  // Tier 1: Native Browser FaceDetector API (when available in Chromium / Android)
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      // @ts-expect-error Chrome Experimental FaceDetector
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
      const faces = await detector.detect(canvas);

      if (faces.length === 0) {
        return { valid: false, reason: 'No face detected. Please look directly into the camera.' };
      }

      if (faces.length > 1) {
        return { valid: false, reason: 'Multiple faces detected. Only one person is allowed.' };
      }

      const face = faces[0].boundingBox;
      const widthRatio = face.width / canvas.width;
      const centerX = (face.x + face.width / 2) / canvas.width;

      if (widthRatio < 0.18) {
        return { valid: false, reason: 'Face is too far. Please move closer to the camera.' };
      }

      if (centerX < 0.25 || centerX > 0.75) {
        return { valid: false, reason: 'Please center your face inside the oval.' };
      }

      return { valid: true };
    } catch {
      // Fallback to Tier 2
    }
  }

  // Tier 2: Canvas Feature & Chromaticity Analysis
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { valid: false, reason: 'Could not inspect image frame' };
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return analyzeCanvasFacePresence(imgData);
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
