export function driverError(status: number, message: string): never {
  if (typeof createError === "function") {
    throw createError({ status, message });
  }
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = status;
  throw err;
}

export function joinKey(prefix: string, path: string) {
  const root = String(prefix || "").replace(/^\/+|\/+$/g, "");
  const rest = String(path || "").replace(/^\/+/, "");
  if (!root) return rest;
  if (!rest) return root;
  return `${root}/${rest}`;
}

export function encodeKey(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export async function toBytes(body: ReadableStream | ArrayBuffer | Uint8Array) {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value));
  }
  const size = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function bytesToStream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export function xmlLocal(xml: string, name: string) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");
  const match = xml.match(re);
  return match ? match[1].trim() : "";
}

export function xmlLocals(xml: string, name: string) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1].trim());
}

export function formBody(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}
