function fail(message: string): never {
  if (typeof createError === "function") {
    throw createError({ status: 400, message });
  }
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = 400;
  throw err;
}

export function assertMountPath(mountPath: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mountPath)) {
    fail("Invalid mount path");
  }
  return mountPath;
}

export function sanitizeObjectPath(input: string | undefined | null) {
  let raw = String(input || "").replace(/\\/g, "/");
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep raw
  }
  raw = raw.replace(/^\/+/, "");
  const parts = raw.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === ".." || part.includes("\0"))) {
    fail("Invalid path");
  }
  return parts.join("/");
}

export function parentObjectPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function pathToId(path: string) {
  const bytes = new TextEncoder().encode(path);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function idToPath(id: string) {
  const padded = id.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((id.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return sanitizeObjectPath(new TextDecoder().decode(bytes));
}
