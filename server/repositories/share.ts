import { SCHEMA_VERSION, type ShareRecord } from "../storage/types";
import { keys } from "../storage/keys";
import { addToList, delKey, getJson, getList, removeFromList, setJson } from "../storage/kv";
import { ulid } from "ulidx";

export const shareRepository = {
  async get(id: string): Promise<ShareRecord | null> {
    return getJson<ShareRecord>(keys.share(id));
  },

  async listByUser(userId: string): Promise<ShareRecord[]> {
    const ids = await getList(keys.sharedUser(userId));
    const rows = await Promise.all(ids.map((id) => shareRepository.get(id)));
    return rows.filter((row): row is ShareRecord => !!row);
  },

  async listByFile(fileId: string): Promise<ShareRecord[]> {
    const ids = await getList(keys.sharedFile(fileId));
    const rows = await Promise.all(ids.map((id) => shareRepository.get(id)));
    return rows.filter((row): row is ShareRecord => !!row);
  },

  async create(data: Omit<ShareRecord, "schemaVersion" | "id"> & { id?: string }): Promise<ShareRecord> {
    const existing = await shareRepository.listByFile(data.fileId);
    const found = existing.find((row) => row.userId === data.userId);
    if (found) {
      const next = { ...found, role: data.role };
      await setJson(keys.share(found.id), next);
      return next;
    }
    const record: ShareRecord = {
      schemaVersion: SCHEMA_VERSION,
      id: data.id || (ulid() as string),
      fileId: data.fileId,
      userId: data.userId,
      role: data.role,
      createdAt: data.createdAt,
    };
    await setJson(keys.share(record.id), record);
    await addToList(keys.sharedUser(record.userId), record.id);
    await addToList(keys.sharedFile(record.fileId), record.id);
    return record;
  },

  async delete(id: string): Promise<void> {
    const row = await shareRepository.get(id);
    if (!row) return;
    await delKey(keys.share(id));
    await removeFromList(keys.sharedUser(row.userId), id);
    await removeFromList(keys.sharedFile(row.fileId), id);
  },
};
