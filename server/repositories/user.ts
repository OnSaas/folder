import { SCHEMA_VERSION, type UserRecord, type LocaleCode } from "../storage/types";
import { keys } from "../storage/keys";
import { delKey, getJson, setJson } from "../storage/kv";

export const userRepository = {
  async get(id: string): Promise<UserRecord | null> {
    return getJson<UserRecord>(keys.user(id));
  },

  async getByDavUsername(username: string): Promise<UserRecord | null> {
    const id = await getJson<string>(keys.davUser(username));
    if (!id) return null;
    return userRepository.get(id);
  },

  async create(
    data: Omit<UserRecord, "schemaVersion" | "updatedAt"> & { updatedAt?: number }
  ): Promise<UserRecord> {
    const now = Date.now();
    const record: UserRecord = {
      schemaVersion: SCHEMA_VERSION,
      id: data.id,
      name: data.name,
      locale: data.locale ?? null,
      davUsername: data.davUsername ?? null,
      davPassword: data.davPassword ?? null,
      davPasswordHash: data.davPasswordHash ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt ?? now,
    };
    await setJson(keys.user(record.id), record);
    if (record.davUsername) {
      await setJson(keys.davUser(record.davUsername), record.id);
    }
    return record;
  },

  async update(record: UserRecord, previous?: UserRecord | null): Promise<UserRecord> {
    const before = previous ?? (await userRepository.get(record.id));
    const next = { ...record, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
    await setJson(keys.user(next.id), next);
    if (before?.davUsername && before.davUsername !== next.davUsername) {
      await delKey(keys.davUser(before.davUsername));
    }
    if (next.davUsername) {
      await setJson(keys.davUser(next.davUsername), next.id);
    }
    return next;
  },

  async setLocale(id: string, locale: LocaleCode): Promise<UserRecord | null> {
    const user = await userRepository.get(id);
    if (!user) return null;
    return userRepository.update({ ...user, locale }, user);
  },

  async setDavCredentials(
    id: string,
    username: string,
    password?: string | null
  ): Promise<UserRecord | null> {
    const user = await userRepository.get(id);
    if (!user) return null;
    const next: UserRecord = { ...user, davUsername: username };
    if (password) {
      next.davPassword = password;
    }
    return userRepository.update(next, user);
  },

  async delete(id: string): Promise<void> {
    const user = await userRepository.get(id);
    if (!user) return;
    await delKey(keys.user(id));
    if (user.davUsername) await delKey(keys.davUser(user.davUsername));
  },
};
