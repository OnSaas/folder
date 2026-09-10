import { SCHEMA_VERSION, type FileRecord } from "../storage/types";
import { keys } from "../storage/keys";
import {
  addToList,
  delKey,
  getJson,
  getList,
  removeFromList,
  setJson,
} from "../storage/kv";

export const fileRepository = {
  async get(id: string): Promise<FileRecord | null> {
    return getJson<FileRecord>(keys.file(id));
  },

  async getByPath(bucketName: string, path: string): Promise<FileRecord | null> {
    const id = await getJson<string>(keys.path(bucketName, path));
    if (!id) return null;
    const file = await fileRepository.get(id);
    if (!file || file.deletedAt) return null;
    return file;
  },

  async create(data: Omit<FileRecord, "schemaVersion">): Promise<FileRecord> {
    const record: FileRecord = { ...data, schemaVersion: SCHEMA_VERSION };
    await setJson(keys.file(record.id), record);
    await addToList(keys.userFiles(record.userId), record.id);
    if (record.deletedAt) {
      await addToList(keys.trash(record.userId), record.id);
    } else {
      await setJson(keys.path(record.bucketName, record.path), record.id);
      await addToList(
        keys.children(record.bucketName, record.parentId),
        record.id
      );
      if (record.parentId === "root") {
        await addToList(keys.userRoot(record.userId), record.id);
      }
    }
    return record;
  },

  async update(record: FileRecord, previous?: FileRecord | null): Promise<FileRecord> {
    const before = previous ?? (await fileRepository.get(record.id));
    const next: FileRecord = {
      ...record,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
    };
    await setJson(keys.file(next.id), next);

    if (before) {
      if (!before.deletedAt && before.path !== next.path) {
        await delKey(keys.path(before.bucketName, before.path));
      }
      if (
        !before.deletedAt &&
        (before.parentId !== next.parentId || before.deletedAt !== next.deletedAt)
      ) {
        await removeFromList(
          keys.children(before.bucketName, before.parentId),
          before.id
        );
        if (before.parentId === "root") {
          await removeFromList(keys.userRoot(before.userId), before.id);
        }
      }
    }

    if (next.deletedAt) {
      await delKey(keys.path(next.bucketName, next.path));
      await removeFromList(
        keys.children(next.bucketName, next.parentId),
        next.id
      );
      if (next.parentId === "root") {
        await removeFromList(keys.userRoot(next.userId), next.id);
      }
      await addToList(keys.trash(next.userId), next.id);
    } else {
      await setJson(keys.path(next.bucketName, next.path), next.id);
      await addToList(keys.children(next.bucketName, next.parentId), next.id);
      if (next.parentId === "root") {
        await addToList(keys.userRoot(next.userId), next.id);
      }
      await removeFromList(keys.trash(next.userId), next.id);
    }
    return next;
  },

  async listChildren(bucketName: string, parentId: string): Promise<FileRecord[]> {
    const ids = await getList(keys.children(bucketName, parentId));
    return fileRepository.getMany(ids);
  },

  async listByUser(userId: string): Promise<FileRecord[]> {
    const ids = await getList(keys.userFiles(userId));
    return fileRepository.getMany(ids);
  },

  async listTrash(userId: string): Promise<FileRecord[]> {
    const ids = await getList(keys.trash(userId));
    return fileRepository.getMany(ids);
  },

  async getMany(ids: string[]): Promise<FileRecord[]> {
    const rows = await Promise.all(ids.map((id) => fileRepository.get(id)));
    return rows.filter((row): row is FileRecord => !!row);
  },

  async listRecursiveIds(bucketName: string, ids: string[]): Promise<string[]> {
    const all: string[] = [];
    const seen = new Set<string>();
    const walk = async (current: string[]) => {
      const records = await fileRepository.getMany(current);
      const folderIds: string[] = [];
      for (const item of records) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        all.push(item.id);
        if (item.type === "folder") folderIds.push(item.id);
      }
      for (const folderId of folderIds) {
        const childIds = await getList(keys.children(bucketName, folderId));
        if (childIds.length) await walk(childIds);
      }
    };
    await walk(ids);
    return all;
  },
};
