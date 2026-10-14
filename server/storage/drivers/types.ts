export type DriverType = "r2" | "s3" | "webdav" | "onedrive" | "gdrive";

export type ObjectMeta = {
  path: string;
  size: number;
  contentType?: string;
  etag?: string;
  updatedAt: number;
  isDir?: boolean;
};

export type DriverCaps = {
  list: boolean;
  range: boolean;
  move: boolean;
  copy: boolean;
  mkdir: boolean;
  presignGet: boolean;
  presignPut: boolean;
  multipart: boolean;
};

export type UploadPlan =
  | { kind: "proxy" }
  | { kind: "presigned-multipart"; uploadId: string; partSize: number };

export interface StorageDriver {
  readonly id: string;
  readonly type: DriverType;
  readonly caps: DriverCaps;
  head(path: string): Promise<ObjectMeta | null>;
  get(
    path: string,
    opts?: { range?: { start: number; end?: number } }
  ): Promise<{ body: ReadableStream; meta: ObjectMeta } | null>;
  put(
    path: string,
    body: ReadableStream | ArrayBuffer | Uint8Array,
    opts: { contentType?: string; size?: number }
  ): Promise<ObjectMeta>;
  delete(path: string): Promise<void>;
  list?(
    prefix: string,
    opts?: { cursor?: string; limit?: number }
  ): Promise<{ items: ObjectMeta[]; cursor?: string }>;
  move?(from: string, to: string): Promise<void>;
  copy?(from: string, to: string): Promise<void>;
  mkdir?(path: string): Promise<void>;
  presignGet?(path: string, ttlSeconds: number): Promise<string>;
  initUpload?(
    path: string,
    opts: { contentType?: string; size?: number }
  ): Promise<UploadPlan>;
  test(): Promise<{ ok: boolean; message?: string; usedBytes?: number }>;
}

export function trashObjectKey(path: string, deletedAt: number) {
  const bucket = path.split("/")[0] || "files";
  return `.trash/${bucket}/${new Date(deletedAt).toISOString()}/${path}`;
}
