import { storageRepository } from "../repositories/storage";
import { getStoredDriver } from "../storage/drivers";
import { keys } from "../storage/keys";
import { delKey, getJson, setJson } from "../storage/kv";
import { assertMountPath, parentObjectPath, pathToId, sanitizeObjectPath } from "./object-path";
import type { StorageDriver } from "../storage/drivers/types";
import type { StorageRecord } from "../storage/types";

async function digest(text: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function resolveMount(mountPath: string) {
  const rec = await storageRepository.getByMount(assertMountPath(mountPath));
  if (!rec || rec.id === "primary") {
    throw createError({ status: 404, message: "Mount not found" });
  }
  const driver = await getStoredDriver(rec.id);
  return { rec, driver };
}

export async function cachedList(rec: StorageRecord, driver: StorageDriver, path: string, cursor?: string) {
  const prefix = sanitizeObjectPath(path);
  const cacheKey = keys.listCache(rec.id, await digest(`${prefix}:${cursor || ""}`));
  if (!cursor) {
    const hit = await getJson<{ items: any[]; cursor?: string }>(cacheKey);
    if (hit) return hit;
  }
  if (!driver.list) throw createError({ status: 400, message: "Driver cannot list" });
  const result = await driver.list(prefix, { cursor, limit: 200 });
  const items = result.items.map((item) => ({
    id: pathToId(item.path),
    name: item.path.split("/").filter(Boolean).pop() || item.path,
    type: item.isDir ? "folder" : "file",
    size: item.size,
    updatedAt: item.updatedAt,
    storageId: rec.id,
    path: item.path,
  }));
  const payload = { items, cursor: result.cursor };
  await setJson(cacheKey, payload, 60);
  return payload;
}

export async function invalidateList(rec: StorageRecord, path: string) {
  const prefix = sanitizeObjectPath(path);
  const parent = parentObjectPath(prefix);
  for (const target of [prefix, parent, ""]) {
    const cacheKey = keys.listCache(rec.id, await digest(`${target}:`));
    await delKey(cacheKey);
  }
}

export function assertWritable(rec: StorageRecord) {
  if (rec.readOnly) throw createError({ status: 403, message: "Mount is read-only" });
}

export async function relocateObject(mountPath: string, fromRaw: string, toRaw: string, copy: boolean) {
  const from = sanitizeObjectPath(fromRaw);
  const to = sanitizeObjectPath(toRaw);
  const { rec, driver } = await resolveMount(mountPath);
  assertWritable(rec);
  if (copy) {
    if (!driver.copy) throw createError({ status: 400, message: "Driver cannot copy" });
    await driver.copy(from, to);
  } else if (driver.move) {
    await driver.move(from, to);
  } else if (driver.copy) {
    await driver.copy(from, to);
    await driver.delete(from);
  } else {
    throw createError({ status: 400, message: "Driver cannot move" });
  }
  await invalidateList(rec, from);
  await invalidateList(rec, parentObjectPath(to));
  return { ok: true };
}
