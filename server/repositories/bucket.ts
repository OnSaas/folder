import { SCHEMA_VERSION, type BucketRecord } from "../storage/types";
import { keys } from "../storage/keys";
import { delKey, getJson, setJson } from "../storage/kv";

export const bucketRepository = {
  async get(id: string): Promise<BucketRecord | null> {
    return getJson<BucketRecord>(keys.bucket(id));
  },

  async getByName(name: string): Promise<BucketRecord | null> {
    const id = await getJson<string>(keys.bucketName(name));
    if (!id) return null;
    return bucketRepository.get(id);
  },

  async getByUser(userId: string): Promise<BucketRecord | null> {
    const id = await getJson<string>(keys.userBucket(userId));
    if (!id) return null;
    return bucketRepository.get(id);
  },

  async create(data: Omit<BucketRecord, "schemaVersion">): Promise<BucketRecord> {
    const record: BucketRecord = { ...data, schemaVersion: SCHEMA_VERSION };
    await setJson(keys.bucket(record.id), record);
    await setJson(keys.bucketName(record.name), record.id);
    await setJson(keys.userBucket(record.userId), record.id);
    return record;
  },

  async update(record: BucketRecord): Promise<BucketRecord> {
    const next = { ...record, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
    await setJson(keys.bucket(next.id), next);
    await setJson(keys.bucketName(next.name), next.id);
    await setJson(keys.userBucket(next.userId), next.id);
    return next;
  },

  async delete(id: string): Promise<void> {
    const bucket = await bucketRepository.get(id);
    if (!bucket) return;
    await delKey(keys.bucket(id));
    await delKey(keys.bucketName(bucket.name));
    await delKey(keys.userBucket(bucket.userId));
  },
};
