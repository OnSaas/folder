import { ulid } from "ulidx";
import { SCHEMA_VERSION } from "~~/server/storage/types";
import { syncJobRepository } from "~~/server/repositories/sync";
import { parseJobBody, assertTargetStorage } from "~~/server/utils/sync";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = parseJobBody(body);
  await assertTargetStorage(parsed.targetStorageId);
  const now = Date.now();
  return syncJobRepository.save({
    ...parsed,
    schemaVersion: SCHEMA_VERSION,
    id: ulid() as string,
    createdAt: now,
    updatedAt: now,
  });
});
