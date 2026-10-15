import type { StorageDriver } from "./types";
import { R2Driver } from "./r2";
import { storageRepository } from "../../repositories/storage";
import { decryptSecret } from "../../utils/storage-secret";
import { buildDriverFromParts } from "./factory";
import type { DriverType } from "./types";

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

export async function getStoredDriver(storageId = "primary"): Promise<StorageDriver> {
  const id = storageId || "primary";
  if (id === "primary") return getDriver("primary");
  const override = overrides.get(id);
  if (override) return override;
  const cached = cache.get(id);
  if (cached) return cached;
  const rec = await storageRepository.get(id);
  if (!rec) throw createError({ status: 404, message: "Storage not found" });
  let secret: Record<string, string> = {};
  if (rec.secret) {
    secret = JSON.parse(await decryptSecret(rec.secret));
  }
  const driver = buildDriverFromParts(rec.id, rec.type as DriverType, rec.config, secret);
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
export { S3Driver } from "./s3";
export { WebDavDriver } from "./webdav";
export { OneDriveDriver } from "./onedrive";
export { GDriveDriver } from "./gdrive";
export { trashObjectKey } from "./types";
export type { StorageDriver, DriverType, ObjectMeta } from "./types";
