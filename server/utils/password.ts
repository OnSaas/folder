function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const PBKDF2_ITERATIONS = 100_000;
export const HASH_SCHEME = "pbkdf2$sha256";

function toHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const clean = hex.toLowerCase();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return toHex(buf);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const saltCopy = new Uint8Array(salt);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltCopy, iterations },
    key,
    256
  );
  return toHex(bits);
}

export function parsePasswordHash(stored: string) {
  const parts = (stored || "").split("$");
  if (parts.length !== 5) return null;
  const [scheme, algo, iterRaw, salt, hash] = parts;
  const iterations = Number(iterRaw);
  if (scheme !== "pbkdf2" || algo !== "sha256") return null;
  if (!Number.isInteger(iterations) || iterations < 1) return null;
  if (!/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]+$/i.test(hash)) return null;
  if (salt.length % 2 !== 0 || hash.length !== 64) return null;
  return { iterations, salt, hash };
}

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_SCHEME}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  const derived = await pbkdf2(password, fromHex(parsed.salt), parsed.iterations);
  return timingSafeEqual(derived, parsed.hash);
}

export async function passwordFingerprint(stored: string) {
  return sha256Hex(stored);
}

export function getAdminPasswordHash() {
  try {
    const config = useRuntimeConfig();
    const fromConfig = (config.adminPasswordHash as string | undefined) || "";
    if (fromConfig) return fromConfig;
  } catch {
    // node tests / scripts
  }
  return process.env.NUXT_ADMIN_PASSWORD_HASH || "";
}
