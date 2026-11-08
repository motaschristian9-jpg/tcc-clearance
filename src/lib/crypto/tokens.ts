import { StudentQRToken, StudentQRTokenPayload, VerificationResult } from '../../types/crypto';

// Browser and Node.js WebCrypto compatibility
const subtle = globalThis.crypto?.subtle;

/**
 * Base64URL encode a Uint8Array or Buffer
 */
export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decode to Uint8Array
 */
export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random 8-byte nonce encoded in base64url
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

/**
 * Generate ECDSA P-256 key pair
 * @param extractable Whether private key can be exported (false for production device security)
 */
export async function generateECDSAKeyPair(extractable = false): Promise<CryptoKeyPair> {
  return await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    extractable,
    ['sign', 'verify']
  );
}

/**
 * Export public key to base64url encoded raw SPKI bytes
 */
export async function exportPublicKeyRaw(publicKey: CryptoKey): Promise<string> {
  const exported = await subtle.exportKey('spki', publicKey);
  return bufferToBase64Url(exported);
}

/**
 * Import public key from base64url encoded SPKI bytes
 */
export async function importPublicKeyRaw(publicKeyBase64Url: string): Promise<CryptoKey> {
  const keyBuffer = base64UrlToBuffer(publicKeyBase64Url);
  return await subtle.importKey(
    'spki',
    keyBuffer,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
}

/**
 * Canonical JSON serialization for deterministic signing
 */
export function canonicalizePayload(payload: StudentQRTokenPayload): Uint8Array {
  // Deterministic JSON string
  const canonical = JSON.stringify({
    v: payload.v,
    sid: payload.sid,
    eid: payload.eid,
    w: payload.w,
    n: payload.n,
    ...(payload.loc ? { loc: payload.loc } : {}),
  });
  return new TextEncoder().encode(canonical);
}

export interface CreateTokenParams {
  studentId: string;
  eventId: string;
  privateKey: CryptoKey;
  timeWindow?: number;
  location?: [number, number];
}

/**
 * Create a signed student QR token
 */
export async function createStudentQRToken(params: CreateTokenParams): Promise<StudentQRToken> {
  const window = params.timeWindow ?? Math.floor(Date.now() / 30000);
  const nonce = generateNonce();

  const payload: StudentQRTokenPayload = {
    v: 1,
    sid: params.studentId,
    eid: params.eventId,
    w: window,
    n: nonce,
    ...(params.location ? { loc: params.location } : {}),
  };

  const payloadBytes = canonicalizePayload(payload);

  const signatureBuffer = await subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    params.privateKey,
    payloadBytes
  );

  const sigBase64 = bufferToBase64Url(signatureBuffer);

  return {
    payload,
    sig: sigBase64,
  };
}

/**
 * Pack token to compact string for QR encoding
 * Format: payloadBase64.signatureBase64
 */
export function packTokenToString(token: StudentQRToken): string {
  const payloadJson = JSON.stringify(token.payload);
  const payloadBase64 = bufferToBase64Url(new TextEncoder().encode(payloadJson));
  return `${payloadBase64}.${token.sig}`;
}

/**
 * Unpack compact token string from QR scan
 */
export function unpackTokenFromString(tokenString: string): StudentQRToken | null {
  try {
    const parts = tokenString.split('.');
    if (parts.length !== 2) return null;
    const [payloadBase64, sig] = parts;
    const payloadJson = new TextDecoder().decode(base64UrlToBuffer(payloadBase64));
    const payload = JSON.parse(payloadJson) as StudentQRTokenPayload;
    if (!payload.v || !payload.sid || !payload.eid || payload.w === undefined) {
      return null;
    }
    return { payload, sig };
  } catch {
    return null;
  }
}

export interface VerifyTokenParams {
  tokenString: string;
  publicKeyRaw: string | CryptoKey;
  expectedEventId: string;
  currentTimeMs?: number;
  allowedWindowDrift?: number; // default ±1 window (30s tolerance)
}

/**
 * Verify a student QR token offline using student's public key
 */
export async function verifyStudentQRToken(params: VerifyTokenParams): Promise<VerificationResult> {
  const unpacked = unpackTokenFromString(params.tokenString);
  if (!unpacked) {
    return { valid: false, reason: 'Invalid token format' };
  }

  const { payload, sig } = unpacked;

  // 1. Version check
  if (payload.v !== 1) {
    return { valid: false, reason: `Unsupported token version: ${payload.v}` };
  }

  // 2. Event check
  if (payload.eid !== params.expectedEventId) {
    return { valid: false, reason: `Event mismatch: expected ${params.expectedEventId}, got ${payload.eid}` };
  }

  // 3. Time window check
  const nowMs = params.currentTimeMs ?? Date.now();
  const currentWindow = Math.floor(nowMs / 30000);
  const windowDiff = Math.abs(payload.w - currentWindow);
  const allowedDrift = params.allowedWindowDrift ?? 1;

  if (windowDiff > allowedDrift) {
    return {
      valid: false,
      reason: `Token expired or out of window (drift: ${windowDiff} windows)`,
      payload,
    };
  }

  // 4. ECDSA Signature verification
  try {
    const publicKey =
      typeof params.publicKeyRaw === 'string'
        ? await importPublicKeyRaw(params.publicKeyRaw)
        : params.publicKeyRaw;

    const payloadBytes = canonicalizePayload(payload);
    const signatureBytes = base64UrlToBuffer(sig);

    const isSignatureValid = await subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBytes,
      payloadBytes
    );

    if (!isSignatureValid) {
      return { valid: false, reason: 'Invalid signature: token payload or key mismatch', payload };
    }

    return {
      valid: true,
      payload,
      isClockDrifted: windowDiff > 0,
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Verification error: ${(error as Error).message}`,
      payload,
    };
  }
}
