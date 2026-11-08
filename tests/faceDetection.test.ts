import { describe, it, expect } from 'vitest';
import {
  analyzeCanvasFacePresence,
} from '../src/lib/camera/faceDetector';

describe('Real-time Face Presence and Luma Analysis', () => {
  it('detects blank or empty canvas as no face', () => {
    // Create mock image data with uniform flat gray/black pixels (e.g. wall or empty frame)
    const width = 200;
    const height = 200;
    const blankPixels = new Uint8ClampedArray(width * height * 4); // all zeros / black
    
    const result = analyzeCanvasFacePresence({
      width,
      height,
      data: blankPixels,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('dark');
  });

  it('detects solid flat color (e.g. blank wall) as lack of facial features', () => {
    const width = 200;
    const height = 200;
    const flatPixels = new Uint8ClampedArray(width * height * 4);
    // Fill with solid beige/gray wall color (no edges, no eyes, no variation)
    for (let i = 0; i < flatPixels.length; i += 4) {
      flatPixels[i] = 180;     // R
      flatPixels[i + 1] = 180; // G
      flatPixels[i + 2] = 180; // B
      flatPixels[i + 3] = 255; // A
    }

    const result = analyzeCanvasFacePresence({
      width,
      height,
      data: flatPixels,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('face');
  });

  it('rejects continuous non-face surface where corners match center (e.g. wood desk or table)', () => {
    const width = 200;
    const height = 200;
    const woodDeskPixels = new Uint8ClampedArray(width * height * 4);
    // Fill entire frame with uniform warm tone (like wood table or wall)
    for (let i = 0; i < woodDeskPixels.length; i += 4) {
      woodDeskPixels[i] = 160;     // R
      woodDeskPixels[i + 1] = 110; // G
      woodDeskPixels[i + 2] = 70;  // B
      woodDeskPixels[i + 3] = 255; // A
    }

    const result = analyzeCanvasFacePresence({
      width,
      height,
      data: woodDeskPixels,
    });

    expect(result.valid).toBe(false);
  });
});

