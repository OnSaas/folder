import { AwsClient } from "aws4fetch";
import type {
  DriverCaps,
  ObjectMeta,
  StorageDriver,
  UploadPlan,
} from "./types";

export type S3Options = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  rootPrefix?: string;
  allowHttp?: boolean;
};

const caps: DriverCaps = {
  list: true,
  range: true,
  move: false,
  copy: true,
  mkdir: true,
  presignGet: true,
  presignPut: true,
  multipart: true,
};

function joinKey(prefix: string, path: string) {
  const root = prefix.replace(/^\/+|\/+$/g, "");
  const rest = path.replace(/^\/+/, "");
  if (!root) return rest;
  if (!rest) return root;
  return `${root}/${rest}`;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function xmlText(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : "";
}

function xmlAll(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map(
    (m) => m[1]
  );
}

export class S3Driver implements StorageDriver {
  readonly id: string;
  readonly type = "s3" as const;
  readonly caps = caps;
  private opts: S3Options;
  private client: AwsClient;
  private fetchImpl: typeof fetch;

  constructor(id: string, opts: S3Options, fetchImpl: typeof fetch = fetch) {
    this.id = id;
    this.opts = opts;
    this.fetchImpl = fetchImpl;
    if (!opts.allowHttp && !opts.endpoint.startsWith("https://")) {
      throw createError({ status: 400, message: "Endpoint must use https" });
    }
    this.client = new AwsClient({
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      service: "s3",
      region: opts.region || "auto",
    });
  }

  private objectUrl(key: string) {
    const endpoint = this.opts.endpoint.replace(/\/+$/, "");
    const host = new URL(endpoint);
    if (this.opts.forcePathStyle === false) {
      return `${host.protocol}//${this.opts.bucket}.${host.host}/${encodeKey(key)}`;
    }
    return `${endpoint}/${this.opts.bucket}/${encodeKey(key)}`;
  }

  private fullKey(path: string) {
    return joinKey(this.opts.rootPrefix || "", path);
  }

  private async signed(method: string, url: string, init: RequestInit = {}) {
    const signed = await this.client.sign(new Request(url, { method, ...init }));
    return this.fetchImpl(signed);
  }

  async head(path: string): Promise<ObjectMeta | null> {
    const key = this.fullKey(path);
    const res = await this.signed("HEAD", this.objectUrl(key));
    if (res.status === 404) return null;
    if (!res.ok) throw createError({ status: res.status, message: await res.text() });
    const size = Number(res.headers.get("content-length") || 0);
    const updated = Date.parse(res.headers.get("last-modified") || "") || Date.now();
    return {
      path,
      size,
      contentType: res.headers.get("content-type") || undefined,
      etag: res.headers.get("etag") || undefined,
      updatedAt: updated,
    };
  }

  async get(path: string, opts?: { range?: { start: number; end?: number } }) {
    const key = this.fullKey(path);
    const headers: Record<string, string> = {};
    if (opts?.range) {
      const end = opts.range.end ?? "";
      headers.Range = `bytes=${opts.range.start}-${end}`;
    }
    const res = await this.signed("GET", this.objectUrl(key), { headers });
    if (res.status === 404) return null;
    if (!res.ok || !res.body) throw createError({ status: res.status, message: await res.text() });
    const meta = (await this.head(path)) || {
      path,
      size: Number(res.headers.get("content-length") || 0),
      contentType: res.headers.get("content-type") || undefined,
      etag: res.headers.get("etag") || undefined,
      updatedAt: Date.now(),
    };
    return { body: res.body as ReadableStream, meta };
  }

  async put(
    path: string,
    body: ReadableStream | ArrayBuffer | Uint8Array,
    opts: { contentType?: string; size?: number }
  ) {
    const key = this.fullKey(path);
    const headers: Record<string, string> = {};
    if (opts.contentType) headers["Content-Type"] = opts.contentType;
    const res = await this.signed("PUT", this.objectUrl(key), {
      headers,
      body: body as BodyInit,
    });
    if (!res.ok) throw createError({ status: res.status, message: await res.text() });
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
    const key = this.fullKey(path);
    const res = await this.signed("DELETE", this.objectUrl(key));
    if (!res.ok && res.status !== 404) {
      throw createError({ status: res.status, message: await res.text() });
    }
  }

  async list(prefix: string, opts?: { cursor?: string; limit?: number }) {
    const keyPrefix = this.fullKey(prefix);
    const endpoint = this.opts.endpoint.replace(/\/+$/, "");
    const url = new URL(`${endpoint}/${this.opts.bucket}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("delimiter", "/");
    if (keyPrefix) url.searchParams.set("prefix", keyPrefix.endsWith("/") ? keyPrefix : `${keyPrefix}/`);
    if (opts?.cursor) url.searchParams.set("continuation-token", opts.cursor);
    if (opts?.limit) url.searchParams.set("max-keys", String(opts.limit));
    const res = await this.signed("GET", url.toString());
    if (!res.ok) throw createError({ status: res.status, message: await res.text() });
    const xml = await res.text();
    const items: ObjectMeta[] = [];
    for (const block of xmlAll(xml, "Contents")) {
      const key = xmlText(block, "Key");
      const logical = this.opts.rootPrefix
        ? key.replace(new RegExp(`^${this.opts.rootPrefix.replace(/\/+$/, "")}/`), "")
        : key;
      items.push({
        path: logical,
        size: Number(xmlText(block, "Size") || 0),
        etag: xmlText(block, "ETag") || undefined,
        updatedAt: Date.parse(xmlText(block, "LastModified")) || Date.now(),
        isDir: false,
      });
    }
    for (const block of xmlAll(xml, "CommonPrefixes")) {
      const key = xmlText(block, "Prefix");
      const logical = this.opts.rootPrefix
        ? key.replace(new RegExp(`^${this.opts.rootPrefix.replace(/\/+$/, "")}/`), "")
        : key;
      items.push({
        path: logical.replace(/\/+$/, ""),
        size: 0,
        updatedAt: Date.now(),
        isDir: true,
      });
    }
    const truncated = xmlText(xml, "IsTruncated") === "true";
    const cursor = truncated ? xmlText(xml, "NextContinuationToken") : undefined;
    return { items, cursor };
  }

  async copy(from: string, to: string) {
    const dest = this.objectUrl(this.fullKey(to));
    const source = `/${this.opts.bucket}/${this.fullKey(from)}`;
    const res = await this.signed("PUT", dest, {
      headers: { "x-amz-copy-source": encodeURI(source) },
    });
    if (!res.ok) throw createError({ status: res.status, message: await res.text() });
  }

  async mkdir(path: string) {
    const key = this.fullKey(path).replace(/\/+$/, "") + "/";
    const res = await this.signed("PUT", this.objectUrl(key), {
      headers: { "Content-Type": "application/x-directory" },
      body: "",
    });
    if (!res.ok) throw createError({ status: res.status, message: await res.text() });
  }

  async presignGet(path: string, ttlSeconds: number) {
    const url = new URL(this.objectUrl(this.fullKey(path)));
    url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
    const signed = await this.client.sign(new Request(url.toString(), { method: "GET" }), {
      aws: { signQuery: true },
    });
    return signed.url;
  }

  async initUpload(path: string, opts: { contentType?: string; size?: number }): Promise<UploadPlan> {
    if ((opts.size || 0) < 8 * 1024 * 1024) return { kind: "proxy" };
    const url = new URL(this.objectUrl(this.fullKey(path)));
    url.searchParams.set("uploads", "");
    const headers: Record<string, string> = {};
    if (opts.contentType) headers["Content-Type"] = opts.contentType;
    const res = await this.signed("POST", url.toString(), { headers });
    if (!res.ok) throw createError({ status: res.status, message: await res.text() });
    const xml = await res.text();
    return {
      kind: "presigned-multipart",
      uploadId: xmlText(xml, "UploadId"),
      partSize: 8 * 1024 * 1024,
    };
  }

  async test() {
    const probe = `__folder_probe_${Date.now()}`;
    try {
      await this.put(probe, new Uint8Array(), { contentType: "application/octet-stream", size: 0 });
      await this.delete(probe);
      await this.list("");
      return { ok: true };
    } catch (err: any) {
      const message = String(err?.message || err);
      let hint = message;
      if (/SignatureDoesNotMatch|InvalidAccessKeyId|403/.test(message)) hint = "signature";
      else if (/NoSuchBucket|404/.test(message)) hint = "bucket";
      else if (/AccessDenied/.test(message)) hint = "permission";
      else if (/CORS|Failed to fetch/i.test(message)) hint = "cors";
      return { ok: false, message: hint };
    }
  }
}
