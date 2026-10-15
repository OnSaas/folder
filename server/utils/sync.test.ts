import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

(globalThis as any).createError = (opts: { status?: number; message?: string }) => {
  const err = new Error(opts.message || "error") as Error & { statusCode?: number };
  err.statusCode = opts.status;
  return err;
};

import { MemoryKv } from "../storage/memory";
import { setKvOverride } from "../storage/kv";
import { MemoryDriver } from "../storage/drivers/memory";
import { setDriverOverride, clearDriverCache } from "../storage/drivers";
import { fileRepository } from "../repositories/file";
import { userRepository } from "../repositories/user";
import { bucketRepository } from "../repositories/bucket";
import { storageRepository } from "../repositories/storage";
import { syncJobRepository } from "../repositories/sync";
import { keys } from "../storage/keys";
import { setJson } from "../storage/kv";
import { SCHEMA_VERSION } from "../storage/types";
import { isExcluded, cronMatches, nextRunAt } from "./sync-match";
import { shouldCopy, runSyncJob } from "./sync";

describe("sync match", () => {
  it("excludes glob names", () => {
    assert.equal(isExcluded("files/a.tmp", "a.tmp", ["*.tmp"]), true);
    assert.equal(isExcluded("files/.DS_Store", ".DS_Store", [".DS_Store"]), true);
    assert.equal(isExcluded("files/a.pdf", "a.pdf", ["*.tmp", ".DS_Store"]), false);
  });

  it("matches 5-field cron in UTC", () => {
    const date = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    assert.equal(cronMatches("0 * * * *", date), true);
    assert.equal(cronMatches("5 * * * *", date), false);
  });

  it("matches cron in a named timezone", () => {
    // 2026-01-01T00:30Z is 08:30 in Asia/Shanghai.
    const date = new Date(Date.UTC(2026, 0, 1, 0, 30, 0));
    assert.equal(cronMatches("30 8 * * *", date, "Asia/Shanghai"), true);
    assert.equal(cronMatches("30 0 * * *", date, "Asia/Shanghai"), false);
    assert.equal(cronMatches("30 0 * * *", date, "UTC"), true);
  });

  it("computes the next cron run in a timezone", () => {
    const from = Date.UTC(2026, 0, 1, 0, 0, 0);
    const next = nextRunAt(
      { kind: "cron", expr: "0 3 * * *", tz: "Asia/Shanghai" },
      from
    );
    assert.ok(next);
    assert.equal(new Date(next!).toISOString(), "2026-01-01T19:00:00.000Z");
  });

  it("computes interval next run", () => {
    assert.equal(nextRunAt({ kind: "interval", everyMinutes: 15 }, 1_000), 1_000 + 15 * 60_000);
    assert.equal(nextRunAt({ kind: "manual" }, 1_000), undefined);
  });

  it("conflict policy", () => {
    assert.equal(shouldCopy("skip", { size: 1, updatedAt: 9 }, { path: "x", size: 1, updatedAt: 1 }), false);
    assert.equal(shouldCopy("overwrite", { size: 1, updatedAt: 1 }, { path: "x", size: 1, updatedAt: 9 }), true);
    assert.equal(shouldCopy("newer", { size: 1, updatedAt: 9 }, { path: "x", size: 1, updatedAt: 1 }), true);
    assert.equal(shouldCopy("newer", { size: 1, updatedAt: 1 }, { path: "x", size: 1, updatedAt: 9 }), false);
    assert.equal(shouldCopy("newer", { size: 1, updatedAt: 1 }, null), true);
  });
});

describe("sync engine", () => {
  const kv = new MemoryKv();
  const primary = new MemoryDriver("primary");
  const dest = new MemoryDriver("b2");

  before(async () => {
    setKvOverride(kv);
    clearDriverCache();
    setDriverOverride("primary", primary);
    setDriverOverride("b2", dest);
    await setJson(keys.owner(), "owner");
    await userRepository.create({
      id: "owner",
      name: "Owner",
      createdAt: 1,
    });
    await bucketRepository.create({
      id: "bkt",
      name: "files",
      userId: "owner",
      size: 0,
      count: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    await storageRepository.create({
      schemaVersion: SCHEMA_VERSION,
      id: "b2",
      name: "B2",
      type: "s3",
      mountPath: "b2-backup",
      readOnly: false,
      config: {},
      secret: null,
      status: "ok",
      createdAt: 1,
      updatedAt: 1,
    });
    await primary.put("files/keep.pdf", new Uint8Array([1, 2, 3]), {
      contentType: "application/pdf",
    });
    await primary.put("files/skip.tmp", new Uint8Array([9]), { contentType: "text/plain" });
    const now = Date.now();
    await fileRepository.create({
      id: "f1",
      name: "keep.pdf",
      contentType: "application/pdf",
      type: "document",
      size: 3,
      path: "files/keep.pdf",
      visibility: "private",
      count: 0,
      parentId: "root",
      bucketName: "files",
      userId: "owner",
      sharedCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await fileRepository.create({
      id: "f2",
      name: "skip.tmp",
      contentType: "text/plain",
      type: "document",
      size: 1,
      path: "files/skip.tmp",
      visibility: "private",
      count: 0,
      parentId: "root",
      bucketName: "files",
      userId: "owner",
      sharedCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  it("copies primary to dest, keeps extras, skips excludes", async () => {
    await dest.put("backup/old.bin", new Uint8Array([7]), { contentType: "application/octet-stream" });
    const job = await syncJobRepository.save({
      schemaVersion: SCHEMA_VERSION,
      id: "job1",
      name: "Nightly",
      enabled: true,
      sourcePrefix: "files",
      targetStorageId: "b2",
      targetPrefix: "backup",
      mode: "incremental",
      deletePolicy: "keep",
      conflict: "newer",
      excludes: ["*.tmp"],
      schedule: { kind: "manual" },
      failedPaths: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const result = await runSyncJob(job, "manual");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.run.stats.copied, 1);
    assert.ok((await dest.head("backup/keep.pdf"))?.size === 3);
    assert.equal(await dest.head("backup/skip.tmp"), null);
    assert.ok(await dest.head("backup/old.bin"));
  });

  it("mirror deletes dest extras", async () => {
    const job = await syncJobRepository.save({
      schemaVersion: SCHEMA_VERSION,
      id: "job2",
      name: "Mirror",
      enabled: true,
      sourcePrefix: "files",
      targetStorageId: "b2",
      targetPrefix: "backup",
      mode: "full",
      deletePolicy: "mirror",
      conflict: "skip",
      excludes: ["*.tmp"],
      schedule: { kind: "manual" },
      failedPaths: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const result = await runSyncJob(job, "manual");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(await dest.head("backup/old.bin"), null);
    assert.ok(await dest.head("backup/keep.pdf"));
  });
});
