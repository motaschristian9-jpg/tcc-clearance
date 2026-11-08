const VALID_OFFICER_PINS = ['2026', 'tcc-sbo-2026', 'sbo-officer'];

/**
 * Verify officer PIN code before unlocking scanner tools
 */
export function verifyOfficerPin(pin: string): boolean {
  if (!pin) return false;
  const sanitized = pin.trim().toLowerCase();
  return VALID_OFFICER_PINS.includes(sanitized);
}

const OFFICER_AUTH_KEY = 'tcc_officer_authorized';

export function isOfficerAuthenticated(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(OFFICER_AUTH_KEY) === 'true';
}

export function setOfficerAuthenticated(authenticated: boolean): void {
  if (typeof sessionStorage === 'undefined') return;
  if (authenticated) {
    sessionStorage.setItem(OFFICER_AUTH_KEY, 'true');
  } else {
    sessionStorage.removeItem(OFFICER_AUTH_KEY);
  }
}

