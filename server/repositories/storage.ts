import { SCHEMA_VERSION, type StorageRecord } from "../storage/types";
import { keys } from "../storage/keys";
import { delKey, getJson, getList, setJson } from "../storage/kv";

export const PRIMARY_STORAGE: StorageRecord = {
  schemaVersion: SCHEMA_VERSION,
  id: "primary",
  name: "Primary",
  type: "r2",
  mountPath: "primary",
  readOnly: false,
  config: {},
  secret: null,
  status: "ok",
  createdAt: 0,
  updatedAt: 0,
};

export const storageRepository = {
  async get(id: string): Promise<StorageRecord | null> {
    if (id === "primary") return { ...PRIMARY_STORAGE };
    return getJson<StorageRecord>(keys.storage(id));
  },

  async getByMount(mountPath: string): Promise<StorageRecord | null> {
    if (mountPath === "primary") return { ...PRIMARY_STORAGE };
    const id = await getJson<string>(keys.storageMount(mountPath));
    if (!id) return null;
    return storageRepository.get(id);
  },

  async list(): Promise<StorageRecord[]> {
    const ids = await getList(keys.storageList());
    const rows: StorageRecord[] = [{ ...PRIMARY_STORAGE }];
    for (const id of ids) {
      const rec = await storageRepository.get(id);
      if (rec && rec.id !== "primary") rows.push(rec);
    }
    return rows;
  },

  async create(record: StorageRecord): Promise<StorageRecord> {
    const next = { ...record, schemaVersion: SCHEMA_VERSION };
    await setJson(keys.storage(next.id), next);
    await setJson(keys.storageMount(next.mountPath), next.id);
    const ids = await getList(keys.storageList());
    if (!ids.includes(next.id)) {
      await setJson(keys.storageList(), [...ids, next.id]);
    }
    return next;
  },

  async update(record: StorageRecord, previous?: StorageRecord | null): Promise<StorageRecord> {
    const before = previous ?? (await storageRepository.get(record.id));
    const next = { ...record, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
    await setJson(keys.storage(next.id), next);
    if (before?.mountPath && before.mountPath !== next.mountPath) {
      await delKey(keys.storageMount(before.mountPath));
    }
    await setJson(keys.storageMount(next.mountPath), next.id);
    return next;
  },

  async delete(id: string): Promise<void> {
    if (id === "primary") {
      throw createError({ status: 400, message: "Primary storage cannot be deleted" });
    }
    const rec = await storageRepository.get(id);
    if (!rec) return;
    await delKey(keys.storage(id));
    await delKey(keys.storageMount(rec.mountPath));
    const ids = (await getList(keys.storageList())).filter((item) => item !== id);
    await setJson(keys.storageList(), ids);
  },
};
