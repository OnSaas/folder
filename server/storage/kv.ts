import type { KvStore } from "./types";

let override: KvStore | null = null;

export function setKvOverride(kv: KvStore | null) {
  override = kv;
}

export function useStorageKv(): KvStore {
  if (override) return override;
  const hub = hubKV() as KvStore;
  return hub;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const value = await useStorageKv().get<T>(key);
  return value ?? null;
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await useStorageKv().set(key, value);
}

export async function delKey(key: string): Promise<void> {
  await useStorageKv().del(key);
}

export async function getList(key: string): Promise<string[]> {
  const list = await getJson<string[]>(key);
  return Array.isArray(list) ? list : [];
}

export async function addToList(key: string, id: string): Promise<void> {
  const list = await getList(key);
  if (!list.includes(id)) {
    list.push(id);
    await setJson(key, list);
  }
}

export async function removeFromList(key: string, id: string): Promise<void> {
  const list = await getList(key);
  const next = list.filter((item) => item !== id);
  if (next.length === 0) {
    await delKey(key);
    return;
  }
  await setJson(key, next);
}

export async function listKeys(prefix: string): Promise<string[]> {
  const store = useStorageKv() as { keys?: (base?: string) => Promise<string[]> };
  if (typeof store.keys === "function") {
    const found = await store.keys(prefix);
    return Array.isArray(found) ? found.filter((key) => key.startsWith(prefix)) : [];
  }
  try {
    const hub = hubKV() as unknown as {
      getKeys?: (base?: string) => Promise<string[]>;
      keys?: (base?: string) => Promise<string[]>;
    };
    const keys = hub.getKeys
      ? await hub.getKeys(prefix)
      : hub.keys
        ? await hub.keys(prefix)
        : [];
    return Array.isArray(keys) ? keys.filter((key) => key.startsWith(prefix)) : [];
  } catch {
    return [];
  }
}
