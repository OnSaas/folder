import { syncJobRepository } from "~~/server/repositories/sync";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") || "";
  const existing = await syncJobRepository.get(id);
  if (!existing) throw createError({ status: 404, message: "Job not found" });
  await syncJobRepository.delete(id);
  return { ok: true };
});
