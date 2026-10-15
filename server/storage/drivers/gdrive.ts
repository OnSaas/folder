import type { DriverCaps, ObjectMeta, StorageDriver, UploadPlan } from "./types";
import { driverError, formBody, joinKey, toBytes } from "./http";

export type GDriveOptions = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  rootPrefix?: string;
  rootFolderId?: string;
};

const FOLDER = "application/vnd.google-apps.folder";

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

type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  md5Checksum?: string;
};

function fileMeta(file: DriveFile, path: string): ObjectMeta {
  return {
    path,
    size: Number(file.size || 0),
    contentType: file.mimeType,
    etag: file.md5Checksum,
    updatedAt: Date.parse(file.modifiedTime || "") || Date.now(),
    isDir: file.mimeType === FOLDER,
  };
}

export class GDriveDriver implements StorageDriver {
  readonly id: string;
  readonly type = "gdrive" as const;
  readonly caps = caps;
  private opts: GDriveOptions;
  private fetchImpl: typeof fetch;
  private accessToken = "";
  private expiresAt = 0;
  private idCache = new Map<string, string>();

  constructor(id: string, opts: GDriveOptions, fetchImpl: typeof fetch = fetch) {
    this.id = id;
    this.opts = opts;
    this.fetchImpl = fetchImpl;
  }

  private rootId() {
    return this.opts.rootFolderId || "root";
  }

  private async token() {
    if (this.accessToken && this.expiresAt > Date.now() + 30_000) return this.accessToken;
    const res = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
        refresh_token: this.opts.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) driverError(res.status, await res.text());
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) driverError(401, "Google Drive token refresh failed");
    this.accessToken = json.access_token;
    this.expiresAt = Date.now() + (json.expires_in || 3600) * 1000;
    return this.accessToken;
  }

  private async api(method: string, url: string, init: RequestInit = {}) {
    const token = await this.token();
    return this.fetchImpl(url, {
      method,
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
  }

  private async findChild(parentId: string, name: string, folder?: boolean) {
    const q = [
      `name = '${name.replace(/'/g, "\\'")}'`,
      `'${parentId}' in parents`,
      "trashed = false",
      folder === true ? `mimeType = '${FOLDER}'` : folder === false ? `mimeType != '${FOLDER}'` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,md5Checksum)&pageSize=1`;
    const res = await this.api("GET", url);
    if (!res.ok) driverError(res.status, await res.text());
    const json = (await res.json()) as { files?: DriveFile[] };
    return json.files?.[0] || null;
  }

  private async resolve(path: string, createFolders = false): Promise<{ parentId: string; file: DriveFile | null; name: string }> {
    const key = joinKey(this.opts.rootPrefix || "", path);
    const parts = key.split("/").filter(Boolean);
    let parentId = this.rootId();
    if (!parts.length) return { parentId, file: { id: parentId, name: "", mimeType: FOLDER }, name: "" };
    for (let i = 0; i < parts.length - 1; i++) {
      const cached = this.idCache.get(parts.slice(0, i + 1).join("/"));
      if (cached) {
        parentId = cached;
        continue;
      }
      let folder = await this.findChild(parentId, parts[i], true);
      if (!folder && createFolders) {
        folder = await this.createFolder(parentId, parts[i]);
      }
      if (!folder?.id) driverError(404, `Folder not found: ${parts[i]}`);
      parentId = folder.id;
      this.idCache.set(parts.slice(0, i + 1).join("/"), parentId);
    }
    const name = parts[parts.length - 1];
    const file = await this.findChild(parentId, name);
    return { parentId, file, name };
  }

  private async createFolder(parentId: string, name: string) {
    const res = await this.api("POST", "https://www.googleapis.com/drive/v3/files", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
    });
    if (!res.ok) driverError(res.status, await res.text());
    return (await res.json()) as DriveFile;
  }

  async head(path: string) {
    const { file } = await this.resolve(path);
    if (!file) return null;
    return fileMeta(file, path);
  }

  async get(path: string, opts?: { range?: { start: number; end?: number } }) {
    const { file } = await this.resolve(path);
    if (!file?.id) return null;
    if (file.mimeType === FOLDER) return null;
    const headers: Record<string, string> = {};
    if (opts?.range) {
      const end = opts.range.end ?? "";
      headers.Range = `bytes=${opts.range.start}-${end}`;
    }
    const res = await this.api("GET", `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers });
    if (res.status === 404) return null;
    if (!res.ok || !res.body) driverError(res.status, await res.text());
    return { body: res.body, meta: fileMeta(file, path) };
  }

  async put(path: string, body: ReadableStream | ArrayBuffer | Uint8Array, opts: { contentType?: string; size?: number }) {
    const bytes = await toBytes(body);
    const { parentId, file, name } = await this.resolve(path, true);
    let id = file?.id;
    if (!id) {
      const created = await this.api("POST", "https://www.googleapis.com/drive/v3/files", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, parents: [parentId] }),
      });
      if (!created.ok) driverError(created.status, await created.text());
      id = ((await created.json()) as DriveFile).id;
    }
    const res = await this.api(
      "PATCH",
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      {
        headers: { "content-type": opts.contentType || "application/octet-stream" },
        body: bytes as BodyInit,
      }
    );
    if (!res.ok) driverError(res.status, await res.text());
    const updated = (await res.json()) as DriveFile;
    return fileMeta({ ...updated, size: String(bytes.byteLength), mimeType: opts.contentType }, path);
  }

  async delete(path: string) {
    const { file } = await this.resolve(path);
    if (!file?.id) return;
    const res = await this.api("DELETE", `https://www.googleapis.com/drive/v3/files/${file.id}`);
    if (res.status !== 404 && !res.ok) driverError(res.status, await res.text());
  }

  async list(prefix: string) {
    const { file, parentId, name } = await this.resolve(prefix);
    const folderId = prefix ? file?.id : this.rootId();
    if (prefix && !folderId) return { items: [] as ObjectMeta[] };
    const q = `'${folderId || parentId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,md5Checksum)&pageSize=200`;
    const res = await this.api("GET", url);
    if (!res.ok) driverError(res.status, await res.text());
    const json = (await res.json()) as { files?: DriveFile[] };
    const items = (json.files || [])
      .filter((item) => item.mimeType === FOLDER || !String(item.mimeType || "").startsWith("application/vnd.google-apps"))
      .map((item) => fileMeta(item, joinKey(prefix, item.name || "")));
    void name;
    return { items };
  }

  async move(from: string, to: string) {
    const src = await this.resolve(from);
    if (!src.file?.id) driverError(404, "Source not found");
    const dest = await this.resolve(to, true);
    const name = dest.name;
    const res = await this.api(
      "PATCH",
      `https://www.googleapis.com/drive/v3/files/${src.file.id}?addParents=${dest.parentId}&removeParents=${src.parentId}`,
      {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      }
    );
    if (!res.ok) driverError(res.status, await res.text());
  }

  async copy(from: string, to: string) {
    const got = await this.get(from);
    if (!got) driverError(404, "Source not found");
    const bytes = await toBytes(got.body);
    await this.put(to, bytes, { contentType: got.meta.contentType, size: bytes.byteLength });
  }

  async mkdir(path: string) {
    const { parentId, file, name } = await this.resolve(path, true);
    if (file) return;
    await this.createFolder(parentId, name);
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
