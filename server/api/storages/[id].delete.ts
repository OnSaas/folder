import { storageRepository } from "~~/server/repositories/storage";

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event);
  await storageRepository.delete(id);
  return { ok: true };
});
