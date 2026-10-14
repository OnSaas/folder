import { syncJobRepository } from "~~/server/repositories/sync";
import { parseJobBody, assertTargetStorage } from "~~/server/utils/sync";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") || "";
  const existing = await syncJobRepository.get(id);
  if (!existing) throw createError({ status: 404, message: "Job not found" });
  const body = await readBody(event);
  const parsed = parseJobBody(body, existing);
  await assertTargetStorage(parsed.targetStorageId);
  return syncJobRepository.save({
    ...existing,
    ...parsed,
    id: existing.id,
    createdAt: existing.createdAt,
  });
});
