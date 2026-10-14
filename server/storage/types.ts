export const SCHEMA_VERSION = 1 as const;

export type LocaleCode = "en" | "zh-CN";

export type UserRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  locale?: LocaleCode | null;
  davUsername?: string | null;
  davPassword?: string | null;
  davPasswordHash?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type BucketRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  userId: string;
  size: number;
  count: number;
  createdAt: number;
  updatedAt: number;
};

export type FileRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  contentType: string;
  type: string;
  size: number;
  path: string;
  visibility: string;
  metadata?: unknown;
  preview?: string | null;
  dimensions?: string | null;
  count: number;
  parentId: string;
  bucketName: string;
  userId: string;
  sharedCount: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  storageId?: string | null;
  trashKey?: string | null;
};

export type ShareRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  fileId: string;
  userId: string;
  role: string;
  createdAt: number;
};

export type StorageStatus = "ok" | "error" | "unknown";

export type StorageRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  type: "r2" | "s3" | "webdav" | "onedrive" | "gdrive";
  mountPath: string;
  readOnly: boolean;
  config: Record<string, unknown>;
  secret: string | null;
  status: StorageStatus;
  lastCheckedAt?: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
};

export type SyncSchedule =
  | { kind: "manual" }
  | { kind: "interval"; everyMinutes: number }
  | { kind: "cron"; expr: string; tz: string };

export type SyncJob = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  enabled: boolean;
  sourcePrefix: string;
  targetStorageId: string;
  targetPrefix: string;
  mode: "incremental" | "full";
  deletePolicy: "keep" | "trash" | "mirror";
  conflict: "overwrite" | "skip" | "newer";
  excludes: string[];
  schedule: SyncSchedule;
  weeklyFullVerify?: boolean;
  lastRunAt?: number;
  lastSuccessStartedAt?: number;
  nextRunAt?: number;
  failedPaths: string[];
  createdAt: number;
  updatedAt: number;
};

export type SyncRun = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  jobId: string;
  trigger: "schedule" | "manual";
  mode: "incremental" | "full";
  status: "queued" | "running" | "success" | "partial" | "failed" | "cancelled";
  startedAt: number;
  finishedAt?: number;
  cursor?: string;
  stats: {
    scanned: number;
    copied: number;
    skipped: number;
    deleted: number;
    failed: number;
    bytes: number;
  };
  errors: { path: string; message: string }[];
};

export type KvStore = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ttl?: number }): Promise<void>;
  del(key: string): Promise<void>;
  keys?(prefix?: string): Promise<string[]>;
};
