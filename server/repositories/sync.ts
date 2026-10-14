import { SCHEMA_VERSION, type SyncJob, type SyncRun } from "../storage/types";
import { keys } from "../storage/keys";
import { delKey, getJson, getList, setJson } from "../storage/kv";

const MAX_RUNS = 30;

export const syncJobRepository = {
  async get(id: string): Promise<SyncJob | null> {
    return getJson<SyncJob>(keys.syncJob(id));
  },

  async list(): Promise<SyncJob[]> {
    const ids = await getList(keys.syncJobs());
    const rows: SyncJob[] = [];
    for (const id of ids) {
      const rec = await syncJobRepository.get(id);
      if (rec) rows.push(rec);
    }
    return rows;
  },

  async save(job: SyncJob): Promise<SyncJob> {
    const next: SyncJob = { ...job, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
    await setJson(keys.syncJob(next.id), next);
    const ids = await getList(keys.syncJobs());
    if (!ids.includes(next.id)) await setJson(keys.syncJobs(), [...ids, next.id]);
    return next;
  },

  async delete(id: string): Promise<void> {
    await delKey(keys.syncJob(id));
    const ids = (await getList(keys.syncJobs())).filter((item) => item !== id);
    await setJson(keys.syncJobs(), ids);
    const runIds = await getList(keys.syncRuns(id));
    for (const runId of runIds) await delKey(keys.syncRun(runId));
    await delKey(keys.syncRuns(id));
    await delKey(keys.syncLock(id));
  },
};

export const syncRunRepository = {
  async get(id: string): Promise<SyncRun | null> {
    return getJson<SyncRun>(keys.syncRun(id));
  },

  async list(jobId: string): Promise<SyncRun[]> {
    const ids = await getList(keys.syncRuns(jobId));
    const rows: SyncRun[] = [];
    for (const id of ids) {
      const rec = await syncRunRepository.get(id);
      if (rec) rows.push(rec);
    }
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },

  async save(run: SyncRun): Promise<SyncRun> {
    const next: SyncRun = { ...run, schemaVersion: SCHEMA_VERSION };
    await setJson(keys.syncRun(next.id), next);
    const ids = await getList(keys.syncRuns(next.jobId));
    const merged = [next.id, ...ids.filter((id) => id !== next.id)].slice(0, MAX_RUNS);
    await setJson(keys.syncRuns(next.jobId), merged);
    const dropped = ids.filter((id) => !merged.includes(id));
    for (const id of dropped) await delKey(keys.syncRun(id));
    return next;
  },
};
