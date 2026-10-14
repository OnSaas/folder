import { storageRepository } from "~~/server/repositories/storage";
import { toPublicStorage } from "~~/server/utils/storages";

export default defineEventHandler(async () => {
  const rows = await storageRepository.list();
  return rows.map(toPublicStorage);
});
