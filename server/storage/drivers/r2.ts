import type {
  DriverCaps,
  ObjectMeta,
  StorageDriver,
  UploadPlan,
} from "./types";

export type BlobBackend = {
  get: (path: string) => Promise<Blob | ArrayBuffer | Uint8Array | null>;
  put: (
    path: string,
    body: unknown,
    opts?: { contentType?: string }
  ) => Promise<unknown>;
  del: (path: string) => Promise<void>;
  head: (path: string) => Promise<{
    contentType?: string;
    size?: number;
    httpEtag?: string;
    uploadedAt?: string | Date;
  } | null>;
  serve?: (event: unknown, path: string) => Promise<unknown>;
  handleMultipartUpload?: (event: unknown) => Promise<any>;
};

const caps: DriverCaps = {
  list: false,
  range: true,
  move: true,
  copy: true,
  mkdir: false,
  presignGet: false,
  presignPut: false,
  multipart: true,
};

function defaultBlob(): BlobBackend {
  return hubBlob() as unknown as BlobBackend;
}

async function toStream(body: Blob | ArrayBuffer | Uint8Array) {
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body.stream();
  }
  const bytes =
    body instanceof Uint8Array ? body : new Uint8Array(body as ArrayBuffer);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function sizeOf(body: Blob | ArrayBuffer | Uint8Array) {
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  if (body instanceof Uint8Array) return body.byteLength;
  return (body as ArrayBuffer).byteLength;
}

export class R2Driver implements StorageDriver {
  readonly id: string;
  readonly type = "r2" as const;
  readonly caps = caps;
  private blob: BlobBackend;

  constructor(id = "primary", blob?: BlobBackend) {
    this.id = id;
    this.blob = blob ?? defaultBlob();
  }

  async head(path: string): Promise<ObjectMeta | null> {
    const meta = await this.blob.head(path);
    if (!meta) return null;
    const uploaded = meta.uploadedAt
      ? new Date(meta.uploadedAt).getTime()
      : Date.now();
    return {
      path,
      size: meta.size || 0,
      contentType: meta.contentType,
      etag: meta.httpEtag,
      updatedAt: uploaded,
    };
  }

  async get(path: string) {
    const body = await this.blob.get(path);
    if (!body) return null;
    const meta = (await this.head(path)) || {
      path,
      size: await sizeOf(body),
      updatedAt: Date.now(),
    };
    return { body: await toStream(body), meta };
  }

  async put(
    path: string,
    body: ReadableStream | ArrayBuffer | Uint8Array,
    opts: { contentType?: string; size?: number }
  ) {
    await this.blob.put(path, body, { contentType: opts.contentType });
    return (
      (await this.head(path)) || {
        path,
        size: opts.size || 0,
        contentType: opts.contentType,
        updatedAt: Date.now(),
      }
    );
  }

  async delete(path: string) {
    await this.blob.del(path);
  }

  async move(from: string, to: string) {
    const src = await this.blob.get(from);
    if (!src) return;
    await this.blob.put(to, src);
    await this.blob.del(from);
  }

  async copy(from: string, to: string) {
    const src = await this.blob.get(from);
    if (!src) return;
    await this.blob.put(to, src);
  }

  async initUpload(): Promise<UploadPlan> {
    return { kind: "proxy" };
  }

  async test() {
    try {
      await this.blob.head("__folder_probe__");
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: String(err?.message || err) };
    }
  }

  serve(event: unknown, path: string) {
    if (!this.blob.serve) {
      throw new Error("Blob serve is not available");
    }
    return this.blob.serve(event, path);
  }

  handleMultipartUpload(event: unknown) {
    if (!this.blob.handleMultipartUpload) {
      throw new Error("Multipart upload is not available");
    }
    return this.blob.handleMultipartUpload(event);
  }
}
