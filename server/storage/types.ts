export const SCHEMA_VERSION = 1 as const;

export type LocaleCode = "en" | "zh-CN";

export type UserRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  country?: string | null;
  status: string;
  provider?: string | null;
  locale?: LocaleCode | null;
  davUsername?: string | null;
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
};

export type ShareRecord = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  fileId: string;
  userId: string;
  role: string;
  createdAt: number;
};

export type KvStore = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
};
