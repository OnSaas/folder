import type { DriverCaps, ObjectMeta, StorageDriver, UploadPlan } from "./types";
import { bytesToStream, driverError, formBody, joinKey, toBytes } from "./http";

export type OAuthOptions = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  rootPrefix?: string;
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

type GraphItem = {
  id?: string;
  name?: string;
  size?: number;
  lastModifiedDateTime?: string;
  eTag?: string;
  file?: { mimeType?: string };
  folder?: unknown;
};

function itemMeta(item: GraphItem, path: string): ObjectMeta {
  return {
    path,
    size: item.size || 0,
    contentType: item.file?.mimeType,
    etag: item.eTag,
    updatedAt: Date.parse(item.lastModifiedDateTime || "") || Date.now(),
    isDir: Boolean(item.folder),
  };
}

export class OneDriveDriver implements StorageDriver {
  readonly id: string;
  readonly type = "onedrive" as const;
  readonly caps = caps;
  private opts: OAuthOptions;
  private fetchImpl: typeof fetch;
  private accessToken = "";
  private expiresAt = 0;

  constructor(id: string, opts: OAuthOptions, fetchImpl: typeof fetch = fetch) {
    this.id = id;
    this.opts = opts;
    this.fetchImpl = fetchImpl;
  }

  private itemPath(path: string) {
    const key = joinKey(this.opts.rootPrefix || "", path);
    if (!key) return "https://graph.microsoft.com/v1.0/me/drive/root";
    return `https://graph.microsoft.com/v1.0/me/drive/root:/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  private async token() {
    if (this.accessToken && this.expiresAt > Date.now() + 30_000) return this.accessToken;
    const res = await this.fetchImpl("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
        refresh_token: this.opts.refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access files.readwrite.all",
      }),
    });
    if (!res.ok) driverError(res.status, await res.text());
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) driverError(401, "OneDrive token refresh failed");
    this.accessToken = json.access_token;
    this.expiresAt = Date.now() + (json.expires_in || 3600) * 1000;
    return this.accessToken;
  }

  private async graph(method: string, url: string, init: RequestInit = {}) {
    const token = await this.token();
    const res = await this.fetchImpl(url, {
      method,
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    return res;
  }

  async head(path: string) {
    const res = await this.graph("GET", this.itemPath(path));
    if (res.status === 404) return null;
    if (!res.ok) driverError(res.status, await res.text());
    return itemMeta((await res.json()) as GraphItem, path);
  }

  async get(path: string, opts?: { range?: { start: number; end?: number } }) {
    const headers: Record<string, string> = {};
    if (opts?.range) {
      const end = opts.range.end ?? "";
      headers.Range = `bytes=${opts.range.start}-${end}`;
    }
    const res = await this.graph("GET", `${this.itemPath(path)}:/content`, { headers });
    if (res.status === 404) return null;
    if (!res.ok || !res.body) driverError(res.status, await res.text());
    const meta = (await this.head(path)) || {
      path,
      size: Number(res.headers.get("content-length") || 0),
      updatedAt: Date.now(),
    };
    return { body: res.body, meta };
  }

  async put(path: string, body: ReadableStream | ArrayBuffer | Uint8Array, opts: { contentType?: string; size?: number }) {
    const bytes = await toBytes(body);
    const res = await this.graph("PUT", `${this.itemPath(path)}:/content`, {
      headers: { "content-type": opts.contentType || "application/octet-stream" },
      body: bytes as BodyInit,
    });
    if (!res.ok) driverError(res.status, await res.text());
    return itemMeta((await res.json()) as GraphItem, path);
  }

  async delete(path: string) {
    const res = await this.graph("DELETE", this.itemPath(path));
    if (res.status !== 404 && !res.ok) driverError(res.status, await res.text());
  }

  async list(prefix: string) {
    const url = prefix
      ? `${this.itemPath(prefix)}:/children`
      : `${this.itemPath("")}/children`;
    const res = await this.graph("GET", url);
    if (!res.ok) driverError(res.status, await res.text());
    const json = (await res.json()) as { value?: GraphItem[] };
    const items = (json.value || []).map((item) =>
      itemMeta(item, joinKey(prefix, item.name || ""))
    );
    return { items };
  }

  async move(from: string, to: string) {
    const name = to.split("/").pop() || to;
    const parent = to.split("/").slice(0, -1).join("/");
    const parentUrl = this.itemPath(parent);
    const parentRes = await this.graph("GET", parentUrl);
    if (!parentRes.ok) driverError(parentRes.status, await parentRes.text());
    const parentItem = (await parentRes.json()) as GraphItem;
    const res = await this.graph("PATCH", this.itemPath(from), {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        parentReference: { id: parentItem.id },
      }),
    });
    if (!res.ok) driverError(res.status, await res.text());
  }

  async copy(from: string, to: string) {
    const got = await this.get(from);
    if (!got) driverError(404, "Source not found");
    const bytes = await toBytes(got.body);
    await this.put(to, bytes, { contentType: got.meta.contentType, size: bytes.byteLength });
  }

  async mkdir(path: string) {
    const name = path.split("/").pop() || path;
    const parent = path.split("/").slice(0, -1).join("/");
    const url = parent ? `${this.itemPath(parent)}:/children` : `${this.itemPath("")}/children`;
    const res = await this.graph("POST", url, {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
    });
    if (res.status !== 409 && !res.ok) driverError(res.status, await res.text());
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
