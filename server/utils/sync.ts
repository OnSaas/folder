import { ulid } from "ulidx";
import { SCHEMA_VERSION, type FileRecord, type SyncJob, type SyncRun } from "../storage/types";
import type { ObjectMeta, StorageDriver } from "../storage/drivers/types";
import { keys } from "../storage/keys";
import { getJson, setJson, delKey } from "../storage/kv";
import { fileRepository } from "../repositories/file";
import { storageRepository } from "../repositories/storage";
import { syncJobRepository, syncRunRepository } from "../repositories/sync";
import { getDriver, getStoredDriver } from "../storage/drivers";
import { trashObjectKey } from "../storage/drivers/types";
import { sanitizeObjectPath } from "./object-path";
import { ensureOwnerAndBucket } from "./owner";
import { isExcluded, nextRunAt } from "./sync-match";

export const SYNC_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const SYNC_MAX_FILES = 25;
export const SYNC_BUDGET_MS = 20_000;
const LOCK_TTL = 90;
const MAX_ERRORS = 50;
const MAX_FAILED = 500;

function emptyStats(): SyncRun["stats"] {
  return { scanned: 0, copied: 0, skipped: 0, deleted: 0, failed: 0, bytes: 0 };
}

function joinPrefix(prefix: string, rel: string) {
  const a = sanitizeObjectPath(prefix);
  const b = sanitizeObjectPath(rel);
  return [a, b].filter(Boolean).join("/");
}

function relativePath(path: string, prefix: string) {
  const full = sanitizeObjectPath(path);
  const base = sanitizeObjectPath(prefix);
  if (!base) return full;
  if (full === base) return "";
  if (!full.startsWith(`${base}/`)) return null;
  return full.slice(base.length + 1);
}

export function shouldCopy(
  conflict: SyncJob["conflict"],
  source: { size: number; updatedAt: number; etag?: string },
  dest: ObjectMeta | null
) {
  if (!dest) return true;
  if (conflict === "overwrite") return true;
  if (conflict === "skip") return false;
  if (source.etag && dest.etag && source.etag === dest.etag) return false;
  return source.updatedAt > dest.updatedAt;
}

async function acquireLock(jobId: string) {
  const key = keys.syncLock(jobId);
  const existing = await getJson<number>(key);
  if (existing && existing > Date.now()) return false;
  await setJson(key, Date.now() + LOCK_TTL * 1000, LOCK_TTL);
  return true;
}

async function releaseLock(jobId: string) {
  await delKey(keys.syncLock(jobId));
}

export async function listSourceFiles(sourcePrefix: string): Promise<FileRecord[]> {
  const { user } = await ensureOwnerAndBucket();
  const files = await fileRepository.listByUser(user.id);
  const prefix = sanitizeObjectPath(sourcePrefix);
  return files
    .filter((file) => !file.deletedAt && file.type !== "folder")
    .filter((file) => {
      if (!prefix) return true;
      const path = sanitizeObjectPath(file.path);
      return path === prefix || path.startsWith(`${prefix}/`);
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function copyObject(
  src: StorageDriver,
  dst: StorageDriver,
  from: string,
  to: string,
  contentType?: string
) {
  const got = await src.get(from);
  if (!got) throw new Error("Source object missing");
  if (got.meta.size > SYNC_MAX_FILE_BYTES) {
    throw new Error("File too large for this tick; wait for a later run or split");
  }
  await dst.put(to, got.body, { contentType: contentType || got.meta.contentType, size: got.meta.size });
  return got.meta.size;
}

async function listAll(driver: StorageDriver, prefix: string) {
  if (!driver.list) return [];
  const items: ObjectMeta[] = [];
  let cursor: string | undefined;
  do {
    const page = await driver.list(prefix, { cursor, limit: 500 });
    items.push(...page.items);
    cursor = page.cursor;
  } while (cursor && items.length < 5000);
  return items;
}

export async function runSyncJob(job: SyncJob, trigger: SyncRun["trigger"], now = Date.now()) {
  if (job.targetStorageId === "primary") {
    throw createError({ status: 400, message: "Target cannot be primary" });
  }
  const locked = await acquireLock(job.id);
  if (!locked) return { skipped: true as const };

  const mode =
    job.mode === "full" ||
    (job.weeklyFullVerify &&
      (!job.lastSuccessStartedAt || now - job.lastSuccessStartedAt > 7 * 24 * 60 * 60 * 1000))
      ? "full"
      : job.mode;

  const run: SyncRun = {
    schemaVersion: SCHEMA_VERSION,
    id: ulid() as string,
    jobId: job.id,
    trigger,
    mode,
    status: "running",
    startedAt: now,
    stats: emptyStats(),
    errors: [],
  };
  await syncRunRepository.save(run);

  try {
    const src = getDriver("primary");
    const dst = await getStoredDriver(job.targetStorageId);
    const files = await listSourceFiles(job.sourcePrefix);
    const retry = new Set(job.failedPaths);
    const ordered = [
      ...files.filter((file) => retry.has(file.path)),
      ...files.filter((file) => !retry.has(file.path)),
    ];
    const startIndex = run.cursor ? Number(run.cursor) || 0 : 0;
    const failed: string[] = [];
    const deadline = now + SYNC_BUDGET_MS;
    let index = startIndex;
    let copiedAny = false;

    for (; index < ordered.length; index++) {
      if (Date.now() > deadline || run.stats.copied + run.stats.failed >= SYNC_MAX_FILES) {
        run.cursor = String(index);
        break;
      }
      const file = ordered[index];
      run.stats.scanned += 1;
      const rel = relativePath(file.path, job.sourcePrefix);
      if (rel === null) {
        run.stats.skipped += 1;
        continue;
      }
      if (isExcluded(file.path, file.name, job.excludes)) {
        run.stats.skipped += 1;
        continue;
      }
      const destPath = joinPrefix(job.targetPrefix, rel);
      try {
        const destMeta = await dst.head(destPath);
        if (!shouldCopy(job.conflict, { size: file.size, updatedAt: file.updatedAt }, destMeta)) {
          run.stats.skipped += 1;
          continue;
        }
        const bytes = await copyObject(src, dst, file.path, destPath, file.contentType);
        run.stats.copied += 1;
        run.stats.bytes += bytes;
        copiedAny = true;
      } catch (err) {
        run.stats.failed += 1;
        failed.push(file.path);
        if (run.errors.length < MAX_ERRORS) {
          run.errors.push({
            path: file.path,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (index >= ordered.length && (job.deletePolicy === "mirror" || job.deletePolicy === "trash")) {
      const prefix = sanitizeObjectPath(job.targetPrefix);
      const remote = await listAll(dst, prefix ? `${prefix}/` : "");
      const wanted = new Set(
        ordered
          .filter((file) => relativePath(file.path, job.sourcePrefix) !== null)
          .filter((file) => !isExcluded(file.path, file.name, job.excludes))
          .map((file) => joinPrefix(job.targetPrefix, relativePath(file.path, job.sourcePrefix) || ""))
      );
      for (const item of remote) {
        if (item.isDir) continue;
        if (wanted.has(item.path)) continue;
        try {
          if (job.deletePolicy === "trash") {
            if (dst.move) await dst.move(item.path, trashObjectKey(item.path, Date.now()));
            else await dst.delete(item.path);
          } else {
            await dst.delete(item.path);
          }
          run.stats.deleted += 1;
        } catch (err) {
          run.stats.failed += 1;
          if (run.errors.length < MAX_ERRORS) {
            run.errors.push({
              path: item.path,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    const unfinished = index < ordered.length;
    run.status = unfinished
      ? "partial"
      : run.stats.failed
        ? run.stats.copied || copiedAny
          ? "partial"
          : "failed"
        : "success";
    run.finishedAt = Date.now();
    if (!unfinished) run.cursor = undefined;
    await syncRunRepository.save(run);

    const nextFailed = unfinished
      ? [...failed, ...job.failedPaths.filter((path) => !failed.includes(path))].slice(0, MAX_FAILED)
      : failed.slice(0, MAX_FAILED);
    const updated: SyncJob = {
      ...job,
      lastRunAt: now,
      lastSuccessStartedAt: run.status === "success" ? now : job.lastSuccessStartedAt,
      failedPaths: nextFailed,
      nextRunAt: unfinished ? now : nextRunAt(job.schedule, Date.now()),
      updatedAt: Date.now(),
    };
    await syncJobRepository.save(updated);
    return { skipped: false as const, run, job: updated };
  } catch (err) {
    run.status = "failed";
    run.finishedAt = Date.now();
    run.errors.push({
      path: "",
      message: err instanceof Error ? err.message : String(err),
    });
    await syncRunRepository.save(run);
    await syncJobRepository.save({
      ...job,
      lastRunAt: now,
      nextRunAt: nextRunAt(job.schedule, Date.now()),
      updatedAt: Date.now(),
    });
    throw err;
  } finally {
    await releaseLock(job.id);
  }
}

export async function tickDueJobs(now = Date.now()) {
  const jobs = await syncJobRepository.list();
  const results = [];
  for (const job of jobs) {
    if (!job.enabled) continue;
    if (job.schedule.kind === "manual") continue;
    if ((job.nextRunAt ?? 0) > now) continue;
    results.push(await runSyncJob(job, "schedule", now));
  }
  return results;
}

export function parseJobBody(body: any, existing?: SyncJob | null): Omit<SyncJob, "id" | "createdAt" | "updatedAt" | "schemaVersion"> {
  const targetStorageId = String(body.targetStorageId || existing?.targetStorageId || "");
  if (!targetStorageId || targetStorageId === "primary") {
    throw createError({ status: 400, message: "Target storage is required" });
  }
  const scheduleKind = String(body.schedule?.kind || existing?.schedule.kind || "manual");
  let schedule: SyncJob["schedule"] = { kind: "manual" };
  if (scheduleKind === "interval") {
    schedule = {
      kind: "interval",
      everyMinutes: Math.max(
        1,
        Number(
          body.schedule?.everyMinutes ??
            (existing?.schedule.kind === "interval" ? existing.schedule.everyMinutes : 60)
        ) || 60
      ),
    };
  } else if (scheduleKind === "cron") {
    const expr = String(body.schedule?.expr || (existing?.schedule.kind === "cron" ? existing.schedule.expr : "") || "0 * * * *");
    if (expr.trim().split(/\s+/).length !== 5) {
      throw createError({ status: 400, message: "Invalid cron expression" });
    }
    schedule = { kind: "cron", expr, tz: String(body.schedule?.tz || "UTC") };
  }
  const sourcePrefix = sanitizeObjectPath(body.sourcePrefix ?? existing?.sourcePrefix ?? "");
  const targetPrefix = sanitizeObjectPath(body.targetPrefix ?? existing?.targetPrefix ?? "");
  const excludes = Array.isArray(body.excludes)
    ? body.excludes.map((item: unknown) => String(item)).filter(Boolean)
    : existing?.excludes || [".DS_Store", "*.tmp"];
  return {
    name: String(body.name || existing?.name || "Backup"),
    enabled: Boolean(body.enabled ?? existing?.enabled ?? true),
    sourcePrefix,
    targetStorageId,
    targetPrefix,
    mode: (body.mode || existing?.mode || "incremental") === "full" ? "full" : "incremental",
    deletePolicy:
      body.deletePolicy === "trash" || body.deletePolicy === "mirror" || body.deletePolicy === "keep"
        ? body.deletePolicy
        : existing?.deletePolicy || "keep",
    conflict:
      body.conflict === "overwrite" || body.conflict === "skip" || body.conflict === "newer"
        ? body.conflict
        : existing?.conflict || "newer",
    excludes,
    schedule,
    weeklyFullVerify: Boolean(body.weeklyFullVerify ?? existing?.weeklyFullVerify ?? false),
    lastRunAt: existing?.lastRunAt,
    lastSuccessStartedAt: existing?.lastSuccessStartedAt,
    nextRunAt: existing?.nextRunAt ?? nextRunAt(schedule, Date.now()),
    failedPaths: existing?.failedPaths || [],
  };
}

export async function assertTargetStorage(id: string) {
  const rec = await storageRepository.get(id);
  if (!rec || rec.id === "primary") {
    throw createError({ status: 400, message: "Target storage not found" });
  }
  return rec;
}
