// PBKDF2-based password hashing (Web Crypto). 100k iterations / SHA-256 / 16-byte salt.
// Ported from frog-mailsystem/api/src/lib/password.ts — used for employer credential auth.

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(
  password: string,
  saltBytes?: Uint8Array
): Promise<{ hash: string; salt: string }> {
  const salt = saltBytes ?? crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    KEY_LENGTH_BITS
  );
  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt),
  };
}

export async function verifyPassword(
  password: string,
  hashB64: string,
  saltB64: string
): Promise<boolean> {
  const salt = base64ToBytes(saltB64);
  const { hash } = await hashPassword(password, salt);
  // constant-time compare
  if (hash.length !== hashB64.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hash.length; i++) {
    mismatch |= hash.charCodeAt(i) ^ hashB64.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Generate a readable temporary password an admin can hand to an employer. */
export function generateTempPassword(length = 14): string {
  // Avoid ambiguous chars (0/O, 1/l/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
