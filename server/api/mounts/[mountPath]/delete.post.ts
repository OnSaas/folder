import { assertWritable, invalidateList, resolveMount } from "~~/server/utils/mounts";
import { sanitizeObjectPath } from "~~/server/utils/object-path";

export default defineEventHandler(async (event) => {
  const { mountPath } = getRouterParams(event);
  const body = await readBody(event);
  const path = sanitizeObjectPath(body?.path);
  const { rec, driver } = await resolveMount(mountPath);
  assertWritable(rec);
  await driver.delete(path);
  await invalidateList(rec, path);
  return { ok: true };
});
