import type { DriverCaps, ObjectMeta, StorageDriver, UploadPlan } from "./types";
import {
  driverError,
  encodeKey,
  joinKey,
  toBytes,
  xmlLocal,
  xmlLocals,
} from "./http";

export type WebDavOptions = {
  endpoint: string;
  username: string;
  password: string;
  rootPrefix?: string;
  allowHttp?: boolean;
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

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function parsePropfind(xml: string, baseUrl: string): ObjectMeta[] {
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const responses = xmlLocals(xml, "response");
  const items: ObjectMeta[] = [];
  for (const block of responses) {
    const hrefRaw = decodeXml(xmlLocal(block, "href"));
    if (!hrefRaw) continue;
    let href: URL;
    try {
      href = new URL(hrefRaw, base);
    } catch {
      continue;
    }
    let rel = href.pathname;
    if (rel.startsWith(base.pathname)) rel = rel.slice(base.pathname.length);
    rel = decodeURIComponent(rel.replace(/^\/+|\/+$/g, ""));
    const isSelf = href.pathname.replace(/\/+$/, "") === base.pathname.replace(/\/+$/, "");
    if (isSelf && !rel) continue;
    const isDir = /<(?:[\w-]+:)?collection\b/i.test(block);
    const size = Number(xmlLocal(block, "getcontentlength") || 0);
    const updated = Date.parse(xmlLocal(block, "getlastmodified") || "") || Date.now();
    items.push({
      path: rel,
      size: isDir ? 0 : size,
      contentType: xmlLocal(block, "getcontenttype") || (isDir ? "folder" : undefined),
      etag: xmlLocal(block, "getetag") || undefined,
      updatedAt: updated,
      isDir,
    });
  }
  return items;
}

export class WebDavDriver implements StorageDriver {
  readonly id: string;
  readonly type = "webdav" as const;
  readonly caps = caps;
  private opts: WebDavOptions;
  private fetchImpl: typeof fetch;

  constructor(id: string, opts: WebDavOptions, fetchImpl: typeof fetch = fetch) {
    this.id = id;
    this.opts = opts;
    this.fetchImpl = fetchImpl;
    if (!opts.allowHttp && !opts.endpoint.startsWith("https://")) {
      driverError(400, "Endpoint must use https");
    }
  }

  private root() {
    const endpoint = this.opts.endpoint.replace(/\/+$/, "");
    const prefix = encodeKey(this.opts.rootPrefix || "");
    return prefix ? `${endpoint}/${prefix}` : endpoint;
  }

  private url(path: string) {
    const rest = encodeKey(joinKey("", path));
    const root = this.root();
    return rest ? `${root}/${rest}` : `${root}/`;
  }

  private headers(extra: Record<string, string> = {}) {
    const token = btoa(`${this.opts.username}:${this.opts.password}`);
    return { authorization: `Basic ${token}`, ...extra };
  }

  private async req(method: string, path: string, init: RequestInit = {}) {
    const res = await this.fetchImpl(this.url(path), {
      method,
      ...init,
      headers: { ...this.headers(init.headers as Record<string, string>), ...(init.headers || {}) },
    });
    return res;
  }

  async head(path: string): Promise<ObjectMeta | null> {
    const res = await this.req("HEAD", path);
    if (res.status === 404) return null;
    if (!res.ok) driverError(res.status, await res.text());
    return {
      path,
      size: Number(res.headers.get("content-length") || 0),
      contentType: res.headers.get("content-type") || undefined,
      etag: res.headers.get("etag") || undefined,
      updatedAt: Date.parse(res.headers.get("last-modified") || "") || Date.now(),
    };
  }

  async get(path: string, opts?: { range?: { start: number; end?: number } }) {
    const headers: Record<string, string> = {};
    if (opts?.range) {
      const end = opts.range.end ?? "";
      headers.Range = `bytes=${opts.range.start}-${end}`;
    }
    const res = await this.req("GET", path, { headers });
    if (res.status === 404) return null;
    if (!res.ok || !res.body) driverError(res.status, await res.text());
    const size = Number(res.headers.get("content-length") || 0);
    return {
      body: res.body,
      meta: {
        path,
        size,
        contentType: res.headers.get("content-type") || undefined,
        etag: res.headers.get("etag") || undefined,
        updatedAt: Date.parse(res.headers.get("last-modified") || "") || Date.now(),
      },
    };
  }

  async put(path: string, body: ReadableStream | ArrayBuffer | Uint8Array, opts: { contentType?: string; size?: number }) {
    const bytes = await toBytes(body);
    const res = await this.req("PUT", path, {
      headers: {
        "content-type": opts.contentType || "application/octet-stream",
        "content-length": String(opts.size ?? bytes.byteLength),
      },
      body: bytes as BodyInit,
    });
    if (!res.ok) driverError(res.status, await res.text());
    return (
      (await this.head(path)) || {
        path,
        size: bytes.byteLength,
        contentType: opts.contentType,
        updatedAt: Date.now(),
      }
    );
  }

  async delete(path: string) {
    const res = await this.req("DELETE", path);
    if (res.status !== 404 && !res.ok) driverError(res.status, await res.text());
  }

  async list(prefix: string) {
    const body = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/><d:resourcetype/><d:getetag/></d:prop></d:propfind>`;
    const res = await this.req("PROPFIND", prefix, {
      headers: { Depth: "1", "content-type": "application/xml; charset=utf-8" },
      body,
    });
    if (!res.ok) driverError(res.status, await res.text());
    const xml = await res.text();
    const items = parsePropfind(xml, this.url(prefix));
    const base = joinKey("", prefix);
    return {
      items: items.map((item) => ({
        ...item,
        path: item.path && base && !item.path.startsWith(`${base}/`) && item.path !== base
          ? joinKey(base, item.path)
          : item.path || base,
      })),
    };
  }

  async move(from: string, to: string) {
    const res = await this.req("MOVE", from, {
      headers: { Destination: this.url(to), Overwrite: "T" },
    });
    if (!res.ok) driverError(res.status, await res.text());
  }

  async copy(from: string, to: string) {
    const res = await this.req("COPY", from, {
      headers: { Destination: this.url(to), Overwrite: "T" },
    });
    if (!res.ok) driverError(res.status, await res.text());
  }

  async mkdir(path: string) {
    const res = await this.req("MKCOL", path);
    if (res.status !== 405 && !res.ok) driverError(res.status, await res.text());
  }

  async initUpload(): Promise<UploadPlan> {
    return { kind: "proxy" };
  }

  async test() {
    const probe = `.folder-probe-${this.id}`;
    try {
      await this.put(probe, new Uint8Array([1]), { contentType: "application/octet-stream", size: 1 });
      await this.delete(probe);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
