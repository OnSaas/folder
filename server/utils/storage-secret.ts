const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function getStorageSecret() {
  try {
    const config = useRuntimeConfig();
    const dedicated = (config.storageSecret as string | undefined) || "";
    if (dedicated) return dedicated;
    const session = (config.session as { password?: string } | undefined)?.password || "";
    if (session) return session;
  } catch {
    // tests
  }
  return process.env.NUXT_STORAGE_SECRET || process.env.NUXT_SESSION_PASSWORD || "";
}

async function aesKey(secret: string) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("folder-storage-v1"),
      info: enc.encode("aes-gcm"),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(plain: string, secret = getStorageSecret()) {
  if (!secret) throw new Error("storage secret is not configured");
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain))
  );
  return `v1.${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function decryptSecret(packed: string, secret = getStorageSecret()) {
  const parts = packed.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("invalid secret payload");
  const key = await aesKey(secret);
  const iv = b64urlDecode(parts[1]);
  const ct = b64urlDecode(parts[2]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}
