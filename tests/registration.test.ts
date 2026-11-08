import { describe, it, expect } from 'vitest';
import {
  validateStudentProfile,
  validateFaceDetectionMetrics,
  compressImageToDimensions,
} from '../src/lib/camera/faceDetector';

describe('Student Registration and Face Verification Protocols', () => {
  it('validates required student profile fields', () => {
    const validProfile = {
      full_name: 'Juan Dela Cruz',
      school_id_no: '2023-01042',
      department_id: 'CIT',
      section_id: 'BSIT-3A',
      year_level: 3,
      consent_agreed: true,
    };

    const result = validateStudentProfile(validProfile);
    expect(result.valid).toBe(true);

    const missingConsent = { ...validProfile, consent_agreed: false };
    expect(validateStudentProfile(missingConsent).valid).toBe(false);

    const invalidDept = { ...validProfile, department_id: 'UNKNOWN' };
    expect(validateStudentProfile(invalidDept).valid).toBe(false);
  });

  it('evaluates face detection metrics strictly (AC1)', () => {
    // 1 face, good size and centered
    const validMetrics = {
      faceCount: 1,
      boxWidthRatio: 0.35, // 35% of frame width
      boxHeightRatio: 0.45,
      centerXRatio: 0.50, // perfectly centered horizontally
      centerYRatio: 0.48, // centered vertically
      brightness: 130,    // 0-255 range
    };

    const goodResult = validateFaceDetectionMetrics(validMetrics);
    expect(goodResult.valid).toBe(true);

    // No face detected
    const noFace = { ...validMetrics, faceCount: 0 };
    expect(validateFaceDetectionMetrics(noFace).valid).toBe(false);
    expect(validateFaceDetectionMetrics(noFace).reason).toContain('No face detected');

    // Multiple faces detected
    const multiFace = { ...validMetrics, faceCount: 2 };
    expect(validateFaceDetectionMetrics(multiFace).valid).toBe(false);
    expect(validateFaceDetectionMetrics(multiFace).reason).toContain('Only one face');

    // Face too small/far away
    const smallFace = { ...validMetrics, boxWidthRatio: 0.12 };
    expect(validateFaceDetectionMetrics(smallFace).valid).toBe(false);
    expect(validateFaceDetectionMetrics(smallFace).reason).toContain('closer');

    // Face off-center
    const offCenter = { ...validMetrics, centerXRatio: 0.15 };
    expect(validateFaceDetectionMetrics(offCenter).valid).toBe(false);
    expect(validateFaceDetectionMetrics(offCenter).reason).toContain('center');

    // Frame too dark
    const darkFrame = { ...validMetrics, brightness: 25 };
    expect(validateFaceDetectionMetrics(darkFrame).valid).toBe(false);
    expect(validateFaceDetectionMetrics(darkFrame).reason?.toLowerCase()).toContain('lighting');
  });
});
