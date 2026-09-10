/**
 * Optional D1 → KV one-shot. No-op when hubDatabase is missing.
 * Usage (remote D1 still bound): npx tsx server/scripts/migrate-d1-to-kv.ts
 */
import { userRepository } from "../repositories/user";
import { bucketRepository } from "../repositories/bucket";
import { fileRepository } from "../repositories/file";
import { shareRepository } from "../repositories/share";
import { favoriteRepository } from "../repositories/favorite";

type Row = Record<string, any>;

function ts(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") return new Date(value).getTime() || Date.now();
  return Date.now();
}

export async function migrateD1ToKv(db: { prepare: (sql: string) => { all: () => Promise<{ results: Row[] }> } }) {
  const users = (await db.prepare("SELECT * FROM users").all()).results || [];
  for (const row of users) {
    await userRepository.create({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar,
      country: row.country,
      status: row.status || "active",
      provider: row.provider,
      locale: null,
      createdAt: ts(row.created_at ?? row.createdAt),
    });
  }

  const buckets = (await db.prepare("SELECT * FROM buckets").all()).results || [];
  for (const row of buckets) {
    await bucketRepository.create({
      id: row.id,
      name: row.name,
      userId: row.user_id ?? row.userId,
      size: row.size || 0,
      count: row.count || 0,
      createdAt: ts(row.created_at ?? row.createdAt),
      updatedAt: ts(row.updated_at ?? row.updatedAt),
    });
  }

  const files = (await db.prepare("SELECT * FROM files").all()).results || [];
  for (const row of files) {
    await fileRepository.create({
      id: row.id,
      name: row.name,
      contentType: row.content_type ?? row.contentType,
      type: row.type,
      size: row.size || 0,
      path: row.path,
      visibility: row.visibility || "inherit",
      metadata: row.metadata,
      preview: row.preview,
      dimensions: row.dimensions,
      count: row.count || 0,
      parentId: row.parent_id ?? row.parentId ?? "root",
      bucketName: row.bucket_name ?? row.bucketName,
      userId: row.user_id ?? row.userId,
      sharedCount: row.shared_count ?? row.sharedCount ?? 0,
      createdAt: ts(row.created_at ?? row.createdAt),
      updatedAt: ts(row.updated_at ?? row.updatedAt),
      deletedAt: row.deleted_at || row.deletedAt ? ts(row.deleted_at ?? row.deletedAt) : null,
    });
  }

  const favorites = (await db.prepare("SELECT * FROM favorites").all()).results || [];
  for (const row of favorites) {
    await favoriteRepository.add(row.user_id ?? row.userId, row.file_id ?? row.fileId);
  }

  const shared = (await db.prepare("SELECT * FROM shared").all()).results || [];
  for (const row of shared) {
    await shareRepository.create({
      fileId: row.file_id ?? row.fileId,
      userId: row.user_id ?? row.userId,
      role: row.role || "viewer",
      createdAt: ts(row.created_at ?? row.createdAt),
    });
  }

  return {
    users: users.length,
    buckets: buckets.length,
    files: files.length,
    favorites: favorites.length,
    shared: shared.length,
  };
}
