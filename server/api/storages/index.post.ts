import { saveStorageFromBody, toPublicStorage } from "~~/server/utils/storages";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const rec = await saveStorageFromBody(body);
  return toPublicStorage(rec);
});
