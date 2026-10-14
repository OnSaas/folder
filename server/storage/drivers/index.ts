import type { StorageDriver } from "./types";
import { R2Driver } from "./r2";
import { S3Driver } from "./s3";
import { storageRepository } from "../../repositories/storage";
import { decryptSecret } from "../../utils/storage-secret";

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
  if (rec.type !== "s3") {
    throw createError({ status: 400, message: `Unsupported driver: ${rec.type}` });
  }
  let secret: { accessKeyId?: string; secretAccessKey?: string } = {};
  if (rec.secret) {
    secret = JSON.parse(await decryptSecret(rec.secret));
  }
  const driver = new S3Driver(rec.id, {
    endpoint: String(rec.config.endpoint || ""),
    region: String(rec.config.region || "auto"),
    bucket: String(rec.config.bucket || ""),
    accessKeyId: secret.accessKeyId || "",
    secretAccessKey: secret.secretAccessKey || "",
    forcePathStyle: rec.config.forcePathStyle !== false,
    rootPrefix: String(rec.config.rootPrefix || ""),
    allowHttp: rec.config.allowHttp === true,
  });
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
export { trashObjectKey } from "./types";
export type { StorageDriver, DriverType, ObjectMeta } from "./types";
