function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.length % 2 === 1 ? `0${hex}` : hex;
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

async function deriveSaltHash(pin: string, saltHex: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available in this environment');
  const salt = hexToBytes(saltHex);
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt, iterations: 100000 },
    keyMaterial,
    512
  );
  return new Uint8Array(bits);
}

function hashesMatch(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Produces `${saltHex}:${hashHex}` using PBKDF2-SHA512 (same shape the backend uses).
export async function hashPinClient(pin: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available in this environment');
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const saltHex = bytesToHex(salt);
  const hash = await deriveSaltHash(pin, saltHex);
  return `${saltHex}:${bytesToHex(hash)}`;
}

// Verifies a PIN against a stored hash. Legacy plaintext (pre-Day-4) values
// are accepted so existing locks keep working during the transition.
export async function pinMatchesStored(
  pin: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  if (/^\d{4}$/.test(stored)) return stored === pin;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const computed = await deriveSaltHash(pin, saltHex);
    return hashesMatch(computed, hexToBytes(hashHex));
  } catch {
    return false;
  }
}