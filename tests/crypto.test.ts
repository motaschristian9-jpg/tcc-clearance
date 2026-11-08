import { describe, it, expect } from 'vitest';
import {
  generateECDSAKeyPair,
  exportPublicKeyRaw,
  importPublicKeyRaw,
  createStudentQRToken,
  verifyStudentQRToken,
  packTokenToString,
  unpackTokenFromString,
} from '../src/lib/crypto/tokens';

describe('WebCrypto ECDSA P-256 Rotating QR Tokens', () => {
  it('generates a valid ECDSA P-256 key pair and exports/imports public key', async () => {
    const keyPair = await generateECDSAKeyPair(false); // non-extractable private key
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();

    const rawPubKey = await exportPublicKeyRaw(keyPair.publicKey);
    expect(rawPubKey.length).toBeGreaterThan(0);

    const importedKey = await importPublicKeyRaw(rawPubKey);
    expect(importedKey).toBeDefined();
    expect(importedKey.algorithm.name).toBe('ECDSA');
  });

  it('signs a token and successfully verifies with the matching public key', async () => {
    const keyPair = await generateECDSAKeyPair(false);
    const rawPubKey = await exportPublicKeyRaw(keyPair.publicKey);

    const token = await createStudentQRToken({
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      privateKey: keyPair.privateKey,
    });

    expect(token).toBeDefined();
    expect(token.payload.sid).toBe('TCC-2023-00123');
    expect(token.payload.eid).toBe('cit-intramurals-2026');
    expect(typeof token.sig).toBe('string');

    const serialized = packTokenToString(token);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeLessThan(250); // Compact QR payload

    // Verify token
    const result = await verifyStudentQRToken({
      tokenString: serialized,
      publicKeyRaw: rawPubKey,
      expectedEventId: 'cit-intramurals-2026',
    });

    expect(result.valid).toBe(true);
    expect(result.payload?.sid).toBe('TCC-2023-00123');
  });

  it('rejects tokens from a different event', async () => {
    const keyPair = await generateECDSAKeyPair(false);
    const rawPubKey = await exportPublicKeyRaw(keyPair.publicKey);

    const token = await createStudentQRToken({
      studentId: 'TCC-2023-00123',
      eventId: 'cba-days-2026',
      privateKey: keyPair.privateKey,
    });

    const serialized = packTokenToString(token);

    const result = await verifyStudentQRToken({
      tokenString: serialized,
      publicKeyRaw: rawPubKey,
      expectedEventId: 'cit-intramurals-2026',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Event mismatch');
  });

  it('rejects tampered tokens with invalid signature', async () => {
    const keyPair = await generateECDSAKeyPair(false);
    const rawPubKey = await exportPublicKeyRaw(keyPair.publicKey);

    const token = await createStudentQRToken({
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      privateKey: keyPair.privateKey,
    });

    // Tamper with payload
    token.payload.sid = 'TCC-2023-99999';
    const tampered = packTokenToString(token);

    const result = await verifyStudentQRToken({
      tokenString: tampered,
      publicKeyRaw: rawPubKey,
      expectedEventId: 'cit-intramurals-2026',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid signature');
  });

  it('rejects expired tokens outside clock tolerance window', async () => {
    const keyPair = await generateECDSAKeyPair(false);
    const rawPubKey = await exportPublicKeyRaw(keyPair.publicKey);

    // Current window is now; create token with window from 5 minutes ago (10 windows ago)
    const oldWindow = Math.floor(Date.now() / 30000) - 10;
    const token = await createStudentQRToken({
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      privateKey: keyPair.privateKey,
      timeWindow: oldWindow,
    });

    const serialized = packTokenToString(token);

    const result = await verifyStudentQRToken({
      tokenString: serialized,
      publicKeyRaw: rawPubKey,
      expectedEventId: 'cit-intramurals-2026',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('flags minor clock drift when token is ±1 window off but still valid', async () => {
    const keyPair = await generateECDSAKeyPair(false);
    const rawPubKey = await exportPublicKeyRaw(keyPair.publicKey);

    // Exactly 1 window difference
    const driftWindow = Math.floor(Date.now() / 30000) - 1;
    const token = await createStudentQRToken({
      studentId: 'TCC-2023-00123',
      eventId: 'cit-intramurals-2026',
      privateKey: keyPair.privateKey,
      timeWindow: driftWindow,
    });

    const serialized = packTokenToString(token);

    const result = await verifyStudentQRToken({
      tokenString: serialized,
      publicKeyRaw: rawPubKey,
      expectedEventId: 'cit-intramurals-2026',
    });

    expect(result.valid).toBe(true);
    expect(result.isClockDrifted).toBe(true);
  });
});

