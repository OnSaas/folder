import { syncJobRepository, syncRunRepository } from "~~/server/repositories/sync";

export default defineEventHandler(async () => {
  const jobs = await syncJobRepository.list();
  let failed = 0;
  let running = 0;
  let enabled = 0;
  let nextRunAt: number | undefined;
  for (const job of jobs) {
    if (job.enabled) enabled += 1;
    if (job.failedPaths.length) failed += 1;
    if (job.nextRunAt && (!nextRunAt || job.nextRunAt < nextRunAt)) nextRunAt = job.nextRunAt;
    const runs = await syncRunRepository.list(job.id);
    for (const run of runs) {
      if (run.status === "running" || run.status === "queued") running += 1;
      break;
    }
  }
  return { total: jobs.length, enabled, failed, running, nextRunAt };
});
