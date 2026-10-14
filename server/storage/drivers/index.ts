import type { StorageDriver } from "./types";
import { R2Driver } from "./r2";

const cache = new Map<string, StorageDriver>();
const overrides = new Map<string, StorageDriver>();

export function getDriver(storageId = "primary"): StorageDriver {
  const id = storageId || "primary";
  const override = overrides.get(id);
  if (override) return override;
  const cached = cache.get(id);
  if (cached) return cached;
  if (id !== "primary") {
    throw new Error(`Unknown storage driver: ${id}`);
  }
  const driver = new R2Driver("primary");
  cache.set(id, driver);
  return driver;
}

export function setDriverOverride(storageId: string, driver: StorageDriver | null) {
  if (!driver) overrides.delete(storageId);
  else overrides.set(storageId, driver);
  cache.delete(storageId);
}

export function clearDriverCache() {
  cache.clear();
  overrides.clear();
}

export { R2Driver } from "./r2";
export { MemoryDriver } from "./memory";
export { trashObjectKey } from "./types";
export type { StorageDriver, DriverType, ObjectMeta } from "./types";
