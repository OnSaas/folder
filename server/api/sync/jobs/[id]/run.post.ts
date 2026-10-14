import { syncJobRepository } from "~~/server/repositories/sync";
import { runSyncJob } from "~~/server/utils/sync";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") || "";
  const job = await syncJobRepository.get(id);
  if (!job) throw createError({ status: 404, message: "Job not found" });
  return runSyncJob(job, "manual");
});
