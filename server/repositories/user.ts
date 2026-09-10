import { SCHEMA_VERSION, type UserRecord, type LocaleCode } from "../storage/types";
import { keys } from "../storage/keys";
import { delKey, getJson, setJson } from "../storage/kv";

export const userRepository = {
  async get(id: string): Promise<UserRecord | null> {
    return getJson<UserRecord>(keys.user(id));
  },

  async getByEmail(email: string): Promise<UserRecord | null> {
    const id = await getJson<string>(keys.userEmail(email));
    if (!id) return null;
    return userRepository.get(id);
  },

  async create(data: Omit<UserRecord, "schemaVersion" | "updatedAt"> & { updatedAt?: number }): Promise<UserRecord> {
    const now = Date.now();
    const record: UserRecord = {
      schemaVersion: SCHEMA_VERSION,
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar ?? null,
      country: data.country ?? null,
      status: data.status,
      provider: data.provider ?? null,
      locale: data.locale ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt ?? now,
    };
    await setJson(keys.user(record.id), record);
    await setJson(keys.userEmail(record.email), record.id);
    return record;
  },

  async update(record: UserRecord): Promise<UserRecord> {
    const next = { ...record, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
    await setJson(keys.user(next.id), next);
    await setJson(keys.userEmail(next.email), next.id);
    return next;
  },

  async setLocale(id: string, locale: LocaleCode): Promise<UserRecord | null> {
    const user = await userRepository.get(id);
    if (!user) return null;
    return userRepository.update({ ...user, locale });
  },

  async delete(id: string): Promise<void> {
    const user = await userRepository.get(id);
    if (!user) return;
    await delKey(keys.user(id));
    await delKey(keys.userEmail(user.email));
  },
};
