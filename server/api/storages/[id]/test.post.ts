import { storageRepository } from "~~/server/repositories/storage";
import { getStoredDriver } from "~~/server/storage/drivers";
import { toPublicStorage } from "~~/server/utils/storages";

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event);
  const rec = await storageRepository.get(id);
  if (!rec) throw createError({ status: 404, message: "Storage not found" });
  const driver = await getStoredDriver(id);
  const result = await driver.test();
  const next = await storageRepository.update(
    {
      ...rec,
      status: result.ok ? "ok" : "error",
      lastCheckedAt: Date.now(),
      lastError: result.ok ? undefined : result.message,
    },
    rec
  );
  return { ...result, storage: toPublicStorage(next) };
});
