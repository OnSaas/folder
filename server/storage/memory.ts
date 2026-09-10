import type { KvStore } from "./types";

export class MemoryKv implements KvStore {
  store = new Map<string, string>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
