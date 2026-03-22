const KEY_ADDRESS = 'quash:address';
const KEY_NAME    = 'quash:name';

export function getStoredAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY_ADDRESS);
}

export function getStoredName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY_NAME);
}

export function saveSession(address: string, name: string): void {
  localStorage.setItem(KEY_ADDRESS, address);
  localStorage.setItem(KEY_NAME, name);
}

export function clearSession(): void {
  localStorage.removeItem(KEY_ADDRESS);
  localStorage.removeItem(KEY_NAME);
}

/** ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE → ST2MH…TE */
export function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
