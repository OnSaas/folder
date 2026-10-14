import { storageRepository } from "~~/server/repositories/storage";
import { toPublicStorage } from "~~/server/utils/storages";

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event);
  const rec = await storageRepository.get(id);
  if (!rec) throw createError({ status: 404, message: "Storage not found" });
  return toPublicStorage(rec);
});
