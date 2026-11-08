import { describe, it, expect } from 'vitest';
import { verifyOfficerPin } from '../src/lib/auth/officerAuth';

describe('SBO Officer Access Protection', () => {
  it('rejects empty or invalid officer access PIN', () => {
    expect(verifyOfficerPin('')).toBe(false);
    expect(verifyOfficerPin('0000')).toBe(false);
    expect(verifyOfficerPin('wrong-code')).toBe(false);
  });

  it('accepts authorized officer access PIN', () => {
    expect(verifyOfficerPin('2026')).toBe(true);
    expect(verifyOfficerPin('tcc-sbo-2026')).toBe(true);
  });
});

