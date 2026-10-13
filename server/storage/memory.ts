import type { KvStore } from "./types";

export class MemoryKv implements KvStore {
  store = new Map<string, { value: string; expiresAt?: number }>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, opts?: { ttl?: number }): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: opts?.ttl ? Date.now() + opts.ttl * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(prefix = ""): Promise<string[]> {
    const now = Date.now();
    return [...this.store.entries()]
      .filter(
        ([key, entry]) =>
          key.startsWith(prefix) &&
          (entry.expiresAt === undefined || entry.expiresAt > now)
      )
      .map(([key]) => key);
  }
}
