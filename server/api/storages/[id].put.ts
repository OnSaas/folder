import { storageRepository } from "~~/server/repositories/storage";
import { saveStorageFromBody, toPublicStorage } from "~~/server/utils/storages";

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event);
  if (id === "primary") throw createError({ status: 400, message: "Primary storage is built-in" });
  const existing = await storageRepository.get(id);
  if (!existing) throw createError({ status: 404, message: "Storage not found" });
  const rec = await saveStorageFromBody(await readBody(event), existing);
  return toPublicStorage(rec);
});
