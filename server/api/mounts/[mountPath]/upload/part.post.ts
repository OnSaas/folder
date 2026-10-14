import { assertWritable, invalidateList, resolveMount } from "~~/server/utils/mounts";
import { sanitizeObjectPath } from "~~/server/utils/object-path";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const path = sanitizeObjectPath(getHeader(event, "x-object-path") || getQuery(event).path as string);
  const contentType = getHeader(event, "content-type") || "application/octet-stream";
  const raw = await readRawBody(event, false);
  const { rec, driver } = await resolveMount(mountPath);
  assertWritable(rec);
  let body: Uint8Array;
  if (!raw) body = new Uint8Array();
  else if (typeof raw === "string") body = new TextEncoder().encode(raw);
  else body = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
  if (body.byteLength >= 8 * 1024 * 1024) {
    throw createError({ status: 413, message: "Use multipart upload for files >= 8MB" });
  }
  await driver.put(path, body, { contentType, size: body.byteLength });
  await invalidateList(rec, path);
  return { ok: true };
});
