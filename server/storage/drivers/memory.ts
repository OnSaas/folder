import type {
  DriverCaps,
  DriverType,
  ObjectMeta,
  StorageDriver,
  UploadPlan,
} from "./types";

function concat(chunks: Uint8Array[]) {
  const size = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function toBytes(body: ReadableStream | ArrayBuffer | Uint8Array | Blob) {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer());
  }
  const reader = (body as ReadableStream).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value));
  }
  return concat(chunks);
}

function bytesToStream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

type Entry = {
  bytes: Uint8Array;
  contentType?: string;
  updatedAt: number;
  etag: string;
  isDir?: boolean;
};

const caps: DriverCaps = {
  list: true,
  range: true,
  move: true,
  copy: true,
  mkdir: true,
  presignGet: false,
  presignPut: false,
  multipart: false,
};

export class MemoryDriver implements StorageDriver {
  readonly id: string;
  readonly type: DriverType = "r2";
  readonly caps = caps;
  store = new Map<string, Entry>();

  constructor(id = "memory") {
    this.id = id;
  }

  private meta(path: string, entry: Entry): ObjectMeta {
    return {
      path,
      size: entry.bytes.byteLength,
      contentType: entry.contentType,
      etag: entry.etag,
      updatedAt: entry.updatedAt,
      isDir: entry.isDir,
    };
  }

  async head(path: string) {
    const entry = this.store.get(path);
    return entry ? this.meta(path, entry) : null;
  }

  async get(path: string, opts?: { range?: { start: number; end?: number } }) {
    const entry = this.store.get(path);
    if (!entry) return null;
    let bytes = entry.bytes;
    if (opts?.range) {
      const end = opts.range.end ?? bytes.byteLength - 1;
      bytes = bytes.slice(opts.range.start, end + 1);
    }
    return { body: bytesToStream(bytes), meta: this.meta(path, entry) };
  }

  async put(
    path: string,
    body: ReadableStream | ArrayBuffer | Uint8Array,
    opts: { contentType?: string; size?: number }
  ) {
    const bytes = await toBytes(body);
    const entry: Entry = {
      bytes,
      contentType: opts.contentType,
      updatedAt: Date.now(),
      etag: `"${bytes.byteLength}-${Date.now()}"`,
    };
    this.store.set(path, entry);
    return this.meta(path, entry);
  }

  async delete(path: string) {
    this.store.delete(path);
  }

  async list(prefix: string, opts?: { cursor?: string; limit?: number }) {
    const limit = opts?.limit ?? 1000;
    const keys = [...this.store.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort();
    const start = opts?.cursor ? Number(opts.cursor) || 0 : 0;
    const slice = keys.slice(start, start + limit);
    const items = slice.map((key) => this.meta(key, this.store.get(key)!));
    const next = start + slice.length;
    return {
      items,
      cursor: next < keys.length ? String(next) : undefined,
    };
  }

  async move(from: string, to: string) {
    const entry = this.store.get(from);
    if (!entry) return;
    this.store.set(to, { ...entry, updatedAt: Date.now() });
    this.store.delete(from);
  }

  async copy(from: string, to: string) {
    const entry = this.store.get(from);
    if (!entry) return;
    this.store.set(to, {
      ...entry,
      bytes: new Uint8Array(entry.bytes),
      updatedAt: Date.now(),
    });
  }

  async mkdir(path: string) {
    const key = path.endsWith("/") ? path : `${path}/`;
    const empty = new Uint8Array();
    this.store.set(key, {
      bytes: empty,
      updatedAt: Date.now(),
      etag: `"dir-${Date.now()}"`,
      isDir: true,
    });
  }

  async initUpload(): Promise<UploadPlan> {
    return { kind: "proxy" };
  }

  async test() {
    return { ok: true, usedBytes: [...this.store.values()].reduce((n, e) => n + e.bytes.byteLength, 0) };
  }
}
