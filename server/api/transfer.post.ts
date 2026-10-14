import { getDriver, getStoredDriver } from "~~/server/storage/drivers";
import { sanitizeObjectPath } from "~~/server/utils/object-path";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const fromStorage = String(body?.fromStorageId || "primary");
  const toStorage = String(body?.toStorageId || "");
  const fromPath = sanitizeObjectPath(body?.fromPath);
  const toPath = sanitizeObjectPath(body?.toPath);
  if (!toStorage) throw createError({ status: 400, message: "Target storage required" });
  const src = fromStorage === "primary" ? getDriver("primary") : await getStoredDriver(fromStorage);
  const dst = toStorage === "primary" ? getDriver("primary") : await getStoredDriver(toStorage);
  const got = await src.get(fromPath);
  if (!got) throw createError({ status: 404, message: "Source file not found" });
  if (got.meta.size > 20 * 1024 * 1024) {
    throw createError({
      status: 413,
      message: "File too large for live transfer; use a sync job",
    });
  }
  await dst.put(toPath, got.body, {
    contentType: got.meta.contentType,
    size: got.meta.size,
  });
  return { ok: true };
});
